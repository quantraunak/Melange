-- ============================================================
-- Melange – Consolidated Schema
-- Paste this entire script into the Supabase SQL Editor.
-- It is idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================

-- ===================
-- 1. profiles
-- ===================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT,
  bio         TEXT,
  current_project TEXT,
  skills      TEXT[],
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- ===================
-- 2. collab_posts
-- ===================
-- The app's CollabPost type expects:
--   id, owner_id, title, description, looking_for, location,
--   compensation, media_urls, is_active, created_at
CREATE TABLE IF NOT EXISTS public.collab_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  looking_for   TEXT[],            -- tags the poster is looking for
  location      TEXT,
  compensation  TEXT,
  media_urls    TEXT[],            -- array of URLs (replaces old media_url)
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_posts_owner_id ON public.collab_posts(owner_id);

-- ===================
-- 3. swipes
-- ===================
CREATE TABLE IF NOT EXISTS public.swipes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('left', 'right')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(swiper_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_swipes_swiper_id ON public.swipes(swiper_id);
CREATE INDEX IF NOT EXISTS idx_swipes_post_id   ON public.swipes(post_id);

-- ===================
-- 4. matches
-- ===================
CREATE TABLE IF NOT EXISTS public.matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post1_id    UUID NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  post2_id    UUID NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_user1_id ON public.matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2_id ON public.matches(user2_id);

-- ===================
-- 5. messages  (stub for future chat)
-- ===================
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Enable RLS on every table
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages     ENABLE ROW LEVEL SECURITY;

-- ---- profiles -------------------------------------------------

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ---- collab_posts ---------------------------------------------

CREATE POLICY "Users can view all collab_posts"
  ON public.collab_posts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own collab_posts"
  ON public.collab_posts FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own collab_posts"
  ON public.collab_posts FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own collab_posts"
  ON public.collab_posts FOR DELETE
  USING (auth.uid() = owner_id);

-- ---- swipes ---------------------------------------------------

CREATE POLICY "Users can view their own swipes"
  ON public.swipes FOR SELECT
  USING (auth.uid() = swiper_id);

CREATE POLICY "Users can insert their own swipes"
  ON public.swipes FOR INSERT
  WITH CHECK (auth.uid() = swiper_id);

-- ---- matches --------------------------------------------------

CREATE POLICY "Users can view matches they are part of"
  ON public.matches FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can insert matches they are part of"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ---- messages -------------------------------------------------

CREATE POLICY "Users can view messages in their matches"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = messages.match_id
        AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their matches"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = messages.match_id
        AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

