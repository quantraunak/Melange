-- ============================================================
-- Melange Schema v2 — additions for native app
-- Run this AFTER supabase_schema.sql.
-- Idempotent.
-- ============================================================

-- ===================
-- 6. blocks (App Store UGC requirement)
-- ===================
CREATE TABLE IF NOT EXISTS public.blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own blocks" ON public.blocks;
CREATE POLICY "Users see their own blocks"
  ON public.blocks FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users create their own blocks" ON public.blocks;
CREATE POLICY "Users create their own blocks"
  ON public.blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users delete their own blocks" ON public.blocks;
CREATE POLICY "Users delete their own blocks"
  ON public.blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- ===================
-- 7. reports (App Store UGC requirement)
-- ===================
CREATE TABLE IF NOT EXISTS public.reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_kind   TEXT NOT NULL CHECK (target_kind IN ('user', 'post', 'message')),
  target_id     UUID NOT NULL,
  reason        TEXT NOT NULL,
  details       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_target   ON public.reports(target_kind, target_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own reports" ON public.reports;
CREATE POLICY "Users see their own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users create reports" ON public.reports;
CREATE POLICY "Users create reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ===================
-- 8. push_tokens (one per device per user)
-- ===================
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL DEFAULT 'ios',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage their own push tokens"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===================
-- 9. match_reads (server-side unread tracking)
--    One row per (match, user) recording when they last read the chat.
-- ===================
CREATE TABLE IF NOT EXISTS public.match_reads (
  match_id     UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

ALTER TABLE public.match_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own match reads" ON public.match_reads;
CREATE POLICY "Users see their own match reads"
  ON public.match_reads FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users upsert their own match reads" ON public.match_reads;
CREATE POLICY "Users upsert their own match reads"
  ON public.match_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their own match reads" ON public.match_reads;
CREATE POLICY "Users update their own match reads"
  ON public.match_reads FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- Filter swipe feed to exclude blocked users in both directions
-- The web/native client can call this RPC instead of selecting collab_posts directly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.feed_posts(p_user_id UUID)
RETURNS SETOF public.collab_posts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.collab_posts p
  WHERE p.owner_id <> p_user_id
    AND p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = p.owner_id)
         OR (b.blocker_id = p.owner_id AND b.blocked_id = p_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes s
      WHERE s.swiper_id = p_user_id AND s.post_id = p.id
    )
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.feed_posts(UUID) TO authenticated;

-- ============================================================
-- Account self-deletion (App Store requirement 5.1.1(v))
-- The user can wipe themselves; cascades remove all their data.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cascading FKs handle most cleanup; remove the auth row.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;

-- ============================================================
-- updated_at column + trigger for collab_posts (so edits update timestamp)
-- ============================================================

ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collab_posts_touch_updated_at ON public.collab_posts;
CREATE TRIGGER trg_collab_posts_touch_updated_at
  BEFORE UPDATE ON public.collab_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
