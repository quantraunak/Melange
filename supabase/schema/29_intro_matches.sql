-- ============================================================
-- 29_intro_matches.sql — hand-picked matches
--
-- Schools send students a Google Form. Each response becomes an APPLICANT
-- (posted in by app/api/applicants, server-side, with the service role). An
-- admin pairs people by hand on /internal/matches: an applicant with an
-- applicant, or with an existing Melange user. A pairing is an INTRO MATCH.
-- Every intro starts as a draft only admins can see, is approved, and only
-- appears to the two people once the admin has contacted them and marked it
-- sent. ("intro" and not "match": public.matches is already every
-- conversation in the app.)
--
-- Who is who:
--   applicants and intro_matches have RLS on and NO policies. No client can
--   read or write them. Admins act through the admin_* functions below, each
--   of which refuses anyone not in app_admins. Students read only their own
--   SENT intros through my_intros().
--
-- How a student's account finds their intros:
--   by their account (when the admin paired an existing user), or by email:
--   the applicant's form email equals the account's email, the account's
--   email is confirmed, and the account was created after confirmations were
--   switched on (melange_settings.emails_confirmed_since). Until that date is
--   set, nothing links by email. Confirmation was off when this was written,
--   so any older account's email was never proven to belong to its owner.
--
-- Messaging is unchanged except for has_inbound_interest(), the one check that
-- lets someone skip the profile floor and the five-a-day limit: a sent intro
-- now counts, like a heart.
--
-- Safe to run more than once. Apply after 28.
-- Then, once email confirmation is switched on in Supabase Auth (see
-- docs/MATCHING.md):
--   UPDATE public.melange_settings SET emails_confirmed_since = now();
-- ============================================================

