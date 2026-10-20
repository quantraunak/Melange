-- ============================================================
-- 21_trust_and_support.sql — four things a company has and Melange did not
--
-- Found by the 2026-10-19 audit. Each one reported success while doing
-- nothing, which is this codebase's recurring defect (see STATUS.md).
--
-- 1. Anyone could give themselves the Verified badge. The profiles UPDATE
--    policy in 01_core.sql has no column restriction, so
--    `update profiles set verification_status = 'verified'` from the client
--    worked. Only refresh_profile_verification() is meant to set it.
--
-- 2. A heart YOU sent counted as the other person raising their hand.
--    has_heart_between() is symmetric, so hearting a stranger lifted both the
--    message floor and the five-a-day cold-approach limit for messaging
--    them. Hearting is exactly what a spammer would do first. Only interest
--    that came FROM the other person lifts the bar now.
--
-- 3. Toggling a heart off and on sent a push every time, titled with the
--    sender's chosen name. One heart push per pair per day now.
--
-- 4. Reports, and the support address, reached nobody. Reports landed in a
--    table with no trigger. support@melange.app is a parked domain someone
--    else owns, with a null MX record: mail to it cannot be delivered. This
--    adds a support inbox the web form writes to, and both reports and
--    support requests push to whoever is in app_admins.
--
-- After applying, add yourself as an admin (needs your user id, which is
-- deliberately not in this public file):
--   INSERT INTO public.app_admins (user_id)
--   SELECT id FROM auth.users WHERE email = '<your sign-in email>';
-- and redeploy send-push, which learned the "report" and "support" types.
--
-- Safe to run more than once. Apply AFTER 20_message_floor.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Verification can only be set by the server
--
-- Client updates run as the `authenticated` (or `anon`) role.
-- refresh_profile_verification() is SECURITY DEFINER, so inside it
-- current_user is the function owner and the change goes through.
-- A client write keeps the old value silently rather than failing the
-- whole profile save, because the profile editor sends every column back.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.verification_status := OLD.verification_status;
    NEW.verified_at := OLD.verified_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_verification ON public.profiles;
CREATE TRIGGER trg_guard_verification
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_verification();

-- An INSERT can set it too. A new profile always starts unverified.
CREATE OR REPLACE FUNCTION public.guard_verification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.verification_status := 'none';
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_verification_insert ON public.profiles;
CREATE TRIGGER trg_guard_verification_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_verification_insert();

-- ------------------------------------------------------------
-- 2. Only THEIR interest lifts the bar
--
-- has_heart_between() stays as it is: my_likes and the Likes list use it to
-- mean "there is something between you", which is symmetric and fine.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_inbound_interest(p_me UUID, p_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hearts h
    WHERE h.from_user = p_other AND h.to_user = p_me
  ) OR EXISTS (
    SELECT 1 FROM public.swipes s
    JOIN public.collab_posts p ON p.id = s.post_id
    WHERE s.direction = 'right' AND s.swiper_id = p_other AND p.owner_id = p_me
  );
$$;

