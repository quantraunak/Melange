-- ============================================================
-- 10_feed_functions.sql — make the feed functions column-proof
--
-- Both ranked_feed_posts and explore_posts are declared
-- `RETURNS SETOF public.collab_posts` and ended with a SELECT that
-- ENUMERATED the table's columns by hand. 08_projects.sql added
-- project_start, project_end, roles and pay_type to collab_posts, so
-- the enumerated list stopped matching the declared return type and
-- Postgres refused both functions with 42P13, "return type mismatch".
--
-- The app caught the ranked one and fell back to the unranked feed, so
-- nothing looked broken while the ranking silently stopped running.
-- Explore degraded the same way.
--
-- This is the SECOND time this has happened: section 7 of 05_ranking.sql
-- records the same failure when post_embedding was added, and it was
-- fixed by re-typing the column list, which is what set up this repeat.
--
-- The fix here is structural rather than another list: the final SELECT
-- now joins back to collab_posts and returns `cp.*`, so the row always
-- matches the declared type no matter how many columns the table gains.
-- The scoring logic is untouched.
--
-- Safe to run more than once.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ranked_feed_posts(p_user_id UUID)
RETURNS SETOF public.collab_posts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT
      user_id,
      role,
      COALESCE(vibes, '{}'::text[]) AS vibes,
      profile_embedding AS viewer_embedding
    FROM public.profiles
    WHERE user_id = p_user_id
  ),
  viewer_events AS (
    SELECT DISTINCT er.event_id
    FROM public.event_rsvps er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.user_id = p_user_id
      AND NOT e.is_canceled
      AND e.start_at > now()
  ),
  viewer_cities AS (
    SELECT DISTINCT lower(e.city) AS city
    FROM public.event_rsvps er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.user_id = p_user_id
      AND e.city IS NOT NULL
      AND NOT e.is_canceled
      AND e.start_at > now()
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
      pr.verification_status AS owner_verified,
      COALESCE(pr.vibes, '{}'::text[]) AS owner_vibes,
      pr.profile_embedding AS owner_embedding,
      COALESCE(cardinality(pr.portfolio_urls), 0) AS portfolio_n,
      COALESCE(rep.avg_rating, 0) AS owner_avg_rating,
      COALESCE(rep.review_count, 0) AS owner_review_count,
      v.role AS viewer_role,
      v.vibes AS viewer_vibes,
      v.viewer_embedding,
      EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0 AS age_days,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.event_rsvps oer
        WHERE oer.user_id = p.owner_id
          AND oer.event_id IN (SELECT event_id FROM viewer_events)
      ) THEN 1.0 ELSE 0.0 END AS shared_event_boost,
      CASE WHEN EXISTS (
        SELECT 1 FROM viewer_cities vc
        WHERE (
          p.location IS NOT NULL AND lower(p.location) LIKE '%' || vc.city || '%'
        ) OR EXISTS (
          SELECT 1 FROM public.event_rsvps oer2
          JOIN public.events e2 ON e2.id = oer2.event_id
          WHERE oer2.user_id = p.owner_id
            AND lower(e2.city) = vc.city
            AND NOT e2.is_canceled
            AND e2.start_at > now()
        )
      ) THEN 0.6 ELSE 0.0 END AS city_event_boost
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
      GREATEST(0, LEAST(1, public.embedding_cosine(c.viewer_embedding, c.post_embedding))) AS embed_score,
      (
        0.22 * (1.0 / (1.0 + c.age_days / 7.0))
        + 0.18 * CASE
            WHEN cardinality(c.viewer_vibes) = 0 OR cardinality(COALESCE(c.vibes, '{}'::text[])) = 0 THEN 0.12
            ELSE (
              SELECT COUNT(*)::float / GREATEST(
                (SELECT COUNT(DISTINCT t) FROM unnest(c.viewer_vibes || COALESCE(c.vibes, '{}'::text[])) AS t),
                1
              )
              FROM unnest(c.viewer_vibes) AS v(tag)
              WHERE v.tag = ANY (COALESCE(c.vibes, '{}'::text[]))
            )
          END
        + 0.18 * CASE
            WHEN c.viewer_role IS NOT NULL AND c.looking_for IS NOT NULL
                 AND c.viewer_role = ANY (c.looking_for) THEN 1.0
            WHEN c.viewer_role IS NOT NULL AND c.owner_role IS NOT NULL
                 AND lower(c.viewer_role) <> lower(c.owner_role) THEN 0.55
            ELSE 0.1
          END
        + 0.12 * LEAST(c.owner_avg_rating / 5.0, 1.0)
        + 0.08 * LEAST(c.portfolio_n::float / 9.0, 1.0)
        + 0.12 * GREATEST(0, LEAST(1, public.embedding_cosine(c.viewer_embedding, c.post_embedding)))
        + 0.05 * c.shared_event_boost
        + 0.05 * c.city_event_boost
        + CASE WHEN c.owner_verified = 'verified' THEN 0.05 ELSE 0 END
      ) AS rank_score
    FROM candidates c
  )
  SELECT cp.*
  FROM scored s
  JOIN public.collab_posts cp ON cp.id = s.id
  ORDER BY s.rank_score DESC, cp.created_at DESC;
$$;

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
  SELECT cp.*
  FROM candidates c
  JOIN public.collab_posts cp ON cp.id = c.id
  ORDER BY (0.5 / (1.0 + c.age_days / 7.0) + 0.5 * LEAST(c.owner_avg_rating / 5.0, 1.0)) DESC,
           cp.created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.ranked_feed_posts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.explore_posts(UUID, INT) TO authenticated;
