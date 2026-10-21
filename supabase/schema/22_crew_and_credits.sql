-- ============================================================
-- 22_crew_and_credits.sql — "tell us the shoot, we'll find the crew;
-- every credit confirmed"
--
-- Two halves of one loop:
--
-- CREW. A shoot is a project (collab_posts) — it already has a title,
-- roles, dates, location, pay and vibes. suggest_crew() ranks people for
-- each role the shoot still needs; invite_to_shoot() asks one of them and
-- opens the conversation; respond_to_shoot_invite() is their answer.
--
-- CREDITS. A finished shoot is a story (collab_stories), whose credits are
-- a JSONB array of {name, role, user_id}. A credit only COUNTS once the
-- credited person confirms it, so a credit is a fact two people agreed to.
-- Someone not on Melange gets a claim link (credit_invites); claiming it
-- joins them to the credit and confirms it in one step. The public RPCs
-- here are what the share page and the claim page read while signed out.
--
-- Safe to run more than once. Apply AFTER 21_trust_and_support.sql.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Roles are stored inconsistently: the app's picker uses "Photographer",
-- "MUA", signup once stored lowercase ids. Compare through this.
CREATE OR REPLACE FUNCTION public.norm_role(p TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(coalesce(p, '')))
    WHEN 'makeup artist' THEN 'mua'
    WHEN 'makeup'        THEN 'mua'
    WHEN 'hair stylist'  THEN 'hair'
    WHEN 'hairstylist'   THEN 'hair'
    WHEN 'photo'         THEN 'photographer'
    WHEN 'video'         THEN 'videographer'
    ELSE lower(btrim(coalesce(p, '')))
  END;
$$;

