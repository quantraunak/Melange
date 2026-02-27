-- Debug: Why are no posts showing for test2?

-- Step 1: Check if posts exist at all
SELECT 
  cp.id,
  cp.title,
  cp.owner_id,
  au.email as owner_email,
  cp.created_at
FROM collab_posts cp
LEFT JOIN auth.users au ON cp.owner_id = au.id
ORDER BY cp.created_at DESC;

-- Step 2: Get test2's user ID
SELECT id, email FROM auth.users 
WHERE email LIKE '%test2%' OR email LIKE '%tes2%';

-- Step 3: Check what posts test2 should see (not their own)
-- Replace 'TEST2_USER_ID' with the actual UUID from Step 2
SELECT 
  cp.id,
  cp.title,
  cp.owner_id,
  au.email as owner_email
FROM collab_posts cp
JOIN auth.users au ON cp.owner_id = au.id
WHERE cp.owner_id != 'TEST2_USER_ID'  -- Replace with test2's UUID
ORDER BY cp.created_at DESC;

-- Step 4: Check if test2 has swiped on anything
-- Replace 'TEST2_USER_ID' with the actual UUID from Step 2
SELECT 
  s.id,
  s.direction,
  s.post_id,
  cp.title as post_title,
  owner.email as post_owner_email
FROM swipes s
JOIN collab_posts cp ON s.post_id = cp.id
JOIN auth.users swiper ON s.swiper_id = swiper.id
JOIN auth.users owner ON cp.owner_id = owner.id
WHERE s.swiper_id = 'TEST2_USER_ID'  -- Replace with test2's UUID
ORDER BY s.created_at DESC;

-- Step 5: Check RLS policies - see if test2 can read posts
-- This should return all posts if RLS allows
SELECT * FROM collab_posts;