-- ------------------------------------------------------------
-- 1. Settings: one row
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.melange_settings (
  id                      BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  emails_confirmed_since  TIMESTAMPTZ
);
INSERT INTO public.melange_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.melange_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. Applicants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applicants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND email LIKE '%_@_%'),
  name            TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  school          TEXT,
  phone           TEXT,
  contact_pref    TEXT CHECK (contact_pref IS NULL OR contact_pref IN ('email', 'text', 'instagram')),
  instagram       TEXT,
  makes           TEXT[] NOT NULL DEFAULT '{}'::text[]
                  CHECK (makes <@ ARRAY['film','photo','writing','music','art','design','other']::text[]),
  -- "Who are you looking for?" (tick boxes), and the optional note after it.
  looking_for     TEXT[] NOT NULL DEFAULT '{}'::text[]
                  CHECK (looking_for <@ ARRAY['model','photographer','videographer_editor',
                    'illustrator_artist','writer_poet','musician_producer','actor_performer',
                    'designer','other']::text[]),
  looking_for_note TEXT CHECK (looking_for_note IS NULL OR length(looking_for_note) <= 1000),
  intent          TEXT CHECK (intent IS NULL OR intent IN ('idea', 'join', 'both')),
  idea            TEXT CHECK (idea IS NULL OR length(idea) <= 2000),
  time_available  TEXT CHECK (time_available IS NULL OR time_available IN ('weekend', 'few_weeks', 'ongoing')),
  work_link       TEXT,
  -- Only consenting people are imported at all (the endpoint refuses the rest),
  -- so this is always true; it is kept as the record that they said yes.
  consent         BOOLEAN NOT NULL CHECK (consent),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'matched', 'waiting')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. Intro matches
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intro_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  a_applicant_id  UUID REFERENCES public.applicants(id) ON DELETE CASCADE,
  a_user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  b_applicant_id  UUID REFERENCES public.applicants(id) ON DELETE CASCADE,
  b_user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  note            TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  CHECK ((a_applicant_id IS NULL) <> (a_user_id IS NULL)),
  CHECK ((b_applicant_id IS NULL) <> (b_user_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_intro_a_app  ON public.intro_matches(a_applicant_id);
CREATE INDEX IF NOT EXISTS idx_intro_b_app  ON public.intro_matches(b_applicant_id);
CREATE INDEX IF NOT EXISTS idx_intro_a_user ON public.intro_matches(a_user_id);
CREATE INDEX IF NOT EXISTS idx_intro_b_user ON public.intro_matches(b_user_id);
ALTER TABLE public.intro_matches ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4. Who a side is
-- ------------------------------------------------------------

-- The account an applicant's email belongs to, if it can be trusted: same
-- email, confirmed, and created after confirmations were switched on.
CREATE OR REPLACE FUNCTION public.applicant_user_id(p_applicant UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.applicants a
  JOIN auth.users u ON lower(u.email) = a.email
  CROSS JOIN public.melange_settings s
  WHERE a.id = p_applicant
    AND s.id
    AND s.emails_confirmed_since IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND u.created_at >= s.emails_confirmed_since
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.applicant_user_id(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.intro_side_user(p_applicant UUID, p_user UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p_user, public.applicant_user_id(p_applicant));
$$;
REVOKE ALL ON FUNCTION public.intro_side_user(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- A sent intro between these two accounts, either way round.
CREATE OR REPLACE FUNCTION public.intro_sent_between(p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_a IS NOT NULL AND p_b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.intro_matches i
    WHERE i.status = 'sent'
      AND (
        (public.intro_side_user(i.a_applicant_id, i.a_user_id) = p_a
         AND public.intro_side_user(i.b_applicant_id, i.b_user_id) = p_b)
        OR
        (public.intro_side_user(i.a_applicant_id, i.a_user_id) = p_b
         AND public.intro_side_user(i.b_applicant_id, i.b_user_id) = p_a)
      )
  );
$$;
REVOKE ALL ON FUNCTION public.intro_sent_between(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- How many intros (any status) a side is already in. The cap is three.
CREATE OR REPLACE FUNCTION public.intro_count(p_applicant UUID, p_user UUID, p_except UUID DEFAULT NULL)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.intro_matches i
  WHERE (p_except IS NULL OR i.id <> p_except)
    AND (
      (p_applicant IS NOT NULL AND p_applicant IN (i.a_applicant_id, i.b_applicant_id))
      OR (p_user IS NOT NULL AND p_user IN (i.a_user_id, i.b_user_id))
    );
$$;
REVOKE ALL ON FUNCTION public.intro_count(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Messaging: a sent intro counts like a heart
--
-- Same as 21_trust_and_support.sql, plus sent intros, and it now only
-- answers about the person asking (every caller passes auth.uid() as p_me),
-- which also closes the who-likes-whom read 28 noted for signed-in users.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_inbound_interest(p_me UUID, p_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_me IS NOT NULL AND p_me = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM public.hearts h
      WHERE h.from_user = p_other AND h.to_user = p_me
    ) OR EXISTS (
      SELECT 1 FROM public.swipes s
      JOIN public.collab_posts p ON p.id = s.post_id
      WHERE s.direction = 'right' AND s.swiper_id = p_other AND p.owner_id = p_me
    )
    OR public.intro_sent_between(p_me, p_other)
  );
$$;

-- Same as 21_trust_and_support.sql except the reach_outs log: a conversation
-- with someone you share a sent intro or their heart with is no longer
-- recorded there, so it never counts toward the five-a-day limit later.
CREATE OR REPLACE FUNCTION public.start_conversation(
  p_other     UUID,
  p_message   TEXT,
  p_origin    TEXT DEFAULT 'profile',
  p_origin_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      UUID := auth.uid();
  v_body    TEXT := btrim(coalesce(p_message, ''));
  v_user1   UUID;
  v_user2   UUID;
  v_match   UUID;
  v_post    UUID;
  v_post1   UUID;
  v_post2   UUID;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_other IS NULL OR p_other = v_me THEN
    RAISE EXCEPTION 'You can''t message yourself.';
  END IF;
  IF p_origin NOT IN ('project', 'profile', 'event', 'story') THEN
    RAISE EXCEPTION 'unknown origin %', p_origin;
  END IF;
  IF length(v_body) = 0 THEN
    RAISE EXCEPTION 'Write a message first.';
  END IF;
  IF length(v_body) > 2000 THEN
    RAISE EXCEPTION 'That message is too long.';
  END IF;

  -- No bar when you already have a thread, or when THEY hearted or liked
  -- you first. A heart you sent yourself does not count.
  IF NOT EXISTS (
       SELECT 1 FROM public.matches m
       WHERE (m.user1_id = v_me AND m.user2_id = p_other)
          OR (m.user1_id = p_other AND m.user2_id = v_me)
     )
     AND NOT public.has_inbound_interest(v_me, p_other)
     AND NOT COALESCE(public.meets_message_floor(v_me), false) THEN
    RAISE EXCEPTION 'Add a photo and your role before messaging someone new.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_other) THEN
    RAISE EXCEPTION 'That person''s account no longer exists.';
  END IF;
  IF public.is_blocked_pair(v_me, p_other) THEN
    RAISE EXCEPTION 'You can''t message this person.';
  END IF;

  IF v_me < p_other THEN
    v_user1 := v_me;    v_user2 := p_other;
  ELSE
    v_user1 := p_other; v_user2 := v_me;
  END IF;

  SELECT id INTO v_match
  FROM public.matches
  WHERE user1_id = v_user1 AND user2_id = v_user2;

  IF v_match IS NULL THEN
    -- Writing back to someone who reached for you first is not a cold
    -- approach. Everything else counts against the five.
    IF NOT public.has_inbound_interest(v_me, p_other) AND (
      SELECT count(*) FROM public.reach_outs
      WHERE sender_id = v_me AND created_at > now() - interval '24 hours'
    ) >= 5 THEN
      RAISE EXCEPTION 'You''ve started a lot of conversations today. Try again tomorrow.';
    END IF;

    IF p_origin = 'project' AND p_origin_id IS NOT NULL THEN
      SELECT id INTO v_post
      FROM public.collab_posts
      WHERE id = p_origin_id AND owner_id = p_other;
    END IF;
    IF v_post IS NOT NULL THEN
      IF p_other = v_user1 THEN v_post1 := v_post; ELSE v_post2 := v_post; END IF;
    END IF;

    INSERT INTO public.matches (user1_id, user2_id, post1_id, post2_id, origin, origin_id, started_by)
    VALUES (v_user1, v_user2, v_post1, v_post2, p_origin, p_origin_id, v_me)
    ON CONFLICT (user1_id, user2_id) DO NOTHING
    RETURNING id INTO v_match;

    IF v_match IS NULL THEN
      SELECT id INTO v_match
      FROM public.matches
      WHERE user1_id = v_user1 AND user2_id = v_user2;
    ELSIF NOT public.has_inbound_interest(v_me, p_other) THEN
      -- Only cold approaches go in the log the daily limit counts. Writing to
      -- a sent intro (or to someone who reached for you first) is not one.
      INSERT INTO public.reach_outs (sender_id, other_id) VALUES (v_me, p_other);
    END IF;
  END IF;

  INSERT INTO public.messages (match_id, sender_id, content)
  VALUES (v_match, v_me, v_body);

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.start_conversation(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_conversation(UUID, TEXT, TEXT, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 6. Students: your own sent intros
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_intros()
RETURNS TABLE (
  intro_id        UUID,
  sent_at         TIMESTAMPTZ,
  note            TEXT,
  other_user_id   UUID,
  other_name      TEXT,
  other_makes     TEXT[],
  other_role      TEXT,
  other_idea      TEXT,
  other_avatar    TEXT,
  other_looking_for TEXT[],
  other_looking_for_note TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS id),
  mine AS (
    SELECT i.*,
      CASE WHEN public.intro_side_user(i.a_applicant_id, i.a_user_id) = me.id THEN 'a' ELSE 'b' END AS my_side
    FROM public.intro_matches i, me
    WHERE me.id IS NOT NULL
      AND i.status = 'sent'
      AND me.id IN (
        public.intro_side_user(i.a_applicant_id, i.a_user_id),
        public.intro_side_user(i.b_applicant_id, i.b_user_id)
      )
  ),
  other AS (
    SELECT m.id, m.sent_at, m.note,
      CASE WHEN m.my_side = 'a' THEN m.b_applicant_id ELSE m.a_applicant_id END AS o_app,
      CASE WHEN m.my_side = 'a' THEN m.b_user_id ELSE m.a_user_id END AS o_user
    FROM mine m
  )
  SELECT
    o.id,
    o.sent_at,
    o.note,
    public.intro_side_user(o.o_app, o.o_user),
    COALESCE(a.name, p.name, 'Someone'),
    COALESCE(a.makes, '{}'::text[]),
    p.role,
    a.idea,
    p.avatar_url,
    COALESCE(a.looking_for, '{}'::text[]),
    a.looking_for_note
  FROM other o
  LEFT JOIN public.applicants a ON a.id = o.o_app
  LEFT JOIN public.profiles p ON p.user_id = public.intro_side_user(o.o_app, o.o_user)
  WHERE NOT COALESCE(public.is_blocked_pair(auth.uid(), public.intro_side_user(o.o_app, o.o_user)), false)
  ORDER BY o.sent_at DESC NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.my_intros() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_intros() TO authenticated;

-- The "meet more people" prompt, once per person. True the first time only.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS intro_nudge_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_intro_nudge()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT;
BEGIN
  UPDATE public.profiles SET intro_nudge_seen_at = now()
  WHERE user_id = auth.uid() AND intro_nudge_seen_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_intro_nudge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_intro_nudge() TO authenticated;

-- ------------------------------------------------------------
-- 7. Admin: everything below refuses anyone not in app_admins
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_admin() FROM PUBLIC, anon, authenticated;

-- One side, described for the admin page: who they are, everything they
-- answered, how to reach them, and whether they have an account.
CREATE OR REPLACE FUNCTION public.intro_side_json(p_applicant UUID, p_user UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_applicant IS NOT NULL THEN (
      SELECT jsonb_build_object(
        'kind', 'applicant', 'id', a.id, 'name', a.name, 'school', a.school,
        'email', a.email, 'phone', a.phone, 'contact_pref', a.contact_pref,
        'instagram', a.instagram, 'makes', to_jsonb(a.makes),
        'looking_for', to_jsonb(a.looking_for), 'looking_for_note', a.looking_for_note,
        'intent', a.intent, 'idea', a.idea, 'time_available', a.time_available,
        'work_link', a.work_link, 'consent', a.consent,
        'user_id', public.applicant_user_id(a.id))
      FROM public.applicants a WHERE a.id = p_applicant)
    ELSE (
      SELECT jsonb_build_object(
        'kind', 'user', 'id', p.user_id, 'name', p.name, 'school', NULL,
        'email', u.email, 'phone', NULL, 'contact_pref', 'email',
        'instagram', p.instagram_url, 'makes', '[]'::jsonb, 'role', p.role,
        'looking_for', '[]'::jsonb, 'looking_for_note', NULL,
        'intent', NULL, 'idea', p.current_project,
        'time_available', NULL, 'work_link', p.reel_url, 'consent', true,
        'user_id', p.user_id)
      FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
      WHERE p.user_id = p_user)
  END;
$$;
REVOKE ALL ON FUNCTION public.intro_side_json(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_intro_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN jsonb_build_object(
    'applicants', (SELECT count(*) FROM public.applicants),
    'drafts',     (SELECT count(*) FROM public.intro_matches WHERE status = 'draft'),
    'approved',   (SELECT count(*) FROM public.intro_matches WHERE status = 'approved'),
    'sent',       (SELECT count(*) FROM public.intro_matches WHERE status = 'sent'),
    'waiting',    (SELECT count(*) FROM public.applicants WHERE status = 'waiting'),
    'signed_up',  (SELECT count(DISTINCT a.id) FROM public.applicants a
                   WHERE public.applicant_user_id(a.id) IS NOT NULL
                     AND EXISTS (SELECT 1 FROM public.intro_matches i
                                 WHERE a.id IN (i.a_applicant_id, i.b_applicant_id)))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_applicants()
RETURNS TABLE (
  id UUID, email TEXT, name TEXT, school TEXT, phone TEXT, contact_pref TEXT,
  instagram TEXT, makes TEXT[], looking_for TEXT[], looking_for_note TEXT, intent TEXT, idea TEXT,
  time_available TEXT, work_link TEXT, consent BOOLEAN, submitted_at TIMESTAMPTZ,
  status TEXT, drafts INT, approved INT, sent INT, user_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN QUERY
  SELECT a.id, a.email, a.name, a.school, a.phone, a.contact_pref, a.instagram,
         a.makes, a.looking_for, a.looking_for_note, a.intent, a.idea, a.time_available, a.work_link,
         a.consent, a.submitted_at, a.status,
         (SELECT count(*)::int FROM public.intro_matches i
           WHERE a.id IN (i.a_applicant_id, i.b_applicant_id) AND i.status = 'draft'),
         (SELECT count(*)::int FROM public.intro_matches i
           WHERE a.id IN (i.a_applicant_id, i.b_applicant_id) AND i.status = 'approved'),
         (SELECT count(*)::int FROM public.intro_matches i
           WHERE a.id IN (i.a_applicant_id, i.b_applicant_id) AND i.status = 'sent'),
         public.applicant_user_id(a.id)
  FROM public.applicants a
  ORDER BY a.submitted_at DESC;
END;
$$;

-- Existing Melange people, to pair an applicant with.
CREATE OR REPLACE FUNCTION public.admin_search_users(p_query TEXT)
RETURNS TABLE (user_id UUID, name TEXT, role TEXT, handle TEXT, email TEXT, intros INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN QUERY
  SELECT p.user_id, p.name, p.role, p.handle, u.email::text,
         public.intro_count(NULL, p.user_id)
  FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
  WHERE coalesce(btrim(p_query), '') = ''
     OR p.name ILIKE '%' || btrim(p_query) || '%'
     OR p.handle ILIKE '%' || btrim(p_query) || '%'
     OR u.email ILIKE '%' || btrim(p_query) || '%'
  ORDER BY p.name
  LIMIT 25;
END;
$$;

-- The cap and the sanity checks, shared by create and swap.
CREATE OR REPLACE FUNCTION public.intro_check_side(p_kind TEXT, p_id UUID, p_except UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF p_kind = 'applicant' THEN
    SELECT name INTO v_name FROM public.applicants WHERE id = p_id;
  ELSIF p_kind = 'user' THEN
    SELECT name INTO v_name FROM public.profiles WHERE user_id = p_id;
  ELSE
    RAISE EXCEPTION 'unknown kind %', p_kind;
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'That person no longer exists.';
  END IF;
  IF public.intro_count(
       CASE WHEN p_kind = 'applicant' THEN p_id END,
       CASE WHEN p_kind = 'user' THEN p_id END,
       p_except) >= 3 THEN
    RAISE EXCEPTION '% already has 3 matches. Remove one before adding another.', v_name;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.intro_check_side(TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- An applicant is 'matched' while they are in any intro; back to 'new' when
-- the last one goes. 'waiting' is the admin's call and is left alone unless
-- they get matched.
CREATE OR REPLACE FUNCTION public.intro_refresh_status(p_applicant UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.applicants a SET
    status = CASE
      WHEN public.intro_count(a.id, NULL) > 0 THEN 'matched'
      WHEN a.status = 'matched' THEN 'new'
      ELSE a.status END,
    updated_at = now()
  WHERE a.id = p_applicant;
$$;
REVOKE ALL ON FUNCTION public.intro_refresh_status(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_intro(
  p_a_kind TEXT, p_a_id UUID, p_b_kind TEXT, p_b_id UUID, p_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  PERFORM public.require_admin();
  IF p_a_kind = p_b_kind AND p_a_id = p_b_id THEN
    RAISE EXCEPTION 'Pick two different people.';
  END IF;
  PERFORM public.intro_check_side(p_a_kind, p_a_id, NULL);
  PERFORM public.intro_check_side(p_b_kind, p_b_id, NULL);

  INSERT INTO public.intro_matches (a_applicant_id, a_user_id, b_applicant_id, b_user_id, note)
  VALUES (
    CASE WHEN p_a_kind = 'applicant' THEN p_a_id END,
    CASE WHEN p_a_kind = 'user' THEN p_a_id END,
    CASE WHEN p_b_kind = 'applicant' THEN p_b_id END,
    CASE WHEN p_b_kind = 'user' THEN p_b_id END,
    COALESCE(btrim(p_note), ''))
  RETURNING id INTO v_id;

  IF p_a_kind = 'applicant' THEN PERFORM public.intro_refresh_status(p_a_id); END IF;
  IF p_b_kind = 'applicant' THEN PERFORM public.intro_refresh_status(p_b_id); END IF;
  RETURN v_id;
END;
$$;

-- Edit the note, or swap one side for someone else. Before it is sent only:
-- after that, the two people already have it.
CREATE OR REPLACE FUNCTION public.admin_update_intro(
  p_id UUID, p_note TEXT, p_side TEXT DEFAULT NULL, p_kind TEXT DEFAULT NULL, p_person UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v intro_matches%ROWTYPE;
BEGIN
  PERFORM public.require_admin();
  SELECT * INTO v FROM public.intro_matches WHERE id = p_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'That match no longer exists.'; END IF;
  IF v.status = 'sent' THEN RAISE EXCEPTION 'This match has been sent; it can''t be edited.'; END IF;

  UPDATE public.intro_matches SET note = COALESCE(btrim(p_note), note) WHERE id = p_id;

  IF p_side IS NOT NULL THEN
    PERFORM public.intro_check_side(p_kind, p_person, p_id);
    IF (p_side = 'a' AND p_kind = 'applicant' AND p_person = v.b_applicant_id)
       OR (p_side = 'a' AND p_kind = 'user' AND p_person = v.b_user_id)
       OR (p_side = 'b' AND p_kind = 'applicant' AND p_person = v.a_applicant_id)
       OR (p_side = 'b' AND p_kind = 'user' AND p_person = v.a_user_id) THEN
      RAISE EXCEPTION 'Pick two different people.';
    END IF;
    IF p_side = 'a' THEN
      UPDATE public.intro_matches SET
        a_applicant_id = CASE WHEN p_kind = 'applicant' THEN p_person END,
        a_user_id      = CASE WHEN p_kind = 'user' THEN p_person END
      WHERE id = p_id;
      IF v.a_applicant_id IS NOT NULL THEN PERFORM public.intro_refresh_status(v.a_applicant_id); END IF;
    ELSIF p_side = 'b' THEN
      UPDATE public.intro_matches SET
        b_applicant_id = CASE WHEN p_kind = 'applicant' THEN p_person END,
        b_user_id      = CASE WHEN p_kind = 'user' THEN p_person END
      WHERE id = p_id;
      IF v.b_applicant_id IS NOT NULL THEN PERFORM public.intro_refresh_status(v.b_applicant_id); END IF;
    ELSE
      RAISE EXCEPTION 'side must be a or b';
    END IF;
    IF p_kind = 'applicant' THEN PERFORM public.intro_refresh_status(p_person); END IF;
  END IF;
END;
$$;

-- draft <-> approved, approved -> sent. Sending is the only step students see.
CREATE OR REPLACE FUNCTION public.admin_set_intro_status(p_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  PERFORM public.require_admin();
  SELECT status INTO v_status FROM public.intro_matches WHERE id = p_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'That match no longer exists.'; END IF;
  IF NOT (
    (v_status = 'draft' AND p_status = 'approved')
    OR (v_status = 'approved' AND p_status IN ('draft', 'sent'))
  ) THEN
    RAISE EXCEPTION 'Can''t go from % to %.', v_status, p_status;
  END IF;
  UPDATE public.intro_matches SET
    status = p_status,
    approved_at = CASE WHEN p_status = 'approved' THEN now()
                       WHEN p_status = 'draft' THEN NULL ELSE approved_at END,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_intro(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v intro_matches%ROWTYPE;
BEGIN
  PERFORM public.require_admin();
  DELETE FROM public.intro_matches WHERE id = p_id RETURNING * INTO v;
  IF v.a_applicant_id IS NOT NULL THEN PERFORM public.intro_refresh_status(v.a_applicant_id); END IF;
  IF v.b_applicant_id IS NOT NULL THEN PERFORM public.intro_refresh_status(v.b_applicant_id); END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_applicant_status(p_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  IF p_status NOT IN ('new', 'waiting') THEN
    RAISE EXCEPTION 'Use new or waiting; matched follows from their matches.';
  END IF;
  UPDATE public.applicants SET status = p_status, updated_at = now() WHERE id = p_id;
END;
$$;

-- Full delete when someone asks: the applicant and every match they are in.
CREATE OR REPLACE FUNCTION public.admin_delete_applicant(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_others UUID[];
  v_other  UUID;
BEGIN
  PERFORM public.require_admin();
  -- The people they were matched with go back to 'new' if this was their
  -- only match.
  SELECT array_agg(CASE WHEN a_applicant_id = p_id THEN b_applicant_id ELSE a_applicant_id END)
  INTO v_others
  FROM public.intro_matches WHERE p_id IN (a_applicant_id, b_applicant_id);
  DELETE FROM public.applicants WHERE id = p_id;  -- cascades to intro_matches
  FOREACH v_other IN ARRAY COALESCE(v_others, '{}'::uuid[]) LOOP
    IF v_other IS NOT NULL THEN PERFORM public.intro_refresh_status(v_other); END IF;
  END LOOP;
END;
$$;

-- Every intro with both sides spelled out, for Review and Ready to send.
CREATE OR REPLACE FUNCTION public.admin_list_intros()
RETURNS TABLE (
  id UUID, status TEXT, note TEXT, created_at TIMESTAMPTZ, approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ, a JSONB, b JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN QUERY
  SELECT i.id, i.status, i.note, i.created_at, i.approved_at, i.sent_at,
         public.intro_side_json(i.a_applicant_id, i.a_user_id),
         public.intro_side_json(i.b_applicant_id, i.b_user_id)
  FROM public.intro_matches i
  ORDER BY i.created_at DESC;
END;
$$;

DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'admin_intro_stats()', 'admin_list_applicants()', 'admin_search_users(text)',
    'admin_create_intro(text, uuid, text, uuid, text)',
    'admin_update_intro(uuid, text, text, text, uuid)',
    'admin_set_intro_status(uuid, text)', 'admin_delete_intro(uuid)',
    'admin_set_applicant_status(uuid, text)', 'admin_delete_applicant(uuid)',
    'admin_list_intros()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
