-- ============================================================
-- 06_interactions.sql — read receipts, unmatch, undo swipe
--
-- Three things the UI needs that RLS deliberately blocks:
--
--   1. "Seen" on a message you sent. Knowing whether the other person has
--      read the thread means reading THEIR row in match_reads, and the
--      policy on that table is `auth.uid() = user_id` — your own rows only.
--   2. Unmatch. public.matches has SELECT and INSERT policies and no DELETE
--      policy, so nobody can leave a match. Blocking was the only exit, which
--      is a heavy answer to "this one isn't going anywhere."
--   3. Undo a swipe. public.swipes is insert-only for the same reason, so a
--      mis-swipe was permanent — the post never came back to the deck.
--
-- All three are solved with SECURITY DEFINER functions that check ownership
-- themselves rather than by loosening the table policies.
--
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Read receipts
--
-- Returns, for every match the caller is in, when the OTHER participant last
-- opened the thread. Only ever exposes a timestamp, never message contents,
-- and only for matches the caller is actually part of.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_peer_reads(p_user_id UUID)
RETURNS TABLE (match_id UUID, peer_last_read_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id AS match_id, r.last_read_at AS peer_last_read_at
  FROM public.matches m
  JOIN public.match_reads r
    ON r.match_id = m.id
   AND r.user_id = CASE WHEN m.user1_id = p_user_id THEN m.user2_id ELSE m.user1_id END
  WHERE (m.user1_id = p_user_id OR m.user2_id = p_user_id)
    -- Callers can only ever ask about themselves.
    AND p_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.match_peer_reads(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_peer_reads(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 2. Unmatch
--
-- Deletes the match. messages and match_reads both cascade off matches.id,
-- so the conversation goes with it for both people — which is what unmatching
-- means, and matches what the confirm dialog in the app promises.
--
-- The swipe rows are left alone on purpose: they are what stop the same post
-- reappearing in the deck, so clearing them would put the person you just
-- unmatched straight back in your feed.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unmatch(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM public.matches
  WHERE id = p_match_id
    AND (user1_id = auth.uid() OR user2_id = auth.uid());

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.unmatch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unmatch(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 3. Index supporting the peer-read lookup above.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_match_reads_user_id ON public.match_reads(user_id);

-- ------------------------------------------------------------
-- 4. Undo a swipe
--
-- Deletes the caller's own swipe on a post so it returns to the deck. Refuses
-- once the swipe has produced a match: taking back a like the other person has
-- already seen and reciprocated would silently delete their match too.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.undo_swipe(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.matches m
    WHERE (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
      AND (m.post1_id = p_post_id OR m.post2_id = p_post_id)
  ) THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.swipes
  WHERE post_id = p_post_id AND swiper_id = auth.uid();

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_swipe(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_swipe(UUID) TO authenticated;
