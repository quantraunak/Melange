-- ============================================================
-- 14_ungate_until_1_4.sql — lift the quality floor until the client
-- that can explain it is actually in the App Store
--
-- 11_profile_gate.sql carries its own warning, in capitals:
--
--     !! DO NOT APPLY THIS UNTIL A CLIENT CARRYING THE GATE UI IS LIVE. !!
--
-- It was applied anyway, on 2026-10-13, because 13_reach_out.sql needs
-- profile_meets_floor() to exist. That reasoning was half right: the
-- FUNCTION was needed, the POLICIES were not, and applying the whole file
-- took the shipped app with it.
--
-- The live version is 1.3, which has no profileGate in it — that shipped
-- to main an hour after build 13 was uploaded, so it is in 1.4 and 1.4 is
-- still in review. On 1.3 the floor therefore surfaces as a bare
-- row-level-security failure with nothing explaining it. One of the
-- eleven profiles is below the floor, and it is Jolea's: one photo where
-- three are required. She is also the only person other than the owner
-- actually using the app, so the practical effect of that migration was
-- to stop the single real user from liking or posting, silently.
--
-- So the two policies go back to what they were. The function stays,
-- because start_conversation() calls it and because 1.4's client enforces
-- the same floor itself, with a sentence explaining what to do.
--
-- Re-apply 11_profile_gate.sql once 1.4 is READY_FOR_SALE. The server-side
-- half is worth having — it is what makes the floor real rather than a
-- suggestion the API can step around — it just cannot land first.
--
-- Safe to run more than once.
-- ============================================================

DROP POLICY IF EXISTS "Users can insert their own collab_posts" ON public.collab_posts;
CREATE POLICY "Users can insert their own collab_posts"
  ON public.collab_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own swipes" ON public.swipes;
CREATE POLICY "Users can insert their own swipes"
  ON public.swipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = swiper_id);
