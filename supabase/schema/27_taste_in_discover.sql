-- ============================================================
-- 27_taste_in_discover.sql — Discover uses the taste model
--
-- 26_room_composer.sql built taste vectors (CLIP, from the images a member
-- made and loved) for seating events. Discover is where people actually look
-- for collaborators, so it should use them too. This returns how close each
-- of a set of people is to the caller's taste; the app blends that into the
-- order of the deck (mobile/src/lib/taste.ts).
--
-- Only similarities are returned, never vectors. Someone without a vector
-- yet (no images) comes back NULL and keeps their place in the deck.
--
-- Safe to run more than once. Apply AFTER 26_room_composer.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.taste_scores(p_others UUID[])
RETURNS TABLE (user_id UUID, similarity REAL)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT o.id,
         CASE WHEN me.embedding IS NULL OR tv.embedding IS NULL THEN NULL
              ELSE (1 - (me.embedding OPERATOR(extensions.<=>) tv.embedding))::real END
  FROM unnest(p_others) AS o(id)
  LEFT JOIN public.taste_vectors tv ON tv.user_id = o.id
  LEFT JOIN public.taste_vectors me ON me.user_id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND cardinality(p_others) <= 200;
$$;

REVOKE ALL ON FUNCTION public.taste_scores(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.taste_scores(UUID[]) TO authenticated;
