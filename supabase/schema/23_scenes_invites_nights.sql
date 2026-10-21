-- ============================================================
-- 23_scenes_invites_nights.sql — "where young creatives find their crew:
-- the people, the nights, the ideas"
--
-- What this adds, in the order a new person meets it:
--
-- 1. SCENES and INVITES. Melange is invite-only. Every member has five
--    codes; a code puts you in a scene (USC, UCSD, LA, NYC). People
--    without one join the waitlist. Founding members carry a mark.
--    Everyone who was already a member is grandfathered in.
-- 2. NIGHT CHATS. Everyone going to an event (and its host) shares one
--    group chat for it, before and after.
-- 3. AFTERGLOW. For three days after a night, the people who were there
--    can heart each other. Nobody is told about a heart; only a mutual one
--    reveals, and it opens a regular conversation.
-- 4. PUBLIC PROFILES. A handle makes a profile viewable signed out at
--    /@handle, for Instagram bios. No handle, no public page.
-- 5. CURATION. Editors can feature a shoot; scenes on events let Explore
--    show what's on near you.
--
-- Safe to run more than once. Apply AFTER 22_crew_and_credits.sql.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 1. Scenes, membership, founding, handles
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scene        TEXT,
  ADD COLUMN IF NOT EXISTS handle       TEXT,
  ADD COLUMN IF NOT EXISTS founding     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_since TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_scene_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_scene_check
      CHECK (scene IS NULL OR scene IN ('usc', 'ucsd', 'la', 'nyc'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_handle_format_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_handle_format_check
      CHECK (handle IS NULL OR handle ~ '^[a-z0-9._]{3,30}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles (handle) WHERE handle IS NOT NULL;

-- Everyone already here is a member.
UPDATE public.profiles SET member_since = coalesce(created_at, now())
WHERE member_since IS NULL;

-- founding, invited_by and member_since are set by the server only, the
-- same way 21_trust_and_support.sql guards verification_status.
CREATE OR REPLACE FUNCTION public.guard_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.founding := false;
      NEW.invited_by := NULL;
      NEW.member_since := NULL;
    ELSE
      NEW.founding := OLD.founding;
      NEW.invited_by := OLD.invited_by;
      NEW.member_since := OLD.member_since;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_membership ON public.profiles;
CREATE TRIGGER trg_guard_membership
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_membership();

CREATE OR REPLACE FUNCTION public.is_member(p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user AND member_since IS NOT NULL);
$$;

GRANT EXECUTE ON FUNCTION public.is_member(UUID) TO authenticated;

-- Claim or change your handle. Lowercased; letters, numbers, dot, underscore.
CREATE OR REPLACE FUNCTION public.set_handle(p_handle TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_h TEXT := lower(btrim(coalesce(p_handle, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  v_h := ltrim(v_h, '@');
  IF v_h = '' THEN
    UPDATE public.profiles SET handle = NULL WHERE user_id = auth.uid();
    RETURN NULL;
  END IF;
  IF v_h !~ '^[a-z0-9._]{3,30}$' THEN
    RAISE EXCEPTION 'Handles are 3–30 letters, numbers, dots or underscores.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = v_h AND user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'That handle is taken.';
  END IF;
  UPDATE public.profiles SET handle = v_h WHERE user_id = auth.uid();
  RETURN v_h;
END;
$$;

REVOKE ALL ON FUNCTION public.set_handle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_handle(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Invite codes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invite_codes (
  code        TEXT PRIMARY KEY,
  owner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = an admin launch code
  scene       TEXT CHECK (scene IS NULL OR scene IN ('usc', 'ucsd', 'la', 'nyc')),
  max_uses    INT NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses        INT NOT NULL DEFAULT 0,
  founding    BOOLEAN NOT NULL DEFAULT false,  -- redeeming makes you a founding member
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invite_codes_owner ON public.invite_codes(owner_id);
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;  -- RPCs only

CREATE TABLE IF NOT EXISTS public.invite_redemptions (
  code        TEXT NOT NULL REFERENCES public.invite_codes(code) ON DELETE CASCADE,
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)
);
ALTER TABLE public.invite_redemptions ENABLE ROW LEVEL SECURITY;  -- RPCs only

-- A member's five codes, made the first time they're asked for. Codes are
-- short and readable: MEL-XXXXX, no 0/O/1/I.
CREATE OR REPLACE FUNCTION public.my_invite_codes()
RETURNS TABLE (code TEXT, used BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  v_me    UUID := auth.uid();
  v_scene TEXT;
  v_have  INT;
  v_code  TEXT;
  v_alpha CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
BEGIN
  IF NOT public.is_member(v_me) THEN
    RAISE EXCEPTION 'Only members have invites.';
  END IF;
  SELECT scene INTO v_scene FROM public.profiles WHERE user_id = v_me;
  SELECT count(*) INTO v_have FROM public.invite_codes WHERE owner_id = v_me;
  WHILE v_have < 5 LOOP
    v_code := 'MEL-';
    FOR i IN 1..5 LOOP
      v_code := v_code || substr(v_alpha, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    END LOOP;
    BEGIN
      INSERT INTO public.invite_codes (code, owner_id, scene) VALUES (v_code, v_me, v_scene);
      v_have := v_have + 1;
    EXCEPTION WHEN unique_violation THEN
      -- collided with an existing code; try another
    END;
  END LOOP;
  RETURN QUERY
    SELECT ic.code, ic.uses >= ic.max_uses
    FROM public.invite_codes ic
    WHERE ic.owner_id = v_me
    ORDER BY ic.uses >= ic.max_uses, ic.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.my_invite_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_invite_codes() TO authenticated;

-- Redeem a code: you're in. Sets scene (if you don't have one yet),
-- invited_by, member_since, and founding when it's a founding code.
CREATE OR REPLACE FUNCTION public.redeem_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   UUID := auth.uid();
  v_code public.invite_codes%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;
  IF public.is_member(v_me) THEN
    RETURN jsonb_build_object('ok', true, 'already_member', true);
  END IF;

  SELECT * INTO v_code FROM public.invite_codes
  WHERE code = upper(btrim(coalesce(p_code, '')))
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That code doesn''t work. Check it with whoever sent it.';
  END IF;
  IF v_code.uses >= v_code.max_uses THEN
    RAISE EXCEPTION 'That code has already been used.';
  END IF;
  IF v_code.owner_id = v_me THEN
    RAISE EXCEPTION 'That''s your own code. Send it to a friend.';
  END IF;

  UPDATE public.invite_codes SET uses = uses + 1 WHERE code = v_code.code;
  INSERT INTO public.invite_redemptions (code, user_id) VALUES (v_code.code, v_me);
  UPDATE public.profiles
  SET member_since = now(),
      invited_by   = v_code.owner_id,
      scene        = coalesce(scene, v_code.scene),
      founding     = founding OR v_code.founding
  WHERE user_id = v_me;

  RETURN jsonb_build_object('ok', true, 'scene', v_code.scene, 'founding', v_code.founding);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite(TEXT) TO authenticated;

-- Members choose their scene once they're in.
CREATE OR REPLACE FUNCTION public.set_scene(p_scene TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_scene IS NOT NULL AND p_scene NOT IN ('usc', 'ucsd', 'la', 'nyc') THEN
    RAISE EXCEPTION 'Unknown scene.';
  END IF;
  UPDATE public.profiles SET scene = p_scene WHERE user_id = auth.uid();
  RETURN p_scene;
END;
$$;

REVOKE ALL ON FUNCTION public.set_scene(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_scene(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Waitlist (signed out is fine; limited like support_requests)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 200),
  name       TEXT CHECK (name IS NULL OR length(btrim(name)) <= 100),
  scene      TEXT CHECK (scene IS NULL OR scene IN ('usc', 'ucsd', 'la', 'nyc', 'other')),
  instagram  TEXT CHECK (instagram IS NULL OR length(instagram) <= 100),
  what_you_make TEXT CHECK (what_you_make IS NULL OR length(what_you_make) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist (lower(email));
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.limit_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.waitlist WHERE created_at > now() - interval '1 hour') >= 200 THEN
    RAISE EXCEPTION 'The waitlist is busy. Try again in an hour.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limit_waitlist ON public.waitlist;
CREATE TRIGGER trg_limit_waitlist
  BEFORE INSERT ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.limit_waitlist();

-- ------------------------------------------------------------
-- 2. Nights: scene on events, and one group chat per event
-- ------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS scene TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_scene_check') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_scene_check
      CHECK (scene IS NULL OR scene IN ('usc', 'ucsd', 'la', 'nyc'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_event_member(p_event UUID, p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event AND e.host_id = p_user)
      OR EXISTS (SELECT 1 FROM public.event_rsvps r
                 WHERE r.event_id = p_event AND r.user_id = p_user AND r.state = 'going');
$$;

GRANT EXECUTE ON FUNCTION public.is_event_member(UUID, UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.event_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_messages_event ON public.event_messages(event_id, created_at);
ALTER TABLE public.event_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event members read the night chat" ON public.event_messages;
CREATE POLICY "Event members read the night chat"
  ON public.event_messages FOR SELECT
  TO authenticated
  USING (public.is_event_member(event_id)
         AND NOT public.is_blocked_pair(auth.uid(), sender_id));

DROP POLICY IF EXISTS "Event members write to the night chat" ON public.event_messages;
CREATE POLICY "Event members write to the night chat"
  ON public.event_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_event_member(event_id));

DROP POLICY IF EXISTS "Senders delete their own night messages" ON public.event_messages;
CREATE POLICY "Senders delete their own night messages"
  ON public.event_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_messages;
  END IF;
END $$;

-- Reports can now point at night messages too.
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_kind_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_target_kind_check
  CHECK (target_kind IN ('user', 'post', 'message', 'event_message', 'story', 'event'));

-- Afterglow hearts (section 3) live here because event_people reads them.
CREATE TABLE IF NOT EXISTS public.event_hearts (
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  from_user  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, from_user, to_user),
  CHECK (from_user <> to_user)
);
-- RLS on, no policies: nobody can read who hearted them. Only the RPCs
-- below touch this table, and they reveal a heart only when it's mutual.
ALTER TABLE public.event_hearts ENABLE ROW LEVEL SECURITY;

-- Who's going, for the night's page. Members of the night see each other.
CREATE OR REPLACE FUNCTION public.event_people(p_event UUID)
RETURNS TABLE (user_id UUID, name TEXT, avatar_url TEXT, role TEXT, handle TEXT, is_host BOOLEAN, i_hearted BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH people AS (
    SELECT e.host_id AS uid, true AS host FROM public.events e WHERE e.id = p_event
    UNION
    SELECT r.user_id, false FROM public.event_rsvps r WHERE r.event_id = p_event AND r.state = 'going'
  )
  SELECT p.user_id, p.name, p.avatar_url, p.role, p.handle, bool_or(pe.host),
         EXISTS (SELECT 1 FROM public.event_hearts h
                 WHERE h.event_id = p_event AND h.from_user = auth.uid() AND h.to_user = p.user_id)
  FROM people pe
  JOIN public.profiles p ON p.user_id = pe.uid
  WHERE public.is_event_member(p_event)
    AND NOT public.is_blocked_pair(auth.uid(), p.user_id)
  GROUP BY p.user_id, p.name, p.avatar_url, p.role, p.handle;
$$;

-- ------------------------------------------------------------
-- 3. Afterglow: hearts between people from the same night
-- ------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.event_people(UUID) TO authenticated;

-- Heart (or un-heart) someone from a night. Open from the start of the
-- night until three days after it ends. If they hearted you too, a
-- conversation opens (origin 'event') and both of you are told.
CREATE OR REPLACE FUNCTION public.toggle_event_heart(p_event UUID, p_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me    UUID := auth.uid();
  v_ev    public.events%ROWTYPE;
  v_match UUID;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT * INTO v_ev FROM public.events WHERE id = p_event;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That night doesn''t exist.';
  END IF;
  IF NOT public.is_event_member(p_event, v_me) OR NOT public.is_event_member(p_event, p_user) THEN
    RAISE EXCEPTION 'You can only heart people who were at the same night.';
  END IF;
  IF now() < v_ev.start_at OR now() > coalesce(v_ev.end_at, v_ev.start_at + interval '6 hours') + interval '3 days' THEN
    RAISE EXCEPTION 'Hearts open when the night starts and close three days after.';
  END IF;
  IF public.is_blocked_pair(v_me, p_user) THEN
    RAISE EXCEPTION 'You can''t heart this person.';
  END IF;

  DELETE FROM public.event_hearts WHERE event_id = p_event AND from_user = v_me AND to_user = p_user;
  IF FOUND THEN
    RETURN jsonb_build_object('hearted', false, 'mutual', false);
  END IF;

  INSERT INTO public.event_hearts (event_id, from_user, to_user) VALUES (p_event, v_me, p_user);

  IF NOT EXISTS (SELECT 1 FROM public.event_hearts
                 WHERE event_id = p_event AND from_user = p_user AND to_user = v_me) THEN
    RETURN jsonb_build_object('hearted', true, 'mutual', false);
  END IF;

  SELECT id INTO v_match FROM public.matches
  WHERE user1_id = least(v_me, p_user) AND user2_id = greatest(v_me, p_user);
  IF v_match IS NULL THEN
    INSERT INTO public.matches (user1_id, user2_id, origin, origin_id, started_by)
    VALUES (least(v_me, p_user), greatest(v_me, p_user), 'event', p_event, v_me)
    ON CONFLICT (user1_id, user2_id) DO NOTHING
    RETURNING id INTO v_match;
    IF v_match IS NULL THEN
      SELECT id INTO v_match FROM public.matches
      WHERE user1_id = least(v_me, p_user) AND user2_id = greatest(v_me, p_user);
    END IF;
  END IF;

  RETURN jsonb_build_object('hearted', true, 'mutual', true, 'match_id', v_match);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_event_heart(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_event_heart(UUID, UUID) TO authenticated;

-- My mutuals from a night (what the Afterglow screen shows after hearting).
CREATE OR REPLACE FUNCTION public.my_event_mutuals(p_event UUID)
RETURNS TABLE (user_id UUID, name TEXT, avatar_url TEXT, match_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.avatar_url, m.id
  FROM public.event_hearts mine
  JOIN public.event_hearts theirs
    ON theirs.event_id = mine.event_id AND theirs.from_user = mine.to_user AND theirs.to_user = mine.from_user
  JOIN public.profiles p ON p.user_id = mine.to_user
  LEFT JOIN public.matches m
    ON m.user1_id = least(mine.from_user, mine.to_user) AND m.user2_id = greatest(mine.from_user, mine.to_user)
  WHERE mine.event_id = p_event AND mine.from_user = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_event_mutuals(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_event_mutuals(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 4. Public profiles by handle (signed out)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile(p_handle TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'handle', p.handle,
    'name', p.name,
    'role', p.role,
    'bio', p.bio,
    'avatar_url', p.avatar_url,
    'portfolio_urls', to_jsonb(coalesce(p.portfolio_urls, '{}')),
    'scene', p.scene,
    'founding', p.founding,
    'instagram_url', p.instagram_url,
    'confirmed_credits', (SELECT count(*) FROM public.credit_confirmations cc
                          JOIN public.collab_stories s ON s.id = cc.story_id AND s.is_public
                          WHERE cc.user_id = p.user_id),
    'shoots', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'cover_url', s.media_urls[1])
                       ORDER BY s.created_at DESC)
      FROM public.collab_stories s
      WHERE s.is_public
        AND (s.author_id = p.user_id
             OR s.credits @> jsonb_build_array(jsonb_build_object('user_id', p.user_id::text)))
    ), '[]'::jsonb)
  )
  FROM public.profiles p
  WHERE p.handle = lower(ltrim(btrim(coalesce(p_handle, '')), '@'))
    AND p.member_since IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- 5. Curation
-- ------------------------------------------------------------
ALTER TABLE public.collab_stories ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_collab_stories_featured
  ON public.collab_stories(featured_at DESC) WHERE featured_at IS NOT NULL;

-- Only admins feature a shoot.
CREATE OR REPLACE FUNCTION public.set_featured(p_story UUID, p_on BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only editors can feature a shoot.';
  END IF;
  UPDATE public.collab_stories
  SET featured_at = CASE WHEN p_on THEN now() ELSE NULL END
  WHERE id = p_story;
  RETURN p_on;
END;
$$;

REVOKE ALL ON FUNCTION public.set_featured(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_featured(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
