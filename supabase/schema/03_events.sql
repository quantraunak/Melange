-- ============================================================
-- Melange Schema v3 — Phase 1: Events + Vibes + Portfolios
-- Run this AFTER supabase_schema_v2.sql.
-- Idempotent.
-- See docs/STRATEGY.md and docs/ROADMAP.md for context.
-- ============================================================

-- ============================================================
-- 10. events  (creative meetups, photo walks, open calls, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description     TEXT,
  category        TEXT NOT NULL CHECK (category IN (
                    'photo_walk','open_call','gallery','meetup',
                    'workshop','exhibition','other'
                  )),
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  location_name   TEXT,                 -- "Washington Square Park, NYC"
  city            TEXT,                 -- normalized for search: lowercased
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  cover_url       TEXT,
  capacity        INT CHECK (capacity IS NULL OR capacity > 0),
  is_canceled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CHECK (end_at IS NULL OR end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_events_start_at  ON public.events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_city      ON public.events(city);
CREATE INDEX IF NOT EXISTS idx_events_host      ON public.events(host_id);
CREATE INDEX IF NOT EXISTS idx_events_category  ON public.events(category);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can see active (not canceled) events.
DROP POLICY IF EXISTS "Events are readable to authenticated users" ON public.events;
CREATE POLICY "Events are readable to authenticated users"
  ON public.events FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Hosts create their own events" ON public.events;
CREATE POLICY "Hosts create their own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts update their own events" ON public.events;
CREATE POLICY "Hosts update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts delete their own events" ON public.events;
CREATE POLICY "Hosts delete their own events"
  ON public.events FOR DELETE
  USING (auth.uid() = host_id);

-- ============================================================
-- 11. event_rsvps
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state       TEXT NOT NULL DEFAULT 'going' CHECK (state IN ('going','interested')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user  ON public.event_rsvps(user_id);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can see RSVPs (powers attendee avatars / counts).
DROP POLICY IF EXISTS "RSVPs readable to authenticated users" ON public.event_rsvps;
CREATE POLICY "RSVPs readable to authenticated users"
  ON public.event_rsvps FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users RSVP for themselves" ON public.event_rsvps;
CREATE POLICY "Users RSVP for themselves"
  ON public.event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their own RSVP" ON public.event_rsvps;
CREATE POLICY "Users update their own RSVP"
  ON public.event_rsvps FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete their own RSVP" ON public.event_rsvps;
CREATE POLICY "Users delete their own RSVP"
  ON public.event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 12. Vibes (aesthetic tags) on posts and profiles
-- ============================================================
ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS vibes TEXT[] DEFAULT '{}'::text[];

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vibes TEXT[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_collab_posts_vibes ON public.collab_posts USING GIN (vibes);
CREATE INDEX IF NOT EXISTS idx_profiles_vibes     ON public.profiles     USING GIN (vibes);

-- ============================================================
-- 13. Portfolio media on profiles
--     Stored as TEXT[] of public URLs in the 'media' storage bucket.
--     Order in the array is the display order.
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portfolio_urls TEXT[] DEFAULT '{}'::text[];

-- ============================================================
-- 14. updated_at trigger on events
-- ============================================================
DROP TRIGGER IF EXISTS trg_events_touch_updated_at ON public.events;
CREATE TRIGGER trg_events_touch_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 15. RPC: upcoming_events (the events feed)
--     Returns events that haven't started yet (or are in-progress
--     for events with an end_at), excluding canceled, optionally
--     filtered by city (case-insensitive partial match).
-- ============================================================
CREATE OR REPLACE FUNCTION public.upcoming_events(p_city TEXT DEFAULT NULL)
RETURNS SETOF public.events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.events e
  WHERE e.is_canceled = FALSE
    AND COALESCE(e.end_at, e.start_at + interval '4 hours') > now()
    AND (
      p_city IS NULL
      OR p_city = ''
      OR position(lower(p_city) in lower(coalesce(e.city, ''))) > 0
      OR position(lower(p_city) in lower(coalesce(e.location_name, ''))) > 0
    )
  ORDER BY e.start_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.upcoming_events(TEXT) TO authenticated;

-- ============================================================
-- 16. RPC: event_attendee_count (used to badge cards efficiently)
-- ============================================================
CREATE OR REPLACE FUNCTION public.event_attendee_counts(p_event_ids UUID[])
RETURNS TABLE(event_id UUID, going_count BIGINT, interested_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    er.event_id,
    count(*) FILTER (WHERE er.state = 'going')      AS going_count,
    count(*) FILTER (WHERE er.state = 'interested') AS interested_count
  FROM public.event_rsvps er
  WHERE er.event_id = ANY(p_event_ids)
  GROUP BY er.event_id;
$$;

GRANT EXECUTE ON FUNCTION public.event_attendee_counts(UUID[]) TO authenticated;
