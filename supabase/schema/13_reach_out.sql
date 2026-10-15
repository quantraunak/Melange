-- ============================================================
-- 13_reach_out.sql — message anyone, and past collabs on public profiles
--
-- Two product changes the app needs from the database:
--
--   1. Reaching out. Until now a conversation only existed after a mutual
--      match, and a match needs the other person to have liked one of YOUR
--      posts (07_matching.sql). Anyone who hadn't posted could never match or
--      message anyone, which is most people. start_conversation() lets a
--      signed-in user open a thread with someone from their project, profile,
--      event or story by sending a first message. Swipe matches keep working
--      exactly as before; a reach-out thread is the same `matches` row with
--      origin <> 'swipe' and the posts optional.
--
--   2. Public profiles. A profile now shows ratings, reviews and past collabs
--      to everyone. Reviews are already readable once mutually revealed
--      (04_reviews.sql). The credits view is security_invoker and only shows
--      your own matches, so public_credits() exposes the confirmed ones —
--      both people reviewed each other — for any user.
--
-- Safe to run more than once. Must be applied to the Supabase project by the
-- owner: bash scripts/apply-schema.sh supabase/schema/13_reach_out.sql
-- Needs 11_profile_gate.sql. The app tolerates its absence: Message buttons
-- explain the missing update, and past collabs are simply empty.
-- ============================================================

-- ------------------------------------------------------------
-- 1. matches: a thread does not need a post on either side
-- ------------------------------------------------------------
ALTER TABLE public.matches ALTER COLUMN post1_id DROP NOT NULL;
ALTER TABLE public.matches ALTER COLUMN post2_id DROP NOT NULL;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS origin     TEXT NOT NULL DEFAULT 'swipe',
  ADD COLUMN IF NOT EXISTS origin_id  UUID,
  ADD COLUMN IF NOT EXISTS started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_origin_check' AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_origin_check
      CHECK (origin IN ('swipe', 'project', 'profile', 'event', 'story'));
  END IF;
END $$;

COMMENT ON COLUMN public.matches.origin IS
  'swipe = mutual right-swipes (create_match). Anything else = someone reached '
  'out from that surface (start_conversation); origin_id is the project, event '
  'or story it started from.';

CREATE INDEX IF NOT EXISTS idx_matches_started_by ON public.matches(started_by, created_at);

-- ------------------------------------------------------------
-- 2. start_conversation(other, message, origin, origin_id)
--
-- Opens (or reuses) the thread between the caller and p_other and posts the
-- caller's first message in it, in one transaction. Returns the thread id.
--
-- Refuses: yourself, an unknown user, a block in either direction, an empty
-- or oversized message, a profile below the quality floor (three photos and
-- a role, 11_profile_gate.sql — the same bar as posting or liking), and more
-- than 5 NEW threads in 24 hours (writing in an existing thread is not
-- limited here — it is an ordinary message).
-- ------------------------------------------------------------
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
  IF NOT coalesce(public.profile_meets_floor(v_me), false) THEN
    RAISE EXCEPTION 'Add three photos and your role to your profile first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_other) THEN
    RAISE EXCEPTION 'That person''s account no longer exists.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = v_me AND b.blocked_id = p_other)
       OR (b.blocker_id = p_other AND b.blocked_id = v_me)
  ) THEN
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
    -- Counted against reach_outs, not matches. The limit used to count the
    -- matches rows themselves, and unmatching DELETEs those, so sending five
    -- and deleting them reset the counter to zero. reach_outs is never
    -- deleted, so the window means what it says. See 17_audit_fixes.sql.
    IF (
      SELECT count(*) FROM public.reach_outs
      WHERE sender_id = v_me AND created_at > now() - interval '24 hours'
    ) >= 5 THEN
      -- Five, not twenty. Twenty cold approaches a day is not a limit on an
      -- app this size; it is the harassment budget. Raise it when there is
      -- enough density that five is genuinely in the way.
      RAISE EXCEPTION 'You''ve started a lot of conversations today. Try again tomorrow.';
    END IF;

    -- Reaching out about someone's project: remember which one so the
    -- thread is labelled with it. Clients find a thread's projects by owner,
    -- not by slot (create_match fills the slots crosswise).
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

    -- Lost a race with the other person reaching out at the same moment.
    IF v_match IS NULL THEN
      SELECT id INTO v_match
      FROM public.matches
      WHERE user1_id = v_user1 AND user2_id = v_user2;
    ELSE
      -- Only a genuinely new thread counts against the daily limit, and the
      -- record outlives the thread so deleting it cannot refund the quota.
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

