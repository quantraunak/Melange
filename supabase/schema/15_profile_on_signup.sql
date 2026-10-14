-- ============================================================
-- 15_profile_on_signup.sql — a profile row can never be missing again
--
-- An account could exist in auth.users with no row in public.profiles, and
-- nothing in either client could ever create one afterwards. Every other write
-- path is an UPDATE, which matches zero rows and reports success, so the app
-- looked like it was working while saving nothing.
--
-- This is not hypothetical. simransoo1@gmail.com signed up on 2026-09-05,
-- registered a push token six seconds later, and has had no profile ever
-- since. Discover is empty for her (ranked_feed_posts CROSS JOINs the viewer's
-- profile, so no profile means no rows), the Profile tab is a raw PostgREST
-- error, and Edit Profile says "Saved" having written nothing. She never came
-- back, which is the only sensible response.
--
-- The cause: signup wrote the profile from the client, in a second statement
-- after auth.signUp() had already succeeded, and profiles.role is NOT NULL
-- while the signup form never required a role. Skip the role pills and the
-- insert fails with 23502, leaving the account created and the profile absent.
--
-- Two fixes, because either alone still leaves a window:
--   1. role gets a default, so the insert cannot fail on it.
--   2. a trigger on auth.users creates the row, so it exists before any client
--      code runs and regardless of what the client does next.
-- The clients additionally upsert rather than insert, so a retry heals.
--
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. role stops being a way to fail
-- ------------------------------------------------------------
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'other';

-- ------------------------------------------------------------
-- 2. The row is created by the database, not by the client
--
-- SECURITY DEFINER because it runs as part of the auth schema's insert, where
-- the caller has no rights on public.profiles. ON CONFLICT DO NOTHING so the
-- client's own upsert, which may arrive first or second, never collides.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'role'), ''), 'other')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_profile_on_signup ON auth.users;
CREATE TRIGGER trg_create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 3. Repair the account this already broke
-- ------------------------------------------------------------
INSERT INTO public.profiles (user_id, name, role)
SELECT u.id, split_part(u.email, '@', 1), 'other'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
