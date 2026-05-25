-- ============================================================
-- Melange Schema v4 — Trust, social links, ranked feed
-- Run AFTER supabase_schema_v3.sql. Idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profile social links
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- ------------------------------------------------------------
-- 2. Two-sided collab reviews (mutual reveal)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collab_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  reviewer_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags          TEXT[] NOT NULL DEFAULT '{}'::text[],
  body          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, reviewer_id),
  CHECK (reviewer_id <> reviewee_id)
);

CREATE INDEX IF NOT EXISTS idx_collab_reviews_reviewee ON public.collab_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_collab_reviews_match    ON public.collab_reviews(match_id);

ALTER TABLE public.collab_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own reviews on their matches" ON public.collab_reviews;
CREATE POLICY "Users insert own reviews on their matches"
  ON public.collab_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
        AND (reviewee_id = m.user1_id OR reviewee_id = m.user2_id)
        AND reviewee_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read mutually revealed reviews" ON public.collab_reviews;
CREATE POLICY "Users read mutually revealed reviews"
  ON public.collab_reviews FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      reviewer_id = auth.uid()
      OR reviewee_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.collab_reviews reciprocal
        WHERE reciprocal.match_id = collab_reviews.match_id
          AND reciprocal.reviewer_id = collab_reviews.reviewee_id
          AND reciprocal.reviewee_id = collab_reviews.reviewer_id
      )
    )
  );

-- ------------------------------------------------------------
-- 3. Reputation helper (visible reviews only)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creator_reputation(p_user_ids UUID[])
RETURNS TABLE (
  user_id       UUID,
  avg_rating    NUMERIC,
  review_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cr.reviewee_id AS user_id,
    ROUND(AVG(cr.rating)::numeric, 2) AS avg_rating,
    COUNT(*)::bigint AS review_count
  FROM public.collab_reviews cr
  WHERE cr.reviewee_id = ANY (p_user_ids)
    AND EXISTS (
      SELECT 1 FROM public.collab_reviews reciprocal
      WHERE reciprocal.match_id = cr.match_id
        AND reciprocal.reviewer_id = cr.reviewee_id
        AND reciprocal.reviewee_id = cr.reviewer_id
    )
  GROUP BY cr.reviewee_id;
$$;

GRANT EXECUTE ON FUNCTION public.creator_reputation(UUID[]) TO authenticated;

-- ------------------------------------------------------------
-- 4. Ranked swipe feed (recency + vibes + role fit + reputation)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ranked_feed_posts(p_user_id UUID)
RETURNS SETOF public.collab_posts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT role, COALESCE(vibes, '{}'::text[]) AS vibes, COALESCE(skills, '{}'::text[]) AS skills
    FROM public.profiles
    WHERE user_id = p_user_id
  ),
  rep AS (
    SELECT * FROM public.creator_reputation(
      ARRAY(SELECT DISTINCT owner_id FROM public.collab_posts WHERE is_active = true)
    )
  ),
  candidates AS (
    SELECT
      p.*,
      pr.role AS owner_role,
      COALESCE(pr.vibes, '{}'::text[]) AS owner_vibes,
      COALESCE(cardinality(pr.portfolio_urls), 0) AS portfolio_n,
      COALESCE(rep.avg_rating, 0) AS owner_avg_rating,
      COALESCE(rep.review_count, 0) AS owner_review_count,
      v.role AS viewer_role,
      v.vibes AS viewer_vibes,
      EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0 AS age_days
    FROM public.collab_posts p
    JOIN public.profiles pr ON pr.user_id = p.owner_id
    CROSS JOIN viewer v
    LEFT JOIN rep ON rep.user_id = p.owner_id
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
  ),
  scored AS (
    SELECT
      c.*,
      (
        0.30 * (1.0 / (1.0 + c.age_days / 7.0))
        + 0.25 * CASE
            WHEN cardinality(c.viewer_vibes) = 0 OR cardinality(COALESCE(c.vibes, '{}'::text[])) = 0 THEN 0.15
            ELSE (
              SELECT COUNT(*)::float / GREATEST(
                (SELECT COUNT(DISTINCT t) FROM unnest(c.viewer_vibes || COALESCE(c.vibes, '{}'::text[])) AS t),
                1
              )
              FROM unnest(c.viewer_vibes) AS v(tag)
              WHERE v.tag = ANY (COALESCE(c.vibes, '{}'::text[]))
            )
          END
        + 0.20 * CASE
            WHEN c.viewer_role IS NOT NULL AND c.looking_for IS NOT NULL
                 AND c.viewer_role = ANY (c.looking_for) THEN 1.0
            WHEN c.viewer_role IS NOT NULL AND c.owner_role IS NOT NULL
                 AND lower(c.viewer_role) <> lower(c.owner_role) THEN 0.55
            ELSE 0.1
          END
        + 0.15 * LEAST(c.owner_avg_rating / 5.0, 1.0)
        + 0.10 * LEAST(c.portfolio_n::float / 9.0, 1.0)
      ) AS rank_score
    FROM candidates c
  )
  SELECT
    id, owner_id, title, description, looking_for, location, compensation,
    media_urls, is_active, created_at, updated_at, vibes
  FROM scored
  ORDER BY rank_score DESC, created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.ranked_feed_posts(UUID) TO authenticated;

-- Explore browse: includes already-swiped posts; blocks excluded; ranked
CREATE OR REPLACE FUNCTION public.explore_posts(p_user_id UUID, p_limit INT DEFAULT 40)
RETURNS SETOF public.collab_posts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT role, COALESCE(vibes, '{}'::text[]) AS vibes
    FROM public.profiles WHERE user_id = p_user_id
  ),
  rep AS (
    SELECT * FROM public.creator_reputation(
      ARRAY(SELECT DISTINCT owner_id FROM public.collab_posts WHERE is_active = true)
    )
  ),
  candidates AS (
    SELECT p.*, COALESCE(rep.avg_rating, 0) AS owner_avg_rating,
      EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0 AS age_days
    FROM public.collab_posts p
    LEFT JOIN rep ON rep.user_id = p.owner_id
    WHERE p.owner_id <> p_user_id AND p.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = p_user_id AND b.blocked_id = p.owner_id)
           OR (b.blocker_id = p.owner_id AND b.blocked_id = p_user_id)
      )
  )
  SELECT id, owner_id, title, description, looking_for, location, compensation,
         media_urls, is_active, created_at, updated_at, vibes
  FROM candidates
  ORDER BY (0.5 / (1.0 + age_days / 7.0) + 0.5 * LEAST(owner_avg_rating / 5.0, 1.0)) DESC,
           created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.explore_posts(UUID, INT) TO authenticated;

-- Pending review for a match (your draft or nothing)
CREATE OR REPLACE FUNCTION public.my_review_for_match(p_match_id UUID, p_user_id UUID)
RETURNS SETOF public.collab_reviews
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cr.*
  FROM public.collab_reviews cr
  WHERE cr.match_id = p_match_id AND cr.reviewer_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.my_review_for_match(UUID, UUID) TO authenticated;
