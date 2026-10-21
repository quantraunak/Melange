-- ============================================================
-- 26_room_composer.sql — the AI decides who should meet, and we measure
-- whether it's right
--
-- Melange composes each night's tables. A person's TASTE is a vector built
-- from the images they've made and loved (an open-source CLIP model, run as
-- a batch job: scripts/taste/). A PAIR SCORE combines taste, complementary
-- roles and shared vibes, with weights learned from what actually happened
-- at past nights. The COMPOSER (supabase/functions/compose-tables) fills
-- tables of ~6 so whole tables work, not just pairs.
--
-- Every night is an experiment: attendees are randomly split into an
-- 'ai' arm (seated by the composer) and a 'random' arm (seated at random).
-- night_experiment_results compares the arms on what we care about:
-- mutual hearts, conversations that keep going, and coming back.
--
-- Faces are never scored. Taste comes from the content of images people
-- chose to post or heart, and only for members with images.
--
-- Safe to run more than once. Apply AFTER 25_web_rsvp_and_night_photos.sql.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- Taste vectors (written by the batch job with the service role)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.taste_vectors (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding   extensions.vector(512) NOT NULL,
  model       TEXT NOT NULL,              -- e.g. 'open_clip:ViT-B-32/laion2b_s34b_b79k'
  image_count INT NOT NULL CHECK (image_count > 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS on, no policies: vectors are only read by SECURITY DEFINER functions.
ALTER TABLE public.taste_vectors ENABLE ROW LEVEL SECURITY;

-- Learned weights for the pair score. One active row; the learner inserts
-- a new row each time it refits, so past runs stay explainable.
CREATE TABLE IF NOT EXISTS public.pair_model (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  w_taste     REAL NOT NULL,
  w_roles     REAL NOT NULL,
  w_vibes     REAL NOT NULL,
  w_bias      REAL NOT NULL DEFAULT 0,
  trained_on  INT NOT NULL DEFAULT 0,     -- number of pairs it was fit on
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pair_model ENABLE ROW LEVEL SECURITY;

-- The prior before any night has happened: taste matters most, a mixed
-- table (photographer + stylist + model) helps, shared vibes help a little.
INSERT INTO public.pair_model (w_taste, w_roles, w_vibes, note)
SELECT 1.0, 0.6, 0.3, 'prior, before any outcomes'
WHERE NOT EXISTS (SELECT 1 FROM public.pair_model);

-- ------------------------------------------------------------
-- Seating, by arm
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.night_seating (
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arm        TEXT NOT NULL CHECK (arm IN ('ai', 'random')),
  table_no   INT NOT NULL CHECK (table_no > 0),
  model_id   UUID REFERENCES public.pair_model(id),
  run_id     UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_night_seating_table ON public.night_seating(event_id, arm, table_no);
ALTER TABLE public.night_seating ENABLE ROW LEVEL SECURITY;

-- Members of a night see the seating (who's at their table). The arm is
-- not exposed to attendees by the read functions below, so people don't
-- know which half they're in.
DROP POLICY IF EXISTS "Hosts read seating" ON public.night_seating;
CREATE POLICY "Hosts read seating"
  ON public.night_seating FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
         OR public.is_admin());

-- ------------------------------------------------------------
-- Features for the composer (called by the Edge Function with the
-- caller's JWT; only the host or an admin can compose)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.composer_inputs(p_event UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_host UUID;
BEGIN
  SELECT host_id INTO v_host FROM public.events WHERE id = p_event;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'That night doesn''t exist.';
  END IF;
  IF auth.uid() IS DISTINCT FROM v_host AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the host can seat the room.';
  END IF;

  RETURN jsonb_build_object(
    'model', (SELECT to_jsonb(m) FROM public.pair_model m ORDER BY created_at DESC LIMIT 1),
    'people', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', p.user_id,
        'role', public.norm_role(p.role),
        'vibes', to_jsonb(coalesce(p.vibes, '{}')),
        'taste', CASE WHEN tv.embedding IS NULL THEN NULL ELSE to_jsonb(tv.embedding::real[]) END))
      FROM (
        SELECT v_host AS uid
        UNION
        SELECT r.user_id FROM public.event_rsvps r WHERE r.event_id = p_event AND r.state = 'going'
      ) g
      JOIN public.profiles p ON p.user_id = g.uid
      LEFT JOIN public.taste_vectors tv ON tv.user_id = g.uid
    ), '[]'::jsonb),
    'blocked_pairs', coalesce((
      SELECT jsonb_agg(jsonb_build_array(b.blocker_id, b.blocked_id))
      FROM public.blocks b
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.composer_inputs(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.composer_inputs(UUID) TO authenticated;

-- Save a seating run. Replaces any earlier run for the night.
CREATE OR REPLACE FUNCTION public.save_seating(p_event UUID, p_model UUID, p_rows JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host UUID;
  v_run  UUID := gen_random_uuid();
BEGIN
  SELECT host_id INTO v_host FROM public.events WHERE id = p_event;
  IF auth.uid() IS DISTINCT FROM v_host AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the host can seat the room.';
  END IF;
  DELETE FROM public.night_seating WHERE event_id = p_event;
  INSERT INTO public.night_seating (event_id, user_id, arm, table_no, model_id, run_id)
  SELECT p_event, (r ->> 'user_id')::uuid, r ->> 'arm', (r ->> 'table_no')::int, p_model, v_run
  FROM jsonb_array_elements(p_rows) r;
  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.save_seating(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_seating(UUID, UUID, JSONB) TO authenticated;

-- What an attendee sees: their table and who's at it. No arm.
CREATE OR REPLACE FUNCTION public.my_table(p_event UUID)
RETURNS TABLE (table_no INT, user_id UUID, name TEXT, avatar_url TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s2.table_no, p.user_id, p.name, p.avatar_url, p.role
  FROM public.night_seating s1
  JOIN public.night_seating s2
    ON s2.event_id = s1.event_id AND s2.arm = s1.arm AND s2.table_no = s1.table_no
  JOIN public.profiles p ON p.user_id = s2.user_id
  WHERE s1.event_id = p_event AND s1.user_id = auth.uid()
    AND NOT public.is_blocked_pair(auth.uid(), s2.user_id)
  ORDER BY (p.user_id = auth.uid()) DESC, p.name;
$$;

REVOKE ALL ON FUNCTION public.my_table(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_table(UUID) TO authenticated;

-- ------------------------------------------------------------
-- The experiment: outcomes per pair who shared a table
-- ------------------------------------------------------------
-- One row per unordered pair seated at the same table at a night, with
-- what happened afterwards:
--   mutual  — they hearted each other in Afterglow
--   talked  — 2+ messages between them in the 7 days after the night
--   again   — both went to another night later
CREATE OR REPLACE VIEW public.night_pair_outcomes AS
SELECT
  a.event_id, a.arm, a.table_no,
  a.user_id AS user_a, b.user_id AS user_b,
  EXISTS (SELECT 1 FROM public.event_hearts h1 JOIN public.event_hearts h2
            ON h2.event_id = h1.event_id AND h2.from_user = h1.to_user AND h2.to_user = h1.from_user
          WHERE h1.event_id = a.event_id AND h1.from_user = a.user_id AND h1.to_user = b.user_id) AS mutual,
  (SELECT count(*) FROM public.messages m
     JOIN public.matches mt ON mt.id = m.match_id
     JOIN public.events e ON e.id = a.event_id
     WHERE mt.user1_id = least(a.user_id, b.user_id) AND mt.user2_id = greatest(a.user_id, b.user_id)
       AND m.created_at BETWEEN e.start_at AND coalesce(e.end_at, e.start_at) + interval '7 days') >= 2 AS talked,
  EXISTS (SELECT 1 FROM public.event_rsvps ra JOIN public.event_rsvps rb ON rb.event_id = ra.event_id
          JOIN public.events e2 ON e2.id = ra.event_id
          JOIN public.events e1 ON e1.id = a.event_id
          WHERE ra.user_id = a.user_id AND rb.user_id = b.user_id
            AND ra.state = 'going' AND rb.state = 'going' AND e2.start_at > e1.start_at) AS again
FROM public.night_seating a
JOIN public.night_seating b
  ON b.event_id = a.event_id AND b.arm = a.arm AND b.table_no = a.table_no AND b.user_id > a.user_id;

REVOKE ALL ON public.night_pair_outcomes FROM PUBLIC, anon, authenticated;

-- The headline numbers per arm, across all nights so far.
CREATE OR REPLACE FUNCTION public.night_experiment_results()
RETURNS TABLE (arm TEXT, nights BIGINT, people BIGINT, pairs BIGINT,
               mutual_rate NUMERIC, talked_rate NUMERIC, again_rate NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.arm,
         count(DISTINCT o.event_id),
         (SELECT count(*) FROM public.night_seating s WHERE s.arm = o.arm),
         count(*),
         round(avg(o.mutual::int), 3),
         round(avg(o.talked::int), 3),
         round(avg(o.again::int), 3)
  FROM public.night_pair_outcomes o
  WHERE public.is_admin()
  GROUP BY o.arm
  ORDER BY o.arm;
$$;

REVOKE ALL ON FUNCTION public.night_experiment_results() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.night_experiment_results() TO authenticated;

-- ------------------------------------------------------------
-- Nights too small for two arms are seated by the AI but must not count
-- toward the experiment, or the 'ai' arm would get them for free.
-- ------------------------------------------------------------
ALTER TABLE public.night_seating ADD COLUMN IF NOT EXISTS in_experiment BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.save_seating(p_event UUID, p_model UUID, p_rows JSONB, p_experiment BOOLEAN DEFAULT true)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host UUID;
  v_run  UUID := gen_random_uuid();
BEGIN
  SELECT host_id INTO v_host FROM public.events WHERE id = p_event;
  IF auth.uid() IS DISTINCT FROM v_host AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the host can seat the room.';
  END IF;
  DELETE FROM public.night_seating WHERE event_id = p_event;
  INSERT INTO public.night_seating (event_id, user_id, arm, table_no, model_id, run_id, in_experiment)
  SELECT p_event, (r ->> 'user_id')::uuid, r ->> 'arm', (r ->> 'table_no')::int, p_model, v_run, p_experiment
  FROM jsonb_array_elements(p_rows) r;
  RETURN v_run;
END;
$$;

DROP FUNCTION IF EXISTS public.save_seating(UUID, UUID, JSONB);
REVOKE ALL ON FUNCTION public.save_seating(UUID, UUID, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_seating(UUID, UUID, JSONB, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.night_experiment_results()
RETURNS TABLE (arm TEXT, nights BIGINT, people BIGINT, pairs BIGINT,
               mutual_rate NUMERIC, talked_rate NUMERIC, again_rate NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.arm,
         count(DISTINCT o.event_id),
         (SELECT count(*) FROM public.night_seating s WHERE s.arm = o.arm AND s.in_experiment),
         count(*),
         round(avg(o.mutual::int), 3),
         round(avg(o.talked::int), 3),
         round(avg(o.again::int), 3)
  FROM public.night_pair_outcomes o
  JOIN public.night_seating s ON s.event_id = o.event_id AND s.user_id = o.user_a AND s.in_experiment
  WHERE public.is_admin()
  GROUP BY o.arm
  ORDER BY o.arm;
$$;
