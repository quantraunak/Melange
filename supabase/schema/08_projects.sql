-- ============================================================
-- 08_shoots.sql — a post becomes a shoot (crew call)
--
-- docs/PLAN.md sharpens the product to crew calls for student and indie film:
-- a producer posts a shoot with the roles still open, the dates and the pay
-- type; actors and crew apply by swiping. collab_posts already carries most of
-- this (title, description, looking_for, location, compensation, media). This
-- file adds the structured fields the new UI needs and keeps the old columns
-- so existing rows and the web client keep working untouched.
--
-- Also adds profiles.reel_url (a link to a reel or portfolio site) and a
-- credits view: once two people have matched and one has reviewed the other,
-- the reviewee earns a credit on the reviewer's shoot. Reviews are the only
-- "we actually worked together" signal the schema has today, so credits are
-- derived from them rather than stored twice.
--
-- Safe to run more than once. Must be applied to the Supabase project by the
-- owner; the clients tolerate its absence (fields come back undefined).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Structured shoot fields on collab_posts
-- ------------------------------------------------------------
ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS shoot_start DATE,
  ADD COLUMN IF NOT EXISTS shoot_end   DATE,
  ADD COLUMN IF NOT EXISTS roles       TEXT[],
  ADD COLUMN IF NOT EXISTS pay_type    TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'collab_posts_pay_type_check'
      AND conrelid = 'public.collab_posts'::regclass
  ) THEN
    ALTER TABLE public.collab_posts
      ADD CONSTRAINT collab_posts_pay_type_check
      CHECK (pay_type IS NULL OR pay_type IN ('paid', 'tfp', 'credit'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'collab_posts_shoot_dates_check'
      AND conrelid = 'public.collab_posts'::regclass
  ) THEN
    ALTER TABLE public.collab_posts
      ADD CONSTRAINT collab_posts_shoot_dates_check
      CHECK (shoot_start IS NULL OR shoot_end IS NULL OR shoot_end >= shoot_start);
  END IF;
END $$;

COMMENT ON COLUMN public.collab_posts.roles IS
  'Open roles on this shoot. Fixed vocabulary, enforced by the clients: '
  'Director, Producer, DP, 1st AC, Gaffer, Sound, Editor, Colorist, Actor, PA, '
  'Stylist, MUA, Photographer, Model, Other.';
COMMENT ON COLUMN public.collab_posts.pay_type IS
  'paid | tfp (time for prints/footage) | credit (credit and meals only). '
  'Free-text detail stays in compensation.';

CREATE INDEX IF NOT EXISTS idx_collab_posts_shoot_start
  ON public.collab_posts(shoot_start) WHERE is_active;

-- ------------------------------------------------------------
-- 2. A reel link on the profile
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reel_url TEXT;

-- ------------------------------------------------------------
-- 3. Credits, derived from reviews
--
-- security_invoker so the caller's own RLS on collab_reviews, matches and
-- collab_posts applies: you see credits on matches you are part of, which is
-- what the profile screen needs. A public credits list is a later decision.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.credits
WITH (security_invoker = true) AS
SELECT
  r.id                              AS review_id,
  r.match_id,
  r.reviewee_id                     AS user_id,
  r.reviewer_id                     AS credited_by,
  CASE WHEN m.user1_id = r.reviewer_id THEN m.post1_id ELSE m.post2_id END AS post_id,
  p.title,
  p.shoot_start,
  p.shoot_end,
  r.rating,
  r.created_at
FROM public.collab_reviews r
JOIN public.matches m ON m.id = r.match_id
JOIN public.collab_posts p
  ON p.id = CASE WHEN m.user1_id = r.reviewer_id THEN m.post1_id ELSE m.post2_id END;

GRANT SELECT ON public.credits TO authenticated;