-- ------------------------------------------------------------
-- 1. Confirmed credits
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_confirmations (
  story_id     UUID NOT NULL REFERENCES public.collab_stories(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
ALTER TABLE public.credit_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Confirmations are readable" ON public.credit_confirmations;
CREATE POLICY "Confirmations are readable"
  ON public.credit_confirmations FOR SELECT
  TO authenticated
  USING (true);

-- The author is part of every shoot they post: their own credit is
-- confirmed by posting it.
CREATE OR REPLACE FUNCTION public.confirm_author_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.credit_confirmations (story_id, user_id)
  VALUES (NEW.id, NEW.author_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_confirm_author_credit ON public.collab_stories;
CREATE TRIGGER trg_confirm_author_credit
  AFTER INSERT ON public.collab_stories
  FOR EACH ROW EXECUTE FUNCTION public.confirm_author_credit();

INSERT INTO public.credit_confirmations (story_id, user_id)
SELECT id, author_id FROM public.collab_stories
ON CONFLICT DO NOTHING;

-- A credited person confirms. Only works if the author put their user_id
-- in the credits, so nobody can confirm themselves onto someone's shoot.
CREATE OR REPLACE FUNCTION public.confirm_credit(p_story UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.collab_stories s
    WHERE s.id = p_story
      AND s.credits @> jsonb_build_array(jsonb_build_object('user_id', v_me))
  ) THEN
    RAISE EXCEPTION 'You are not credited on this shoot.';
  END IF;
  INSERT INTO public.credit_confirmations (story_id, user_id)
  VALUES (p_story, v_me)
  ON CONFLICT DO NOTHING;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_credit(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_credit(UUID) TO authenticated;

-- Removing yourself: drops the confirmation and the user_id on the credit,
-- leaving the name, so the author's record stays intact.
CREATE OR REPLACE FUNCTION public.decline_credit(p_story UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.collab_stories s
  SET credits = (
    SELECT coalesce(jsonb_agg(
      CASE WHEN c ->> 'user_id' = v_me::text
           THEN c || jsonb_build_object('user_id', NULL)
           ELSE c END
      ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(s.credits) WITH ORDINALITY AS t(c, ord)
  )
  WHERE s.id = p_story AND s.author_id <> v_me;
  DELETE FROM public.credit_confirmations
  WHERE story_id = p_story AND user_id = v_me
    AND NOT EXISTS (SELECT 1 FROM public.collab_stories WHERE id = p_story AND author_id = v_me);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.decline_credit(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_credit(UUID) TO authenticated;

-- Confirmed credit count per person, for Discover cards and profiles.
CREATE OR REPLACE FUNCTION public.confirmed_credit_counts(p_users UUID[])
RETURNS TABLE (user_id UUID, credits INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id,
    (SELECT count(*)::int
       FROM public.credit_confirmations cc
       JOIN public.collab_stories s ON s.id = cc.story_id AND s.is_public
       WHERE cc.user_id = u.id)
  FROM unnest(p_users) AS u(id);
$$;

REVOKE ALL ON FUNCTION public.confirmed_credit_counts(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmed_credit_counts(UUID[]) TO authenticated;

-- ------------------------------------------------------------
-- 2. Claim links for people not on Melange yet
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_invites (
  token       TEXT PRIMARY KEY,
  story_id    UUID NOT NULL REFERENCES public.collab_stories(id) ON DELETE CASCADE,
  credit_name TEXT NOT NULL,
  credit_role TEXT,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_credit_invites_story ON public.credit_invites(story_id);
-- RLS on, no policies: only the RPCs below touch it.
ALTER TABLE public.credit_invites ENABLE ROW LEVEL SECURITY;

-- The author makes (or re-gets) the link for one unclaimed credit,
-- identified by its position in the credits array (0-based).
CREATE OR REPLACE FUNCTION public.create_credit_invite(p_story UUID, p_index INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_me     UUID := auth.uid();
  v_credit JSONB;
  v_token  TEXT;
BEGIN
  SELECT s.credits -> p_index INTO v_credit
  FROM public.collab_stories s
  WHERE s.id = p_story AND s.author_id = v_me;
  IF v_credit IS NULL THEN
    RAISE EXCEPTION 'Only the person who posted this shoot can invite people to it.';
  END IF;
  IF nullif(v_credit ->> 'user_id', '') IS NOT NULL THEN
    RAISE EXCEPTION 'That person is already on Melange.';
  END IF;

  SELECT token INTO v_token
  FROM public.credit_invites
  WHERE story_id = p_story AND credit_name = v_credit ->> 'name' AND claimed_by IS NULL
  LIMIT 1;
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  v_token := translate(encode(gen_random_bytes(12), 'base64'), '+/=', '-_');
  INSERT INTO public.credit_invites (token, story_id, credit_name, credit_role, created_by)
  VALUES (v_token, p_story, v_credit ->> 'name', v_credit ->> 'role', v_me);
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_credit_invite(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_credit_invite(UUID, INT) TO authenticated;

-- What a shared shoot shows to anyone, signed in or not. Public stories
-- only, and only the fields a share page needs.
CREATE OR REPLACE FUNCTION public.get_shared_story(p_story UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'story', s.story,
    'media_urls', to_jsonb(s.media_urls),
    'happened_on', s.happened_on,
    'author', jsonb_build_object(
      'user_id', s.author_id, 'name', a.name, 'role', a.role, 'avatar_url', a.avatar_url),
    'credits', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'name', coalesce(p.name, c ->> 'name'),
        'role', c ->> 'role',
        'user_id', nullif(c ->> 'user_id', ''),
        'avatar_url', p.avatar_url,
        'confirmed', cc.user_id IS NOT NULL
      ) ORDER BY ord)
      FROM jsonb_array_elements(s.credits) WITH ORDINALITY AS t(c, ord)
      LEFT JOIN public.profiles p ON p.user_id::text = c ->> 'user_id'
      LEFT JOIN public.credit_confirmations cc
        ON cc.story_id = s.id AND cc.user_id::text = c ->> 'user_id'
    ), '[]'::jsonb)
  )
  FROM public.collab_stories s
  LEFT JOIN public.profiles a ON a.user_id = s.author_id
  WHERE s.id = p_story AND s.is_public;
$$;

REVOKE ALL ON FUNCTION public.get_shared_story(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_story(UUID) TO anon, authenticated;

-- What a claim link shows before anyone signs in.
CREATE OR REPLACE FUNCTION public.get_credit_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'story_id', i.story_id,
    'credit_name', i.credit_name,
    'credit_role', i.credit_role,
    'claimed', i.claimed_by IS NOT NULL,
    'title', s.title,
    'cover_url', s.media_urls[1],
    'author_name', a.name,
    'author_avatar_url', a.avatar_url
  )
  FROM public.credit_invites i
  JOIN public.collab_stories s ON s.id = i.story_id
  LEFT JOIN public.profiles a ON a.user_id = s.author_id
  WHERE i.token = p_token;
$$;

REVOKE ALL ON FUNCTION public.get_credit_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_credit_invite(TEXT) TO anon, authenticated;

-- Claiming: puts the signed-in person on the credit and confirms it.
CREATE OR REPLACE FUNCTION public.claim_credit(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me    UUID := auth.uid();
  v_inv   public.credit_invites%ROWTYPE;
  v_story public.collab_stories%ROWTYPE;
  v_idx   INT;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim your credit.';
  END IF;

  SELECT * INTO v_inv FROM public.credit_invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This link does not work anymore.';
  END IF;
  IF v_inv.claimed_by IS NOT NULL THEN
    IF v_inv.claimed_by = v_me THEN
      RETURN v_inv.story_id;
    END IF;
    RAISE EXCEPTION 'Someone already claimed this credit.';
  END IF;

  SELECT * INTO v_story FROM public.collab_stories WHERE id = v_inv.story_id FOR UPDATE;
  IF v_story.author_id = v_me THEN
    RAISE EXCEPTION 'That''s your own shoot. Send this link to the person you credited.';
  END IF;
  IF v_story.credits @> jsonb_build_array(jsonb_build_object('user_id', v_me)) THEN
    RAISE EXCEPTION 'You''re already credited on this shoot.';
  END IF;

  -- Find the credit by name, still unclaimed. Matching by name rather than
  -- position survives the author reordering credits after making the link.
  SELECT (ord - 1)::int INTO v_idx
  FROM jsonb_array_elements(v_story.credits) WITH ORDINALITY AS t(c, ord)
  WHERE c ->> 'name' = v_inv.credit_name AND nullif(c ->> 'user_id', '') IS NULL
  ORDER BY ord
  LIMIT 1;
  IF v_idx IS NULL THEN
    RAISE EXCEPTION 'That credit was changed after the link was made. Ask for a new link.';
  END IF;

  UPDATE public.collab_stories
  SET credits = jsonb_set(credits, ARRAY[v_idx::text, 'user_id'], to_jsonb(v_me::text))
  WHERE id = v_story.id;

  INSERT INTO public.credit_confirmations (story_id, user_id)
  VALUES (v_story.id, v_me)
  ON CONFLICT DO NOTHING;

  UPDATE public.credit_invites
  SET claimed_by = v_me, claimed_at = now()
  WHERE token = p_token;

  RETURN v_story.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_credit(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_credit(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 3. Crew: suggestions, invites, answers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shoot_invites (
  post_id    UUID NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  match_id   UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shoot_invites_user ON public.shoot_invites(user_id);
ALTER TABLE public.shoot_invites ENABLE ROW LEVEL SECURITY;

-- The shoot's owner and the invited person can see an invite.
DROP POLICY IF EXISTS "Owner and invitee read invites" ON public.shoot_invites;
CREATE POLICY "Owner and invitee read invites"
  ON public.shoot_invites FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = post_id AND p.owner_id = auth.uid())
  );

-- Ranked people for each role the shoot needs. Signals, in order of weight:
-- does their role match; shared vibes; taste similarity from the existing
-- embeddings; confirmed credits; whether they've worked with someone
-- you've worked with. Excludes you, blocked pairs, and anyone already
-- invited to this shoot.
CREATE OR REPLACE FUNCTION public.suggest_crew(p_post UUID, p_per_role INT DEFAULT 3)
RETURNS TABLE (
  role              TEXT,
  user_id           UUID,
  name              TEXT,
  avatar_url        TEXT,
  their_role        TEXT,
  portfolio_cover   TEXT,
  confirmed_credits INT,
  shared_vibes      TEXT[],
  worked_with_yours INT,
  reason            TEXT,
  score             REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_me   UUID := auth.uid();
  v_post public.collab_posts%ROWTYPE;
BEGIN
  SELECT * INTO v_post FROM public.collab_posts WHERE id = p_post AND owner_id = v_me;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the person planning this shoot can see suggestions.';
  END IF;

  RETURN QUERY
  WITH needed AS (
    SELECT DISTINCT r AS role
    FROM unnest(coalesce(nullif(v_post.roles, '{}'), v_post.looking_for, '{}'::text[])) AS r
    WHERE btrim(r) <> ''
  ),
  my_people AS (
    -- Everyone confirmed on a shoot with me.
    SELECT DISTINCT cc2.user_id
    FROM public.credit_confirmations cc1
    JOIN public.credit_confirmations cc2 ON cc2.story_id = cc1.story_id AND cc2.user_id <> v_me
    WHERE cc1.user_id = v_me
  ),
  cand AS (
    SELECT
      n.role AS need,
      p.user_id,
      p.name,
      p.avatar_url,
      p.role AS their_role,
      p.portfolio_urls[1] AS cover,
      (SELECT count(*)::int FROM public.credit_confirmations c
         JOIN public.collab_stories s ON s.id = c.story_id AND s.is_public
         WHERE c.user_id = p.user_id) AS credits,
      ARRAY(SELECT unnest(coalesce(p.vibes, '{}')) INTERSECT SELECT unnest(coalesce(v_post.vibes, '{}'))) AS vibes,
      (SELECT count(DISTINCT cc2.user_id)::int
         FROM public.credit_confirmations cc1
         JOIN public.credit_confirmations cc2 ON cc2.story_id = cc1.story_id
         WHERE cc1.user_id = p.user_id AND cc2.user_id IN (SELECT mp.user_id FROM my_people mp)) AS mutual,
      CASE WHEN p.profile_embedding IS NOT NULL AND v_post.post_embedding IS NOT NULL
           THEN public.embedding_cosine(p.profile_embedding, v_post.post_embedding)
           ELSE 0 END AS taste,
      COALESCE(cardinality(p.portfolio_urls), 0) AS photos
    FROM needed n
    JOIN public.profiles p
      ON public.norm_role(p.role) = public.norm_role(n.role)
      OR EXISTS (SELECT 1 FROM unnest(coalesce(p.skills, '{}')) sk
                 WHERE public.norm_role(sk) = public.norm_role(n.role))
    WHERE p.user_id <> v_me
      AND NOT public.is_blocked_pair(v_me, p.user_id)
      AND NOT EXISTS (SELECT 1 FROM public.shoot_invites si
                      WHERE si.post_id = p_post AND si.user_id = p.user_id)
  ),
  scored AS (
    SELECT c.*,
      (CASE WHEN public.norm_role(c.their_role) = public.norm_role(c.need) THEN 3 ELSE 1.5 END
       + 1.0 * cardinality(c.vibes)
       + 2.0 * greatest(c.taste, 0)
       + 0.6 * ln(1 + c.credits)
       + 1.5 * least(c.mutual, 3)
       + CASE WHEN c.photos >= 3 THEN 0.5 WHEN c.photos = 0 THEN -1.5 ELSE 0 END
      )::real AS s
    FROM cand c
  ),
  ranked AS (
    SELECT sc.*, row_number() OVER (PARTITION BY sc.need ORDER BY sc.s DESC, sc.credits DESC) AS rn
    FROM scored sc
  )
  SELECT
    r.need, r.user_id, r.name, r.avatar_url, r.their_role, r.cover, r.credits,
    r.vibes, r.mutual,
    concat_ws(' · ',
      CASE WHEN r.mutual > 0 THEN 'Worked with ' || r.mutual || ' of your people' END,
      CASE WHEN cardinality(r.vibes) > 0 THEN array_to_string(r.vibes[1:2], ', ') END,
      CASE WHEN r.credits > 0 THEN r.credits || CASE WHEN r.credits = 1 THEN ' confirmed credit' ELSE ' confirmed credits' END END
    ),
    r.s
  FROM ranked r
  WHERE r.rn <= greatest(least(p_per_role, 10), 1)
  ORDER BY r.need, r.rn;
END;
$$;

REVOKE ALL ON FUNCTION public.suggest_crew(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_crew(UUID, INT) TO authenticated;

-- Invite one person to one role. Sends the opening message through
-- start_conversation, so the message floor, blocks and push all apply.
-- Crew invites have their own ceiling (8 per shoot, 3 shoots a day) instead
-- of the five-a-day cold-message cap, which a four-person shoot would hit.
CREATE OR REPLACE FUNCTION public.invite_to_shoot(p_post UUID, p_user UUID, p_role TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me    UUID := auth.uid();
  v_post  public.collab_posts%ROWTYPE;
  v_name  TEXT;
  v_when  TEXT;
  v_match UUID;
  v_body  TEXT;
BEGIN
  SELECT * INTO v_post FROM public.collab_posts WHERE id = p_post AND owner_id = v_me;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the person planning this shoot can invite people to it.';
  END IF;
  IF p_user = v_me THEN
    RAISE EXCEPTION 'You can''t invite yourself.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shoot_invites WHERE post_id = p_post AND user_id = p_user) THEN
    RAISE EXCEPTION 'Already invited.';
  END IF;
  IF (SELECT count(*) FROM public.shoot_invites WHERE post_id = p_post) >= 8 THEN
    RAISE EXCEPTION 'That''s eight invites for this shoot. Wait for some answers first.';
  END IF;
  IF (SELECT count(DISTINCT si.post_id) FROM public.shoot_invites si
      JOIN public.collab_posts p ON p.id = si.post_id
      WHERE p.owner_id = v_me AND si.created_at > now() - interval '24 hours'
        AND si.post_id <> p_post) >= 3 THEN
    RAISE EXCEPTION 'You''ve sent invites for three shoots today. Try again tomorrow.';
  END IF;
  IF NOT COALESCE(public.meets_message_floor(v_me), false) THEN
    RAISE EXCEPTION 'Add a photo and your role before inviting people.';
  END IF;
  IF public.is_blocked_pair(v_me, p_user) THEN
    RAISE EXCEPTION 'You can''t invite this person.';
  END IF;

  SELECT name INTO v_name FROM public.profiles WHERE user_id = v_me;
  v_when := CASE WHEN v_post.project_start IS NOT NULL
                 THEN ' on ' || to_char(v_post.project_start, 'Mon FMDD') ELSE '' END;
  v_body := format('Hi! I''m putting together a shoot%s: "%s". Would you be up for %s? Tap the shoot to say yes or no.',
                   v_when, v_post.title, lower(p_role));

  -- Reuse the conversation machinery directly rather than calling
  -- start_conversation, whose cold cap is the wrong limit here.
  SELECT id INTO v_match FROM public.matches
  WHERE user1_id = least(v_me, p_user) AND user2_id = greatest(v_me, p_user);
  IF v_match IS NULL THEN
    INSERT INTO public.matches (user1_id, user2_id, post1_id, post2_id, origin, origin_id, started_by)
    VALUES (least(v_me, p_user), greatest(v_me, p_user),
            CASE WHEN v_me < p_user THEN p_post END,
            CASE WHEN v_me > p_user THEN p_post END,
            'project', p_post, v_me)
    ON CONFLICT (user1_id, user2_id) DO NOTHING
    RETURNING id INTO v_match;
    IF v_match IS NULL THEN
      SELECT id INTO v_match FROM public.matches
      WHERE user1_id = least(v_me, p_user) AND user2_id = greatest(v_me, p_user);
    END IF;
  END IF;

  INSERT INTO public.messages (match_id, sender_id, content) VALUES (v_match, v_me, v_body);
  INSERT INTO public.shoot_invites (post_id, user_id, role, match_id)
  VALUES (p_post, p_user, p_role, v_match);
  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_to_shoot(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_to_shoot(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_shoot_invite(p_post UUID, p_accept BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     UUID := auth.uid();
  v_status TEXT := CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
BEGIN
  UPDATE public.shoot_invites
  SET status = v_status, updated_at = now()
  WHERE post_id = p_post AND user_id = v_me;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No invite to answer.';
  END IF;
  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_shoot_invite(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_shoot_invite(UUID, BOOLEAN) TO authenticated;

-- Everything the Shoot tab lists: shoots I'm planning, with their crew,
-- and shoots I've been invited to.
CREATE OR REPLACE FUNCTION public.my_shoots()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'planning', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'post_id', p.id, 'title', p.title, 'start', p.project_start,
        'location', p.location, 'roles', to_jsonb(coalesce(nullif(p.roles, '{}'), p.looking_for)),
        'cover_url', p.media_urls[1], 'is_active', p.is_active,
        'crew', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'user_id', si.user_id, 'name', pr.name, 'avatar_url', pr.avatar_url,
            'role', si.role, 'status', si.status, 'match_id', si.match_id)
            ORDER BY si.created_at)
          FROM public.shoot_invites si
          LEFT JOIN public.profiles pr ON pr.user_id = si.user_id
          WHERE si.post_id = p.id), '[]'::jsonb)
      ) ORDER BY p.created_at DESC)
      FROM public.collab_posts p
      WHERE p.owner_id = auth.uid()), '[]'::jsonb),
    'invited', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'post_id', p.id, 'title', p.title, 'start', p.project_start,
        'location', p.location, 'cover_url', p.media_urls[1],
        'role', si.role, 'status', si.status, 'match_id', si.match_id,
        'owner', jsonb_build_object('user_id', p.owner_id, 'name', o.name, 'avatar_url', o.avatar_url))
        ORDER BY si.created_at DESC)
      FROM public.shoot_invites si
      JOIN public.collab_posts p ON p.id = si.post_id
      LEFT JOIN public.profiles o ON o.user_id = p.owner_id
      WHERE si.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.my_shoots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_shoots() TO authenticated;
