-- ============================================================
-- 09_stories.sql — the collaboration record
--
-- A project (collab_posts) is work someone WANTS to make. A story is work
-- someone ALREADY made: "collaborated with X, built Y, here is how we did
-- it, here are the photos." It needs no match, so it works on day one, when
-- the marketplace side of the app is still empty.
--
-- Credits are a JSONB array of {name, role, user_id|null}. A credit can point
-- at a Melange account (user_id set, so the story shows on that person's
-- profile too) or be a plain name for someone who is not on Melange. That is
-- deliberate: most of anyone's past work was made with people who will never
-- install this app, and a record that excluded them would be a record of
-- nothing.
--
-- contact_link is a PUBLIC PROFILE OR PORTFOLIO URL ONLY — Instagram, a
-- website. There is no free-text email or phone field anywhere in this
-- table. Melange's promise is that a conversation opens only when both
-- people say yes, and a public phone number in an app for meeting strangers
-- would quietly undo that. People who want to be reached use "Work with me",
-- which routes through the existing like/match flow.
--
-- Safe to run more than once. Must be applied to the Supabase project by the
-- owner; the clients tolerate its absence (the Stories tab shows its empty
-- state and says the feature is not live yet).
-- ============================================================

-- ------------------------------------------------------------
-- 1. The table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collab_stories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  story        TEXT,
  media_urls   TEXT[] NOT NULL DEFAULT '{}',
  credits      JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_link TEXT,
  happened_on  DATE,
  match_id     UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  is_public    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.collab_stories IS
  'Work that already happened. Needs no match: anyone can record a past '
  'collaboration, including one made entirely off Melange.';
COMMENT ON COLUMN public.collab_stories.credits IS
  'JSONB array of {name, role, user_id}. user_id is null for collaborators '
  'who are not on Melange. The GIN index below makes "stories crediting me" '
  'a containment query.';
COMMENT ON COLUMN public.collab_stories.contact_link IS
  'Public profile or portfolio URL only (http/https). Never an email address '
  'or a phone number — see the header of this file.';

-- Constraints added separately so re-running the file on an existing table
-- still installs anything that was missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'collab_stories_title_len_check'
      AND conrelid = 'public.collab_stories'::regclass
  ) THEN
    ALTER TABLE public.collab_stories
      ADD CONSTRAINT collab_stories_title_len_check
      CHECK (char_length(btrim(title)) BETWEEN 1 AND 140);
  END IF;

  -- Defence in depth behind the client's own URL validation.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'collab_stories_contact_link_check'
      AND conrelid = 'public.collab_stories'::regclass
  ) THEN
    ALTER TABLE public.collab_stories
      ADD CONSTRAINT collab_stories_contact_link_check
      CHECK (contact_link IS NULL OR contact_link ~* '^https?://[^[:space:]]+$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'collab_stories_credits_is_array_check'
      AND conrelid = 'public.collab_stories'::regclass
  ) THEN
    ALTER TABLE public.collab_stories
      ADD CONSTRAINT collab_stories_credits_is_array_check
      CHECK (jsonb_typeof(credits) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'collab_stories_media_count_check'
      AND conrelid = 'public.collab_stories'::regclass
  ) THEN
    ALTER TABLE public.collab_stories
      ADD CONSTRAINT collab_stories_media_count_check
      CHECK (array_length(media_urls, 1) IS NULL OR array_length(media_urls, 1) <= 10);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Indexes
--
-- The GIN index is what makes the profile's "Work" section cheap: stories
-- crediting a person are found with
--   credits @> '[{"user_id": "<uuid>"}]'
-- which is an index lookup rather than a scan over every story.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_collab_stories_author
  ON public.collab_stories(author_id);

CREATE INDEX IF NOT EXISTS idx_collab_stories_created
  ON public.collab_stories(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collab_stories_credits
  ON public.collab_stories USING GIN (credits jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_collab_stories_match
  ON public.collab_stories(match_id) WHERE match_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_collab_stories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collab_stories_updated_at ON public.collab_stories;
CREATE TRIGGER trg_collab_stories_updated_at
  BEFORE UPDATE ON public.collab_stories
  FOR EACH ROW EXECUTE FUNCTION public.touch_collab_stories_updated_at();

-- ------------------------------------------------------------
-- 4. Row level security
--
-- Read: any signed-in user sees public stories; an author always sees their
-- own, public or not. Write: only the author, and only their own rows —
-- author_id is pinned in the WITH CHECK so a client cannot post under
-- someone else's name.
-- ------------------------------------------------------------
ALTER TABLE public.collab_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stories are readable when public" ON public.collab_stories;
CREATE POLICY "Stories are readable when public"
  ON public.collab_stories FOR SELECT
  TO authenticated
  USING (is_public OR auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors insert their own stories" ON public.collab_stories;
CREATE POLICY "Authors insert their own stories"
  ON public.collab_stories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors update their own stories" ON public.collab_stories;
CREATE POLICY "Authors update their own stories"
  ON public.collab_stories FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors delete their own stories" ON public.collab_stories;
CREATE POLICY "Authors delete their own stories"
  ON public.collab_stories FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collab_stories TO authenticated;