REVOKE ALL ON FUNCTION public.has_inbound_interest(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_inbound_interest(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_message(p_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_other IS NOT NULL
     AND p_other <> auth.uid()
     AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_other)
     AND NOT public.is_blocked_pair(auth.uid(), p_other)
     AND (
       EXISTS (
         SELECT 1 FROM public.matches m
         WHERE (m.user1_id = auth.uid() AND m.user2_id = p_other)
            OR (m.user1_id = p_other AND m.user2_id = auth.uid())
       )
       OR public.has_inbound_interest(auth.uid(), p_other)
       OR COALESCE(public.meets_message_floor(auth.uid()), false)
     );
$$;

REVOKE ALL ON FUNCTION public.can_message(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_message(UUID) TO authenticated;

-- Same as 18_hearts.sql, with has_heart_between replaced by
-- has_inbound_interest in the floor check and the daily limit.
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
    ELSE
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
-- 3 + 4. Admins, the support inbox, and who gets pushed
-- ------------------------------------------------------------

-- RLS on with no policies: invisible to every client role. Written by hand.
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- One row per pair, holding when the last heart push went out.
CREATE TABLE IF NOT EXISTS public.heart_push_log (
  from_user UUID NOT NULL,
  to_user   UUID NOT NULL,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_user, to_user)
);
ALTER TABLE public.heart_push_log ENABLE ROW LEVEL SECURITY;

-- The support inbox. Signed-out people can write to it (an App Store
-- reviewer, or someone locked out of their account), so it needs its own
-- limits: field lengths here, and a rate limit in the trigger below.
CREATE TABLE IF NOT EXISTS public.support_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact    TEXT NOT NULL CHECK (length(btrim(contact)) BETWEEN 3 AND 200),
  topic      TEXT NOT NULL CHECK (topic IN ('help', 'safety', 'privacy', 'bug', 'other')),
  message    TEXT NOT NULL CHECK (length(btrim(message)) BETWEEN 1 AND 4000),
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_requests_created ON public.support_requests(created_at);
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Insert only, and only as yourself or as nobody. No SELECT policy: the
-- form does not read back, so nobody can list other people's requests.
DROP POLICY IF EXISTS "Anyone can contact support" ON public.support_requests;
CREATE POLICY "Anyone can contact support"
  ON public.support_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.limit_support_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.status := 'open';
  IF (SELECT count(*) FROM public.support_requests
      WHERE lower(contact) = lower(NEW.contact)
        AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'You''ve sent a few messages already. We''ll get back to you.';
  END IF;
  -- A ceiling on the whole inbox, so a script cannot fill it.
  IF (SELECT count(*) FROM public.support_requests
      WHERE created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Support is busy right now. Please try again in an hour.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limit_support_requests ON public.support_requests;
CREATE TRIGGER trg_limit_support_requests
  BEFORE INSERT ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.limit_support_requests();

-- notify_push from 16_blocks_actually_block.sql, plus: one heart push per
-- pair per day, and "report"/"support" pass straight through to send-push,
-- which sends them to app_admins.
CREATE OR REPLACE FUNCTION public.notify_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret TEXT;
  v_url    TEXT;
  v_rec    JSONB := to_jsonb(NEW);
  v_u1     UUID;
  v_u2     UUID;
BEGIN
  IF TG_ARGV[0] = 'like' THEN
    IF COALESCE(v_rec ->> 'direction', '') <> 'right' THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_ARGV[0] = 'message' THEN
    SELECT m.user1_id, m.user2_id INTO v_u1, v_u2
    FROM public.matches m WHERE m.id = (v_rec ->> 'match_id')::uuid;
    IF v_u1 IS NOT NULL AND public.is_blocked_pair(v_u1, v_u2) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_ARGV[0] = 'match' THEN
    IF public.is_blocked_pair((v_rec ->> 'user1_id')::uuid, (v_rec ->> 'user2_id')::uuid) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_ARGV[0] = 'heart' THEN
    -- Unheart and reheart must not be a way to buzz someone's phone.
    -- The upsert only "wins" when the last push is over a day old.
    INSERT INTO public.heart_push_log AS l (from_user, to_user, sent_at)
    VALUES ((v_rec ->> 'from_user')::uuid, (v_rec ->> 'to_user')::uuid, now())
    ON CONFLICT (from_user, to_user) DO UPDATE
      SET sent_at = now()
      WHERE l.sent_at < now() - interval '24 hours';
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret';
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_function_url';
  IF v_secret IS NULL OR v_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object('type', TG_ARGV[0], 'record', v_rec),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_push_on_report ON public.reports;
CREATE TRIGGER trg_push_on_report
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_push('report');

DROP TRIGGER IF EXISTS trg_push_on_support ON public.support_requests;
CREATE TRIGGER trg_push_on_support
  AFTER INSERT ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_push('support');

-- ------------------------------------------------------------
-- 5. Profiles and projects are for signed-in people, as the privacy
--    policy has always said
--
-- 01_core.sql's SELECT policies are USING (true) with no role, so the anon
-- key — which ships inside the app and the website — could list every
-- profile, including current_project, without signing in. Nothing reads
-- these before sign-in: the auth screens only write the new user's own
-- profile, after signUp has returned a session.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view all collab_posts" ON public.collab_posts;
CREATE POLICY "Users can view all collab_posts"
  ON public.collab_posts FOR SELECT
  TO authenticated
  USING (true);
