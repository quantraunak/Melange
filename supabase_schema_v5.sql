-- ============================================================
-- Melange Schema v5 — Analytics, verification, embeddings, ranking v2
-- Run AFTER supabase_schema_v4.sql. Idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Product analytics (server-side funnel)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name  TEXT NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time
  ON public.analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time
  ON public.analytics_events(user_id, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own analytics events" ON public.analytics_events;
CREATE POLICY "Users insert own analytics events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No SELECT for clients — query via dashboard / service role only.

CREATE OR REPLACE FUNCTION public.track_event(
  p_event_name TEXT,
  p_properties JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.analytics_events (user_id, event_name, properties)
  VALUES (auth.uid(), p_event_name, COALESCE(p_properties, '{}'::jsonb));
$$;

GRANT EXECUTE ON FUNCTION public.track_event(TEXT, JSONB) TO authenticated;

-- ------------------------------------------------------------
-- 2. Verification badge (trust signal for ranking + UI)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

UPDATE public.profiles SET verification_status = 'none' WHERE verification_status IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN verification_status SET DEFAULT 'none';

ALTER TABLE public.profiles
  ALTER COLUMN verification_status SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_verification_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_verification_status_check
  CHECK (verification_status IN ('none', 'pending', 'verified'));

CREATE OR REPLACE FUNCTION public.refresh_profile_verification(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instagram TEXT;
  v_portfolio INT;
  v_reviews BIGINT;
  v_avg NUMERIC;
BEGIN
  SELECT instagram_url, cardinality(COALESCE(portfolio_urls, '{}'::text[]))
  INTO v_instagram, v_portfolio
  FROM public.profiles WHERE user_id = p_user_id;

  SELECT review_count, avg_rating INTO v_reviews, v_avg
  FROM public.creator_reputation(ARRAY[p_user_id]);

  IF v_instagram IS NOT NULL
     AND v_portfolio >= 3
     AND COALESCE(v_reviews, 0) >= 2
     AND COALESCE(v_avg, 0) >= 4.0 THEN
    UPDATE public.profiles
    SET verification_status = 'verified',
        verified_at = COALESCE(verified_at, now())
    WHERE user_id = p_user_id AND verification_status IS DISTINCT FROM 'verified';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_profile_verification(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 3. Text embeddings (128-dim, SQL — no external API required)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_embedding REAL[];

ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS post_embedding REAL[];

CREATE OR REPLACE FUNCTION public.compute_text_embedding(p_text TEXT)
RETURNS REAL[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  dims INT := 128;
  vec REAL[];
  tok TEXT;
  idx INT;
  norm DOUBLE PRECISION;
  i INT;
BEGIN
  vec := array_fill(0::REAL, ARRAY[dims]);
  IF p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RETURN vec;
  END IF;
  FOR tok IN
    SELECT unnest(regexp_split_to_array(lower(trim(p_text)), '[^a-z0-9]+'))
  LOOP
    IF tok IS NULL OR length(tok) < 2 THEN
      CONTINUE;
    END IF;
    idx := (abs(hashtext(tok)) % dims) + 1;
    vec[idx] := vec[idx] + 1;
  END LOOP;
  norm := 0;
  FOR i IN 1..dims LOOP
    norm := norm + (vec[i]::double precision) ^ 2;
  END LOOP;
  norm := sqrt(norm);
  IF norm > 0 THEN
    FOR i IN 1..dims LOOP
      vec[i] := (vec[i]::double precision / norm)::REAL;
    END LOOP;
  END IF;
  RETURN vec;
END;
$$;

CREATE OR REPLACE FUNCTION public.embedding_cosine(a REAL[], b REAL[])
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL OR array_length(a, 1) IS NULL OR array_length(b, 1) IS NULL THEN 0::double precision
    ELSE COALESCE((
      SELECT SUM(x * y) / NULLIF(sqrt(SUM(x * x)) * sqrt(SUM(y * y)), 0)
      FROM generate_series(1, LEAST(array_length(a, 1), array_length(b, 1))) AS s(i)
      CROSS JOIN LATERAL (SELECT a[i] AS x, b[i] AS y) v
    ), 0::double precision)
  END;
$$;

CREATE OR REPLACE FUNCTION public.profile_embedding_text(p public.profiles)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(concat_ws(' ',
    p.name, p.role, p.bio, p.current_project,
    array_to_string(COALESCE(p.skills, '{}'::text[]), ' '),
    array_to_string(COALESCE(p.vibes, '{}'::text[]), ' ')
  ));
$$;

CREATE OR REPLACE FUNCTION public.post_embedding_text(p public.collab_posts)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(concat_ws(' ',
    p.title, p.description, p.location, p.compensation,
    array_to_string(COALESCE(p.looking_for, '{}'::text[]), ' '),
    array_to_string(COALESCE(p.vibes, '{}'::text[]), ' ')
  ));
$$;

CREATE OR REPLACE FUNCTION public.refresh_profile_embedding_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.profile_embedding := public.compute_text_embedding(public.profile_embedding_text(NEW));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_post_embedding_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.post_embedding := public.compute_text_embedding(public.post_embedding_text(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_embedding ON public.profiles;
CREATE TRIGGER trg_profiles_embedding
  BEFORE INSERT OR UPDATE OF name, role, bio, current_project, skills, vibes
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.refresh_profile_embedding_row();

DROP TRIGGER IF EXISTS trg_posts_embedding ON public.collab_posts;
CREATE TRIGGER trg_posts_embedding
  BEFORE INSERT OR UPDATE OF title, description, location, compensation, looking_for, vibes
  ON public.collab_posts
  FOR EACH ROW EXECUTE FUNCTION public.refresh_post_embedding_row();

-- Backfill existing rows
UPDATE public.profiles
SET profile_embedding = public.compute_text_embedding(public.profile_embedding_text(profiles.*))
WHERE profile_embedding IS NULL;

UPDATE public.collab_posts
SET post_embedding = public.compute_text_embedding(public.post_embedding_text(collab_posts.*))
WHERE post_embedding IS NULL;

-- ------------------------------------------------------------
-- 4. Ranked feed v2 (+ embedding similarity + event liquidity)
-- ------------------------------------------------------------
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
  SELECT
    id, owner_id, title, description, looking_for, location, compensation,
    media_urls, is_active, created_at, updated_at, vibes, post_embedding
  FROM scored
  ORDER BY rank_score DESC, created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.trg_review_refresh_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_profile_verification(NEW.reviewee_id);
  PERFORM public.refresh_profile_verification(NEW.reviewer_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collab_reviews_verification ON public.collab_reviews;
CREATE TRIGGER trg_collab_reviews_verification
  AFTER INSERT ON public.collab_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_review_refresh_verification();

-- Refresh verification for all profiles with reviews (one-time + ongoing via app)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT reviewee_id AS uid FROM public.collab_reviews LOOP
    PERFORM public.refresh_profile_verification(r.uid);
  END LOOP;
  FOR r IN SELECT user_id AS uid FROM public.profiles WHERE instagram_url IS NOT NULL LOOP
    PERFORM public.refresh_profile_verification(r.uid);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 7. Fix: explore_posts still returning pre-embedding column set
--    (post_embedding was added earlier in this file; explore_posts
--    was never updated to select it, so its declared return type
--    RETURNS SETOF public.collab_posts no longer matched — Postgres
--    error 42P13 "return type mismatch" on every call.)
-- ------------------------------------------------------------
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
         media_urls, is_active, created_at, updated_at, vibes, post_embedding
  FROM candidates
  ORDER BY (0.5 / (1.0 + age_days / 7.0) + 0.5 * LEAST(owner_avg_rating / 5.0, 1.0)) DESC,
           created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.explore_posts(UUID, INT) TO authenticated;

-- ------------------------------------------------------------
-- 8. Fix: infinite recursion in collab_reviews SELECT policy
--    (the policy's USING clause queried collab_reviews itself to
--    check for a reciprocal review, which re-triggers the same
--    policy on the referenced rows — Postgres error 42P17.
--    Move the self-reference into a SECURITY DEFINER function,
--    the standard way to break recursive RLS policies.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_has_reciprocal(p_match_id UUID, p_reviewer_id UUID, p_reviewee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collab_reviews r
    WHERE r.match_id = p_match_id
      AND r.reviewer_id = p_reviewee_id
      AND r.reviewee_id = p_reviewer_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.review_has_reciprocal(UUID, UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Users read mutually revealed reviews" ON public.collab_reviews;
CREATE POLICY "Users read mutually revealed reviews"
  ON public.collab_reviews FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      reviewer_id = auth.uid()
      OR reviewee_id = auth.uid()
      OR public.review_has_reciprocal(match_id, reviewer_id, reviewee_id)
    )
  );

-- ------------------------------------------------------------
-- 9. Fix: chat had no live delivery — messages/matches were never
--    added to the supabase_realtime publication (this is normally a
--    manual Dashboard → Database → Replication toggle, so it doesn't
--    happen automatically on a scripted setup). Without it, the chat
--    screen's postgres_changes subscription connects but never fires,
--    so new messages only show up after the chat is closed and
--    reopened. Script it here so it's no longer a manual step.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
END $$;
