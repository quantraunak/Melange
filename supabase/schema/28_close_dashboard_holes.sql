-- ============================================================
-- 28_close_dashboard_holes.sql — remove what the dashboard added
--
-- A 2026-11-05 review compared production's pg_policies with these
-- migrations and found policies that exist only in production, added
-- through the dashboard. Policies OR together, so each one silently
-- re-opens what a migration closed.
--
-- 1. matches_insert_participant lets any signed-in user insert a match
--    with anyone (WITH CHECK auth.uid() IN (user1_id, user2_id)). That
--    skips create_match()'s mutual consent and start_conversation()'s
--    limits, and pushes a notification to the other person. 07 dropped
--    the policy under its old name only. Matches are created through
--    create_match() and start_conversation(), both SECURITY DEFINER, so
--    no client INSERT policy is needed.
--
-- 2. has_heart_between() and has_inbound_interest() take arbitrary user
--    ids and are executable by anon, so who-likes-whom is readable
--    without an account. REVOKE ... FROM PUBLIC does not remove Supabase's
--    direct grant to anon. Revoked from anon only here: authenticated is
--    kept until every caller is checked (my_likes and the Likes list use
--    has_heart_between). profile_meets_floor() is NOT revoked from
--    authenticated: the posting and swipe policies in 11_profile_gate.sql
--    call it as the caller.
--
-- 3. Deleting a project cascaded to its matches, and so to their
--    messages and reviews, while the edit screen promises "Matches already
--    made from it keep their chats". post1_id/post2_id are nullable, so
--    the foreign keys become ON DELETE SET NULL.
--
-- Safe to run more than once.
-- ============================================================

-- 1
DROP POLICY IF EXISTS "matches_insert_participant" ON public.matches;
ALTER TABLE public.matches VALIDATE CONSTRAINT matches_user_order;

-- 2
REVOKE EXECUTE ON FUNCTION public.has_heart_between(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_inbound_interest(uuid, uuid) FROM PUBLIC, anon;

-- 3  (production names these matches_post_low_fkey / matches_post_high_fkey;
--     01_core.sql would have named them matches_post1_id_fkey / ..._post2_...,
--     so drop every matches -> collab_posts foreign key, whatever its name)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.matches'::regclass AND contype = 'f'
      AND confrelid = 'public.collab_posts'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.matches DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_post1_id_fkey FOREIGN KEY (post1_id)
  REFERENCES public.collab_posts(id) ON DELETE SET NULL;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_post2_id_fkey FOREIGN KEY (post2_id)
  REFERENCES public.collab_posts(id) ON DELETE SET NULL;
