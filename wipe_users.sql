-- =============================================================
-- Melange: wipe ALL users and data for a fresh start
-- =============================================================
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.
-- It deletes every user, profile, post, swipe, match, message,
-- block, report, push token, and uploaded media file.
--
-- This is IRREVERSIBLE. After running, no one will be able to
-- log in with an existing account; they'll need to sign up again.
-- =============================================================

BEGIN;

-- Wipe storage files (avatars + post images)
DELETE FROM storage.objects WHERE bucket_id = 'media';

-- Wipe public schema (cascades from auth.users handle most of this,
-- but we delete explicitly so the order is predictable).
DELETE FROM public.match_reads;
DELETE FROM public.messages;
DELETE FROM public.matches;
DELETE FROM public.swipes;
DELETE FROM public.reports;
DELETE FROM public.blocks;
DELETE FROM public.push_tokens;
DELETE FROM public.collab_posts;
DELETE FROM public.profiles;

-- Finally, wipe the auth users themselves.
DELETE FROM auth.users;

COMMIT;

-- Show what's left (should all be 0)
SELECT
  (SELECT count(*) FROM auth.users)            AS users_left,
  (SELECT count(*) FROM public.profiles)       AS profiles_left,
  (SELECT count(*) FROM public.collab_posts)   AS posts_left,
  (SELECT count(*) FROM public.matches)        AS matches_left,
  (SELECT count(*) FROM public.messages)       AS messages_left,
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'media') AS media_left;
