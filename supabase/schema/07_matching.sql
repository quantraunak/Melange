-- ============================================================
-- 07_matching.sql — mutual consent enforced by the database
--
-- Before this file, "a match only exists when both people swiped right" was
-- true only because the client checked it. The INSERT policy on public.matches
-- let any signed-in user insert a row naming themselves and anyone else, which
-- opened a thread with that person: the cold DM the product promises cannot
-- happen. Canonical ordering (user1_id < user2_id) was also client-side, so
-- UNIQUE(user1_id, user2_id) could be bypassed by inserting the pair reversed.
--
-- Fix, following the 06_interactions.sql pattern: match creation moves into a
-- SECURITY DEFINER function that verifies both right-swipes itself, direct
-- INSERT is removed, and the ordering becomes a CHECK constraint.
--
-- Safe to run more than once. Must be applied to the Supabase project; the
-- client in app/lib/db.ts calls create_match and no longer inserts directly.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Canonical ordering is a constraint, not a convention.
--
-- NOT VALID so an existing reversed row (there should be none; the client
-- always ordered) cannot block the migration. New rows are checked.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_user_order' AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_user_order CHECK (user1_id < user2_id) NOT VALID;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. No direct inserts. The only way to create a match is create_match().
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert matches they are part of" ON public.matches;

-- ------------------------------------------------------------
-- 3. create_match(post)
--
-- Called by the client after it records a right swipe on p_post_id. Verifies,
-- as the definer, that
--   (a) the caller has right-swiped p_post_id,
--   (b) the post's owner has right-swiped one of the caller's posts,
-- then inserts the match in canonical order. Returns the match row, the
-- existing row if the pair already matched, or no row if consent is not
-- mutual. Never raises for the no-match case so the client can treat
-- "no row" as "not yet".
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_match(p_post_id UUID)
RETURNS SETOF public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me         UUID := auth.uid();
  v_owner      UUID;
  v_their_post UUID;
  v_user1      UUID;
  v_user2      UUID;
  v_post1      UUID;
  v_post2      UUID;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT owner_id INTO v_owner FROM public.collab_posts WHERE id = p_post_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'post not found';
  END IF;
  IF v_owner = v_me THEN
    RETURN;
  END IF;

  -- (a) the caller actually swiped right on this post
  IF NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = v_me AND post_id = p_post_id AND direction = 'right'
  ) THEN
    RETURN;
  END IF;

  -- (b) the owner swiped right on one of the caller's posts
  SELECT s.post_id INTO v_their_post
  FROM public.swipes s
  JOIN public.collab_posts p ON p.id = s.post_id
  WHERE s.swiper_id = v_owner
    AND s.direction = 'right'
    AND p.owner_id = v_me
  ORDER BY s.created_at
  LIMIT 1;
  IF v_their_post IS NULL THEN
    RETURN;
  END IF;

  IF v_me < v_owner THEN
    v_user1 := v_me;      v_user2 := v_owner;
    v_post1 := p_post_id; v_post2 := v_their_post;
  ELSE
    v_user1 := v_owner;      v_user2 := v_me;
    v_post1 := v_their_post; v_post2 := p_post_id;
  END IF;

  INSERT INTO public.matches (user1_id, user2_id, post1_id, post2_id)
  VALUES (v_user1, v_user2, v_post1, v_post2)
  ON CONFLICT (user1_id, user2_id) DO NOTHING;

  RETURN QUERY
    SELECT * FROM public.matches
    WHERE user1_id = v_user1 AND user2_id = v_user2;
END;
$$;

REVOKE ALL ON FUNCTION public.create_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_match(UUID) TO authenticated;
