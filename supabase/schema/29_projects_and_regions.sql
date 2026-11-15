-- ============================================================
-- 29_projects_and_regions.sql — who's on a project, finishing it,
-- regions, automatic handles, paid events, hearts on messages
--
-- 1. PEOPLE ON A PROJECT. After talking in a chat, the project's owner adds
--    the other person to one of their projects (project_members). Nobody is
--    asked to accept; it just says who made it. The owner can hide the post
--    from Discover once they have everyone (is_active = false, as before), and
--    mark the project finished (collab_posts.finished_at). Finished projects
--    show on everyone's profile who was on them, and each person on it is
--    asked to review the other in their chat (the existing collab_reviews,
--    tied to that chat).
--
-- 2. MORE THAN ONE PAY TYPE. collab_posts.pay_types: any of paid, tfp,
--    credit. pay_type (one value) stays for older app versions; the app
--    writes both, the first of pay_types into pay_type.
--
-- 3. REGIONS. Scenes were USC, UCSD, LA and NYC. Melange is California and
--    remote for now: sd (San Diego), la (Los Angeles), sf (San Francisco),
--    other_ca (elsewhere in California), remote. Existing rows move with
--    them: usc -> la, ucsd -> sd, nyc -> none.
--
-- 4. EVERYONE HAS A HANDLE, so every profile has a link to share. Anyone
--    without one gets their name plus a few digits (jolea482). They can
--    change it in Edit profile like before.
--
-- 5. PAID EVENTS. events.is_paid, price and how_to_pay (free text: "Venmo
--    @name at the door"). The app hides "I'm going" on a paid event.
--    events.time_set is false when the host gave a day and no time.
--
-- 6. HEARTS ON MESSAGES. message_hearts: either person in a chat can heart a
--    message once. Readable by the two people in the chat only.
--
-- Safe to run more than once. Apply after 28.
-- ============================================================

-- ------------------------------------------------------------
-- 1. People on a project
-- ------------------------------------------------------------
ALTER TABLE public.collab_posts ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.project_members (
  post_id    UUID NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The chat they talked in, so the review afterwards attaches to it.
  match_id   UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Who made what is public, like the project itself. Writes go through the
-- functions below.
DROP POLICY IF EXISTS "Project members are readable" ON public.project_members;
CREATE POLICY "Project members are readable"
  ON public.project_members FOR SELECT TO authenticated
  USING (NOT public.is_blocked_pair(auth.uid(), user_id));

-- Add the person you're chatting with to one of your projects.
CREATE OR REPLACE FUNCTION public.add_project_member(p_post UUID, p_match UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me    UUID := auth.uid();
  v_other UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.collab_posts WHERE id = p_post AND owner_id = v_me) THEN
    RAISE EXCEPTION 'That isn''t your project.';
  END IF;
  SELECT CASE WHEN user1_id = v_me THEN user2_id ELSE user1_id END INTO v_other
  FROM public.matches
  WHERE id = p_match AND v_me IN (user1_id, user2_id);
  IF v_other IS NULL THEN
    RAISE EXCEPTION 'You can only add someone you''ve been talking to.';
  END IF;
  IF public.is_blocked_pair(v_me, v_other) THEN
    RAISE EXCEPTION 'You can''t add this person.';
  END IF;
  INSERT INTO public.project_members (post_id, user_id, match_id)
  VALUES (p_post, v_other, p_match)
  ON CONFLICT (post_id, user_id) DO UPDATE SET match_id = EXCLUDED.match_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_project_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_project_member(UUID, UUID) TO authenticated;

-- The owner takes someone off, or someone takes themselves off.
CREATE OR REPLACE FUNCTION public.remove_project_member(p_post UUID, p_user UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.project_members m
  WHERE m.post_id = p_post AND m.user_id = p_user
    AND (m.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = p_post AND p.owner_id = auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.remove_project_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_project_member(UUID, UUID) TO authenticated;

-- Finish a project: it leaves Discover and shows as done on profiles.
-- p_done = false undoes it (the post stays hidden until they reopen it).
CREATE OR REPLACE FUNCTION public.set_project_finished(p_post UUID, p_done BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.collab_posts SET
    finished_at = CASE WHEN p_done THEN COALESCE(finished_at, now()) ELSE NULL END,
    is_active   = CASE WHEN p_done THEN false ELSE is_active END
  WHERE id = p_post AND owner_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That isn''t your project.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_project_finished(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_finished(UUID, BOOLEAN) TO authenticated;

-- Reviews the caller owes: finished projects they were on, in a chat, where
-- they haven't reviewed the other person yet. The owner owes one to each
-- member; each member owes one to the owner.
CREATE OR REPLACE FUNCTION public.my_pending_reviews()
RETURNS TABLE (match_id UUID, post_id UUID, title TEXT, other_user_id UUID, other_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pairs AS (
    SELECT m.match_id, p.id AS post_id, p.title,
           CASE WHEN p.owner_id = auth.uid() THEN m.user_id ELSE p.owner_id END AS other
    FROM public.project_members m
    JOIN public.collab_posts p ON p.id = m.post_id
    WHERE p.finished_at IS NOT NULL
      AND m.match_id IS NOT NULL
      AND auth.uid() IN (p.owner_id, m.user_id)
  )
  SELECT x.match_id, x.post_id, x.title, x.other, pr.name
  FROM pairs x
  LEFT JOIN public.profiles pr ON pr.user_id = x.other
  WHERE NOT EXISTS (
    SELECT 1 FROM public.collab_reviews r
    WHERE r.match_id = x.match_id AND r.reviewer_id = auth.uid()
  )
  AND NOT public.is_blocked_pair(auth.uid(), x.other);
$$;
REVOKE ALL ON FUNCTION public.my_pending_reviews() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_pending_reviews() TO authenticated;

-- ------------------------------------------------------------
-- 2. More than one pay type
-- ------------------------------------------------------------
ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS pay_types TEXT[] NOT NULL DEFAULT '{}'::text[];
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collab_posts_pay_types_check') THEN
    ALTER TABLE public.collab_posts ADD CONSTRAINT collab_posts_pay_types_check
      CHECK (pay_types <@ ARRAY['paid', 'tfp', 'credit']::text[]);
  END IF;
END $$;
UPDATE public.collab_posts SET pay_types = ARRAY[pay_type]
WHERE pay_type IS NOT NULL AND pay_types = '{}'::text[];

-- ------------------------------------------------------------
-- 3. Regions
-- ------------------------------------------------------------
ALTER TABLE public.profiles     DROP CONSTRAINT IF EXISTS profiles_scene_check;
ALTER TABLE public.events       DROP CONSTRAINT IF EXISTS events_scene_check;
ALTER TABLE public.invite_codes DROP CONSTRAINT IF EXISTS invite_codes_scene_check;
ALTER TABLE public.waitlist     DROP CONSTRAINT IF EXISTS waitlist_scene_check;

UPDATE public.profiles     SET scene = CASE scene WHEN 'usc' THEN 'la' WHEN 'ucsd' THEN 'sd' WHEN 'nyc' THEN NULL ELSE scene END
WHERE scene IN ('usc', 'ucsd', 'nyc');
UPDATE public.events       SET scene = CASE scene WHEN 'usc' THEN 'la' WHEN 'ucsd' THEN 'sd' WHEN 'nyc' THEN NULL ELSE scene END
WHERE scene IN ('usc', 'ucsd', 'nyc');
UPDATE public.invite_codes SET scene = CASE scene WHEN 'usc' THEN 'la' WHEN 'ucsd' THEN 'sd' WHEN 'nyc' THEN NULL ELSE scene END
WHERE scene IN ('usc', 'ucsd', 'nyc');
UPDATE public.waitlist     SET scene = CASE scene WHEN 'usc' THEN 'la' WHEN 'ucsd' THEN 'sd' WHEN 'nyc' THEN 'other_ca' WHEN 'other' THEN 'other_ca' ELSE scene END
WHERE scene IN ('usc', 'ucsd', 'nyc', 'other');

ALTER TABLE public.profiles ADD CONSTRAINT profiles_scene_check
  CHECK (scene IS NULL OR scene IN ('sd', 'la', 'sf', 'other_ca', 'remote'));
ALTER TABLE public.events ADD CONSTRAINT events_scene_check
  CHECK (scene IS NULL OR scene IN ('sd', 'la', 'sf', 'other_ca', 'remote'));
ALTER TABLE public.invite_codes ADD CONSTRAINT invite_codes_scene_check
  CHECK (scene IS NULL OR scene IN ('sd', 'la', 'sf', 'other_ca', 'remote'));
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_scene_check
  CHECK (scene IS NULL OR scene IN ('sd', 'la', 'sf', 'other_ca', 'remote'));

CREATE OR REPLACE FUNCTION public.set_scene(p_scene TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scene IS NOT NULL AND p_scene NOT IN ('sd', 'la', 'sf', 'other_ca', 'remote') THEN
    RAISE EXCEPTION 'Unknown region.';
  END IF;
  UPDATE public.profiles SET scene = p_scene WHERE user_id = auth.uid();
  RETURN p_scene;
END;
$$;

-- A project's region, and whether it can be done remotely.
ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS region    TEXT,
  ADD COLUMN IF NOT EXISTS is_remote BOOLEAN NOT NULL DEFAULT false;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collab_posts_region_check') THEN
    ALTER TABLE public.collab_posts ADD CONSTRAINT collab_posts_region_check
      CHECK (region IS NULL OR region IN ('sd', 'la', 'sf', 'other_ca', 'remote'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Everyone has a handle
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.make_handle(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base TEXT := left(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]', '', 'g'), 20);
  v_try  TEXT;
BEGIN
  IF length(v_base) < 2 THEN v_base := 'melange'; END IF;
  FOR i IN 1..50 LOOP
    v_try := v_base || (100 + floor(random() * 900))::int::text;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE handle = v_try) THEN
      RETURN v_try;
    END IF;
  END LOOP;
  RETURN v_base || substr(md5(random()::text), 1, 6);
END;
$$;
REVOKE ALL ON FUNCTION public.make_handle(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_handle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.handle IS NULL OR btrim(NEW.handle) = '' THEN
    NEW.handle := public.make_handle(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_handle ON public.profiles;
CREATE TRIGGER trg_ensure_handle
  BEFORE INSERT OR UPDATE OF handle, name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_handle();

-- Everyone already here without one.
UPDATE public.profiles SET handle = public.make_handle(name) WHERE handle IS NULL;

-- ------------------------------------------------------------
-- 5. Paid events
-- ------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_paid    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price      TEXT CHECK (price IS NULL OR length(price) <= 60),
  ADD COLUMN IF NOT EXISTS how_to_pay TEXT CHECK (how_to_pay IS NULL OR length(how_to_pay) <= 300),
  -- false when the host gave a date with no time, so the app shows the day
  -- alone instead of a made-up 12:00 PM.
  ADD COLUMN IF NOT EXISTS time_set   BOOLEAN NOT NULL DEFAULT true;

-- No RSVPs on a paid event: the app hides the button, and this makes sure.
CREATE OR REPLACE FUNCTION public.no_rsvp_on_paid_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.events WHERE id = NEW.event_id AND is_paid) THEN
    -- Sign-up turning an old web "yes" into an RSVP (claim_web_rsvps) has no
    -- signed-in user. Skip that row quietly: raising would fail the sign-up.
    IF TG_TABLE_NAME = 'event_rsvps' AND auth.uid() IS NULL THEN
      RETURN NULL;
    END IF;
    RAISE EXCEPTION 'This is a paid event. See how to pay on the event.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_rsvp_on_paid_event ON public.event_rsvps;
CREATE TRIGGER trg_no_rsvp_on_paid_event
  BEFORE INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.no_rsvp_on_paid_event();

-- The same for "I'm going" on the web share page (rsvp_by_link).
DROP TRIGGER IF EXISTS trg_no_web_rsvp_on_paid_event ON public.event_web_rsvps;
CREATE TRIGGER trg_no_web_rsvp_on_paid_event
  BEFORE INSERT ON public.event_web_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.no_rsvp_on_paid_event();

-- The web share page (/n/<id>) needs the price, how to pay and whether a
-- time was set. Same as 25_web_rsvp_and_night_photos.sql plus those.
CREATE OR REPLACE FUNCTION public.get_shared_event(p_event UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH going AS (
    SELECT split_part(p.name, ' ', 1) AS name, p.avatar_url, r.created_at
    FROM public.event_rsvps r JOIN public.profiles p ON p.user_id = r.user_id
    WHERE r.event_id = p_event AND r.state = 'going'
    UNION ALL
    SELECT split_part(w.name, ' ', 1), NULL, w.created_at
    FROM public.event_web_rsvps w
    WHERE w.event_id = p_event AND w.user_id IS NULL
  )
  SELECT jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'description', e.description,
    'start_at', e.start_at,
    'end_at', e.end_at,
    'time_set', e.time_set,
    'location_name', e.location_name,
    'cover_url', e.cover_url,
    'scene', e.scene,
    'capacity', e.capacity,
    'is_paid', e.is_paid,
    'price', e.price,
    'how_to_pay', e.how_to_pay,
    'host', jsonb_build_object('name', split_part(h.name, ' ', 1), 'avatar_url', h.avatar_url),
    'going_count', (SELECT count(*) FROM going),
    'going', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', g.name, 'avatar_url', g.avatar_url) ORDER BY g.created_at)
      FROM (SELECT * FROM going ORDER BY created_at LIMIT 12) g
    ), '[]'::jsonb)
  )
  FROM public.events e
  LEFT JOIN public.profiles h ON h.user_id = e.host_id
  WHERE e.id = p_event AND NOT e.is_canceled;
$$;

REVOKE ALL ON FUNCTION public.get_shared_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_event(UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- 6. Hearts on messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_hearts (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id   UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_hearts_match ON public.message_hearts(match_id);
ALTER TABLE public.message_hearts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat members see hearts" ON public.message_hearts;
CREATE POLICY "Chat members see hearts"
  ON public.message_hearts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m
                 WHERE m.id = match_id AND auth.uid() IN (m.user1_id, m.user2_id)));

DROP POLICY IF EXISTS "Chat members heart messages" ON public.message_hearts;
CREATE POLICY "Chat members heart messages"
  ON public.message_hearts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.messages msg
                JOIN public.matches m ON m.id = msg.match_id
                WHERE msg.id = message_id AND msg.match_id = message_hearts.match_id
                  AND auth.uid() IN (m.user1_id, m.user2_id))
  );

DROP POLICY IF EXISTS "Remove your own heart" ON public.message_hearts;
CREATE POLICY "Remove your own heart"
  ON public.message_hearts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                       AND tablename = 'message_hearts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_hearts;
  END IF;
END $$;
