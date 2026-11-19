-- remove_fake_accounts.sql: delete the made-up demo people and their posts.
--
-- One-off, not a migration. Paste into the Supabase SQL editor in two steps:
--
--   STEP 1 (look): run only the SELECT below. It lists every account this
--   will delete, with its email and how many posts it has. Check that every
--   row is a fake one.
--
--   STEP 2 (delete): run the BEGIN ... COMMIT block.
--
-- Who counts as fake: the five seeded creatives (Aria Nakamura, Devin Park,
-- Jordan Rivera, Maya Chen, Sofia Blake: *.creative@melange.app) and the second
-- demo login (demo2@melange.app). Matched by exact email, not display name, so a
-- real person who shares a name is never touched. Deleting the auth user removes their profile, posts,
-- stories, swipes, chats and hearts too (every table cascades from it).
--
-- KEPT: review@melange.app, the login Apple uses to review each build. Its
-- posts and stories are deleted so it shows nothing fake, but the login stays.
-- To delete it as well, uncomment its line in both lists (and make a new
-- review login before the next App Store submission).
--
-- Running it twice is safe: the second time it finds nobody.

-- ---------------------------------------------------------------- STEP 1
SELECT u.id, u.email, p.name, u.created_at,
       (SELECT count(*) FROM public.collab_posts c WHERE c.owner_id = u.id) AS posts
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE lower(u.email) IN (
        'demo2@melange.app',
        'aria.creative@melange.app', 'devin.creative@melange.app', 'jordan.creative@melange.app',
        'maya.creative@melange.app', 'sofia.creative@melange.app'
        -- , 'review@melange.app'
      )
ORDER BY u.created_at;

-- ---------------------------------------------------------------- STEP 2
BEGIN;

-- The review login's content (the login itself stays).
DELETE FROM public.collab_posts
WHERE owner_id IN (SELECT id FROM auth.users WHERE lower(email) = 'review@melange.app');
DELETE FROM public.collab_stories
WHERE author_id IN (SELECT id FROM auth.users WHERE lower(email) = 'review@melange.app');

-- The fake people, and everything of theirs.
DELETE FROM auth.users
WHERE id IN (
  SELECT u.id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE lower(u.email) IN (
          'demo2@melange.app',
          'aria.creative@melange.app', 'devin.creative@melange.app', 'jordan.creative@melange.app',
          'maya.creative@melange.app', 'sofia.creative@melange.app'
          -- , 'review@melange.app'
        )
);

COMMIT;
