-- ============================================================
-- 11_profile_gate.sql — the quality floor, enforced by the database
--
-- Anyone may browse Melange with an empty profile. Asking for someone
-- else's attention costs something: three portfolio images and a role
-- before you can post a project or like anyone. Passing is never gated.
--
-- The client already refuses these actions and explains why in one line.
-- This file is the half that cannot be bypassed by calling the API
-- directly, which is what makes it a floor rather than a suggestion.
--
-- !! DO NOT APPLY THIS UNTIL A CLIENT CARRYING THE GATE UI IS LIVE. !!
-- Applied early, the shipped app would start refusing posts and likes
-- with a raw row-level-security error and no explanation. Apply it only
-- once the version containing `profileGate` is in the App Store, and
-- confirm every existing profile clears the floor first:
--   select name, coalesce(cardinality(portfolio_urls),0) from profiles;
--
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. One definition of the floor
--
-- Kept as a function so the two policies below cannot drift apart, and
-- so raising the bar later is a single edit. Mirrors profileGate() in
-- mobile/src/lib/db.ts — change both together.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_meets_floor(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(cardinality(portfolio_urls), 0) >= 3
     AND COALESCE(btrim(role), '') <> ''
  FROM public.profiles
  WHERE user_id = p_user_id;
$$;

COMMENT ON FUNCTION public.profile_meets_floor(UUID) IS
  'Three portfolio images and a role. Returns NULL for a user with no '
  'profile row, which fails the policies below — correct: no profile, no '
  'asking for attention.';

REVOKE ALL ON FUNCTION public.profile_meets_floor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_meets_floor(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 2. Posting a project
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own collab_posts" ON public.collab_posts;
CREATE POLICY "Users can insert their own collab_posts"
  ON public.collab_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND public.profile_meets_floor(auth.uid())
  );

-- ------------------------------------------------------------
-- 3. Liking someone
--
-- A left swipe is a pass and stays free: nobody should be forced to
-- build a profile in order to decline. Only 'right' costs.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own swipes" ON public.swipes;
CREATE POLICY "Users can insert their own swipes"
  ON public.swipes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = swiper_id
    AND (direction <> 'right' OR public.profile_meets_floor(auth.uid()))
  );