-- create_match() inserts without origin, so it gets the 'swipe' default. When
-- a reach-out thread already exists for the pair, its ON CONFLICT DO NOTHING
-- returns that thread — the mutual like lands in the conversation they
-- already have instead of failing.

-- ------------------------------------------------------------
-- 3. public_credits(user): confirmed past collabs, for anyone to see
--
-- A collab counts once BOTH people reviewed each other on the thread — the
-- same mutual-reveal rule the reviews themselves follow. Returns who it was
-- with, the project title when there was one, the rating they gave, and when.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_credits(p_user_id UUID)
RETURNS TABLE (
  match_id     UUID,
  with_user_id UUID,
  title        TEXT,
  rating       INT,
  happened_on  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.match_id,
    r.reviewer_id AS with_user_id,
    p.title,
    r.rating,
    coalesce(p.project_start::timestamptz, r.created_at) AS happened_on
  FROM public.collab_reviews r
  JOIN public.matches m ON m.id = r.match_id
  -- The thread's project, found by owner rather than slot (create_match fills
  -- the slots crosswise): the reviewer's own project first, as in the app's
  -- credits, then this person's.
  LEFT JOIN LATERAL (
    SELECT cp.title, cp.project_start
    FROM public.collab_posts cp
    WHERE cp.id IN (m.post1_id, m.post2_id)
    ORDER BY (cp.owner_id = r.reviewer_id) DESC
    LIMIT 1
  ) p ON true
  WHERE auth.uid() IS NOT NULL
    AND r.reviewee_id = p_user_id
    AND EXISTS (
      SELECT 1 FROM public.collab_reviews back
      WHERE back.match_id = r.match_id
        AND back.reviewer_id = r.reviewee_id
        AND back.reviewee_id = r.reviewer_id
    )
  ORDER BY r.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.public_credits(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_credits(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 4. public_reviews(user, limit): the reviews that are actually public
--
-- collab_reviews' SELECT policy is
--     reviewer_id = auth.uid() OR reviewee_id = auth.uid()
--     OR review_has_reciprocal(match_id, reviewer_id, reviewee_id)
-- and the first branch is the problem. Reading the table directly to build
-- someone's public profile returned your OWN review of them even when they
-- had never reviewed you back, so it appeared in the list under a header
-- showing no stars, because creator_reputation does require a reciprocal row.
-- Everyone who reviewed a stranger concluded it had been published.
--
-- This applies the mutual-reveal rule itself, so the list always agrees with
-- the rating above it and shows the same thing to every viewer.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_reviews(p_user_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE (
  id          UUID,
  reviewer_id UUID,
  rating      INT,
  tags        TEXT[],
  body        TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.reviewer_id, r.rating, r.tags, r.body, r.created_at
  FROM public.collab_reviews r
  WHERE auth.uid() IS NOT NULL
    AND r.reviewee_id = p_user_id
    AND EXISTS (
      SELECT 1 FROM public.collab_reviews back
      WHERE back.match_id    = r.match_id
        AND back.reviewer_id = r.reviewee_id
        AND back.reviewee_id = r.reviewer_id
    )
  ORDER BY r.created_at DESC
  LIMIT greatest(coalesce(p_limit, 20), 1);
$$;

REVOKE ALL ON FUNCTION public.public_reviews(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_reviews(UUID, INT) TO authenticated;
