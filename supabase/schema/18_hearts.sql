-- ============================================================
-- 18_hearts.sql — hearts on profiles and work, and messaging that works
--
-- 1. Messaging was closed to most people. start_conversation() and
--    can_message() both required the SENDER to meet the profile floor (three
--    photos and a role, 11_profile_gate.sql). 14_ungate_until_1_4.sql lifted
--    the floor from posting and liking but not from messaging, so anyone with
--    fewer than three photos saw no Message button and could not reach anyone
--    — including Jolea, who has one photo. The floor comes off messaging; the
--    block check and the daily limit on cold approaches stay.
--
-- 2. Hearts. A like on a project already exists (a right swipe). This adds
--    the same on a profile and on a piece of work (a story), and my_likes()
--    lists every heart you got and gave, on what, with the other person —
--    projects included. Either side of a heart can message the other, and a
--    message to someone you share a heart with is not counted as a cold
--    approach.
--
-- Safe to run more than once. Needs 13_reach_out.sql, 16 and 17.
-- Apply: bash scripts/apply-schema.sh supabase/schema/18_hearts.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Hearts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hearts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('profile', 'story')),
  target_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_user, kind, target_id),
  CHECK (from_user <> to_user)
);

CREATE INDEX IF NOT EXISTS idx_hearts_to_user   ON public.hearts(to_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hearts_from_user ON public.hearts(from_user, created_at DESC);

ALTER TABLE public.hearts ENABLE ROW LEVEL SECURITY;

-- You see the hearts you gave and the ones you got. Writes go through
-- toggle_heart(), which works out who the heart is for, so nobody can
-- address a heart to someone other than the target's owner.
DROP POLICY IF EXISTS "hearts_select_own" ON public.hearts;
CREATE POLICY "hearts_select_own"
  ON public.hearts FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

-- ------------------------------------------------------------
-- 2. toggle_heart(kind, target): heart it, or take the heart back
--
-- Returns true when the target is now hearted, false when it is not.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_heart(p_kind TEXT, p_target UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me    UUID := auth.uid();
  v_owner UUID;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_kind = 'profile' THEN
    SELECT user_id INTO v_owner FROM public.profiles WHERE user_id = p_target;
  ELSIF p_kind = 'story' THEN
    SELECT author_id INTO v_owner FROM public.collab_stories
    WHERE id = p_target AND is_public;
  ELSE
    RAISE EXCEPTION 'unknown kind %', p_kind;
  END IF;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'That is no longer there.';
  END IF;
  IF v_owner = v_me THEN
    RAISE EXCEPTION 'You can''t heart your own.';
  END IF;
  IF public.is_blocked_pair(v_me, v_owner) THEN
    RAISE EXCEPTION 'You can''t do that.';
  END IF;

  DELETE FROM public.hearts
  WHERE from_user = v_me AND kind = p_kind AND target_id = p_target;
  IF FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.hearts (from_user, to_user, kind, target_id)
  VALUES (v_me, v_owner, p_kind, p_target)
  ON CONFLICT (from_user, kind, target_id) DO NOTHING;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_heart(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_heart(TEXT, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 3. has_heart_between(a, b): a heart or a project like, either way
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_heart_between(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hearts h
    WHERE (h.from_user = a AND h.to_user = b) OR (h.from_user = b AND h.to_user = a)
  ) OR EXISTS (
    SELECT 1 FROM public.swipes s
    JOIN public.collab_posts p ON p.id = s.post_id
    WHERE s.direction = 'right'
      AND ((s.swiper_id = a AND p.owner_id = b) OR (s.swiper_id = b AND p.owner_id = a))
  );
$$;

REVOKE ALL ON FUNCTION public.has_heart_between(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_heart_between(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 4. my_likes(): every heart you got and gave, and on what
--
-- direction: 'received' (someone hearted yours) or 'sent' (you hearted theirs).
-- kind: 'profile', 'story' or 'project' (a right swipe on a project).
-- title: the story's or project's title; NULL for a profile.
-- Blocked pairs are left out either way.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_likes(p_limit INT DEFAULT 100)
RETURNS TABLE (
  direction   TEXT,
  other_user  UUID,
  kind        TEXT,
  target_id   UUID,
  title       TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS id),
  rows AS (
    SELECT 'received'::text, h.from_user, h.kind, h.target_id,
           CASE WHEN h.kind = 'story' THEN st.title END, h.created_at
    FROM public.hearts h CROSS JOIN me
    LEFT JOIN public.collab_stories st ON h.kind = 'story' AND st.id = h.target_id
    WHERE h.to_user = me.id
    UNION ALL
    SELECT 'sent', h.to_user, h.kind, h.target_id,
           CASE WHEN h.kind = 'story' THEN st.title END, h.created_at
    FROM public.hearts h CROSS JOIN me
    LEFT JOIN public.collab_stories st ON h.kind = 'story' AND st.id = h.target_id
    WHERE h.from_user = me.id
    UNION ALL
    SELECT 'received', s.swiper_id, 'project', p.id, p.title, s.created_at
    FROM public.swipes s
    JOIN public.collab_posts p ON p.id = s.post_id
    CROSS JOIN me
    WHERE p.owner_id = me.id AND s.direction = 'right' AND s.swiper_id <> me.id
    UNION ALL
    SELECT 'sent', p.owner_id, 'project', p.id, p.title, s.created_at
    FROM public.swipes s
    JOIN public.collab_posts p ON p.id = s.post_id
    CROSS JOIN me
    WHERE s.swiper_id = me.id AND s.direction = 'right' AND p.owner_id <> me.id
  )
  SELECT r.* FROM rows r(direction, other_user, kind, target_id, title, created_at), me
  WHERE me.id IS NOT NULL
    AND NOT public.is_blocked_pair(me.id, r.other_user)
  ORDER BY r.created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.my_likes(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_likes(INT) TO authenticated;

-- ------------------------------------------------------------
-- 5. Messaging without the photo floor
-- ------------------------------------------------------------
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
     AND NOT public.is_blocked_pair(auth.uid(), p_other);
$$;

REVOKE ALL ON FUNCTION public.can_message(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_message(UUID) TO authenticated;

-- Same function as 13_reach_out.sql, minus the floor check, with the block
-- check through is_blocked_pair, and the daily limit skipped for a pair that
-- shares a heart.
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
    -- Counted against reach_outs, not matches. The limit used to count the
    -- matches rows themselves, and unmatching DELETEs those, so sending five
    -- and deleting them reset the counter to zero. reach_outs is never
    -- deleted, so the window means what it says. See 17_audit_fixes.sql.
    -- A heart either way means one of you already said yes, so writing back
    -- is not a cold approach and does not count against the daily limit.
    IF NOT public.has_heart_between(v_me, p_other) AND (
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

-- ------------------------------------------------------------
-- 6. Push a heart to the person who got it
--
-- Same trigger function as likes, matches and messages (16_blocks_actually_
-- block.sql). A heart cannot exist across a block — toggle_heart() refuses
-- one — so there is nothing to filter here. send-push handles type "heart".
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_push_on_heart ON public.hearts;
CREATE TRIGGER trg_push_on_heart
  AFTER INSERT ON public.hearts
  FOR EACH ROW EXECUTE FUNCTION public.notify_push('heart');
