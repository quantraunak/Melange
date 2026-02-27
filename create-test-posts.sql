-- Create test posts for raunkasood and test2 to swipe on each other

-- Step 1: Find user IDs
SELECT id, email FROM auth.users 
WHERE email LIKE '%raunkasood%' OR email LIKE '%test2%' OR email LIKE '%tes2%'
ORDER BY email;

-- Step 2: Create posts for raunkasood
INSERT INTO collab_posts (owner_id, title, description)
SELECT 
  id as owner_id,
  'Looking for a photographer' as title,
  'I need someone to help with my creative project. Let''s collaborate!' as description
FROM auth.users 
WHERE email LIKE '%raunkasood%'
LIMIT 1;

INSERT INTO collab_posts (owner_id, title, description)
SELECT 
  id as owner_id,
  'Collaboration opportunity' as title,
  'Seeking a creative partner for an exciting new project' as description
FROM auth.users 
WHERE email LIKE '%raunkasood%'
LIMIT 1;

-- Step 3: Create posts for test2
INSERT INTO collab_posts (owner_id, title, description)
SELECT 
  id as owner_id,
  'Photographer available' as title,
  'Experienced photographer looking for creative collaborations' as description
FROM auth.users 
WHERE email LIKE '%test2%' OR email LIKE '%tes2%'
LIMIT 1;

INSERT INTO collab_posts (owner_id, title, description)
SELECT 
  id as owner_id,
  'Open to collaborations' as title,
  'Let''s create something amazing together!' as description
FROM auth.users 
WHERE email LIKE '%test2%' OR email LIKE '%tes2%'
LIMIT 1;

-- Step 4: Verify posts were created
SELECT 
  cp.id,
  cp.title,
  cp.description,
  au.email as owner_email,
  cp.created_at
FROM collab_posts cp
JOIN auth.users au ON cp.owner_id = au.id
WHERE au.email LIKE '%raunkasood%' OR au.email LIKE '%test2%' OR au.email LIKE '%tes2%'
ORDER BY au.email, cp.created_at DESC;

