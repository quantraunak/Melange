-- ============================================================
-- 25_web_rsvp_and_night_photos.sql — say yes without the app; the night's
-- photos stay with the people who were there
--
-- 1. WEB RSVP. A night's share page (/n/<id>) lets someone without the app
--    say they're going with a name and an email. They show on the guest
--    list by first name. If they later sign up with that email, the RSVP
--    becomes a normal one, so the night chat and Afterglow open for them.
--    This is Partiful's loop: the invite works before the download.
--
-- 2. NIGHT PHOTOS. Photos from a night live in a private bucket and are
--    visible only to its members (host + everyone going). Members can tag
--    each other; a tag pushes "Maya tagged you in a photo from <night>".
--    Small, private, about you and your people — not a public feed.
--
-- Safe to run more than once. Apply AFTER 24_open_doors_and_posting.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Web RSVPs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_web_rsvps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  email      TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 200),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- set once they sign up
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_web_rsvps_once
  ON public.event_web_rsvps (event_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_event_web_rsvps_email ON public.event_web_rsvps (lower(email));
-- RLS on, no policies: the RPC below writes it, hosts read it through RPCs.
ALTER TABLE public.event_web_rsvps ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rsvp_by_link(p_event UUID, p_name TEXT, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev    public.events%ROWTYPE;
  v_email TEXT := lower(btrim(coalesce(p_email, '')));
  v_name  TEXT := btrim(coalesce(p_name, ''));
  v_going INT;
BEGIN
  SELECT * INTO v_ev FROM public.events WHERE id = p_event AND NOT is_canceled;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This night isn''t happening anymore.';
  END IF;
  IF coalesce(v_ev.end_at, v_ev.start_at + interval '6 hours') < now() THEN
    RAISE EXCEPTION 'This night already happened.';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Add your name.';
  END IF;
  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'That email doesn''t look right.';
  END IF;
  -- A ceiling so a script can't fill a guest list.
  IF (SELECT count(*) FROM public.event_web_rsvps WHERE event_id = p_event
      AND created_at > now() - interval '1 hour') >= 60 THEN
    RAISE EXCEPTION 'Lots of people are saying yes right now. Try again in a bit.';
  END IF;

  SELECT (SELECT count(*) FROM public.event_rsvps WHERE event_id = p_event AND state = 'going')
       + (SELECT count(*) FROM public.event_web_rsvps WHERE event_id = p_event AND user_id IS NULL)
  INTO v_going;
  IF v_ev.capacity IS NOT NULL AND v_going >= v_ev.capacity
     AND NOT EXISTS (SELECT 1 FROM public.event_web_rsvps WHERE event_id = p_event AND lower(email) = v_email) THEN
    RAISE EXCEPTION 'This night is full.';
  END IF;

  INSERT INTO public.event_web_rsvps (event_id, name, email)
  VALUES (p_event, v_name, v_email)
  ON CONFLICT (event_id, lower(email)) DO UPDATE SET name = EXCLUDED.name;

  -- Already a member with this email: make it a real RSVP right away.
  INSERT INTO public.event_rsvps (event_id, user_id, state)
  SELECT p_event, u.id, 'going' FROM auth.users u WHERE lower(u.email) = v_email
  ON CONFLICT (event_id, user_id) DO UPDATE SET state = 'going';
  UPDATE public.event_web_rsvps w SET user_id = u.id
  FROM auth.users u
  WHERE w.event_id = p_event AND lower(w.email) = v_email AND lower(u.email) = v_email;

  RETURN jsonb_build_object('ok', true, 'has_account',
    EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email));
END;
$$;

REVOKE ALL ON FUNCTION public.rsvp_by_link(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rsvp_by_link(UUID, TEXT, TEXT) TO anon, authenticated;

-- When someone signs up with an email that said yes on the web, their
-- RSVPs become real ones. Runs after the profile trigger.
CREATE OR REPLACE FUNCTION public.claim_web_rsvps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.event_rsvps (event_id, user_id, state)
  SELECT w.event_id, NEW.id, 'going'
  FROM public.event_web_rsvps w
  WHERE lower(w.email) = lower(NEW.email) AND w.user_id IS NULL
  ON CONFLICT (event_id, user_id) DO NOTHING;
  UPDATE public.event_web_rsvps SET user_id = NEW.id
  WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_claim_web_rsvps ON auth.users;
CREATE TRIGGER trg_claim_web_rsvps
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.claim_web_rsvps();

-- The share page's guest list now includes people who said yes on the web
-- (first name only; no photo, since they have no profile yet).
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
    'location_name', e.location_name,
    'cover_url', e.cover_url,
    'scene', e.scene,
    'capacity', e.capacity,
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
-- 2. Night photos (private to the night's members)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('night-photos', 'night-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Paths are "<event_id>/<uploader_id>/<file>". The first folder decides
-- who can see it; the second who can delete it.
DROP POLICY IF EXISTS "Night members see night photos" ON storage.objects;
CREATE POLICY "Night members see night photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'night-photos'
         AND public.is_event_member(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "Night members add night photos" ON storage.objects;
CREATE POLICY "Night members add night photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'night-photos'
              AND public.is_event_member(((storage.foldername(name))[1])::uuid)
              AND (storage.foldername(name))[2] = auth.uid()::text);

DROP POLICY IF EXISTS "Uploaders remove their night photos" ON storage.objects;
CREATE POLICY "Uploaders remove their night photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'night-photos' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE TABLE IF NOT EXISTS public.event_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path        TEXT NOT NULL UNIQUE,      -- object name in the night-photos bucket
  caption     TEXT CHECK (caption IS NULL OR length(caption) <= 200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (split_part(path, '/', 1) = event_id::text AND split_part(path, '/', 2) = uploader_id::text)
);
CREATE INDEX IF NOT EXISTS idx_event_photos_event ON public.event_photos(event_id, created_at);
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Night members see the roll" ON public.event_photos;
CREATE POLICY "Night members see the roll"
  ON public.event_photos FOR SELECT
  TO authenticated
  USING (public.is_event_member(event_id) AND NOT public.is_blocked_pair(auth.uid(), uploader_id));

DROP POLICY IF EXISTS "Night members add to the roll" ON public.event_photos;
CREATE POLICY "Night members add to the roll"
  ON public.event_photos FOR INSERT
  TO authenticated
  WITH CHECK (uploader_id = auth.uid() AND public.is_event_member(event_id));

DROP POLICY IF EXISTS "Uploaders remove from the roll" ON public.event_photos;
CREATE POLICY "Uploaders remove from the roll"
  ON public.event_photos FOR DELETE
  TO authenticated
  USING (uploader_id = auth.uid());

-- Who's in a photo. Anyone at the night can tag anyone at the night; the
-- person tagged can always remove their own tag.
CREATE TABLE IF NOT EXISTS public.event_photo_tags (
  photo_id   UUID NOT NULL REFERENCES public.event_photos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tagged_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, user_id)
);
ALTER TABLE public.event_photo_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Night members see tags" ON public.event_photo_tags;
CREATE POLICY "Night members see tags"
  ON public.event_photo_tags FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_photos ph
                 WHERE ph.id = photo_id AND public.is_event_member(ph.event_id)));

DROP POLICY IF EXISTS "People remove their own tag" ON public.event_photo_tags;
CREATE POLICY "People remove their own tag"
  ON public.event_photo_tags FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR tagged_by = auth.uid());

CREATE OR REPLACE FUNCTION public.tag_night_photo(p_photo UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event UUID;
BEGIN
  SELECT event_id INTO v_event FROM public.event_photos WHERE id = p_photo;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'That photo is gone.';
  END IF;
  IF NOT public.is_event_member(v_event, auth.uid()) OR NOT public.is_event_member(v_event, p_user) THEN
    RAISE EXCEPTION 'You can only tag people who were at the night.';
  END IF;
  IF public.is_blocked_pair(auth.uid(), p_user) THEN
    RAISE EXCEPTION 'You can''t tag this person.';
  END IF;
  INSERT INTO public.event_photo_tags (photo_id, user_id, tagged_by)
  VALUES (p_photo, p_user, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.tag_night_photo(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tag_night_photo(UUID, UUID) TO authenticated;

-- Tagging someone else pushes them; tagging yourself doesn't.
CREATE OR REPLACE FUNCTION public.notify_night_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret TEXT;
  v_url    TEXT;
  v_event  UUID;
BEGIN
  IF NEW.user_id = NEW.tagged_by THEN
    RETURN NEW;
  END IF;
  SELECT event_id INTO v_event FROM public.event_photos WHERE id = NEW.photo_id;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret';
  SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'push_function_url';
  IF v_secret IS NULL OR v_url IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body    := jsonb_build_object('type', 'night_tag', 'record', jsonb_build_object(
                 'event_id', v_event, 'photo_id', NEW.photo_id,
                 'user_id', NEW.user_id, 'tagged_by', NEW.tagged_by)),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_night_tag() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_night_tag ON public.event_photo_tags;
CREATE TRIGGER trg_notify_night_tag
  AFTER INSERT ON public.event_photo_tags
  FOR EACH ROW EXECUTE FUNCTION public.notify_night_tag();

-- The roll for one night: photos with who's in them, newest first, and
-- "you're in it" for the viewer. Paths only; the client signs URLs.
CREATE OR REPLACE FUNCTION public.night_roll(p_event UUID)
RETURNS TABLE (id UUID, path TEXT, caption TEXT, uploader_id UUID, uploader_name TEXT,
               created_at TIMESTAMPTZ, tagged JSONB, includes_me BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ph.id, ph.path, ph.caption, ph.uploader_id, up.name, ph.created_at,
    coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', t.user_id, 'name', p.name))
              FROM public.event_photo_tags t JOIN public.profiles p ON p.user_id = t.user_id
              WHERE t.photo_id = ph.id), '[]'::jsonb),
    EXISTS (SELECT 1 FROM public.event_photo_tags t WHERE t.photo_id = ph.id AND t.user_id = auth.uid())
  FROM public.event_photos ph
  LEFT JOIN public.profiles up ON up.user_id = ph.uploader_id
  WHERE ph.event_id = p_event
    AND public.is_event_member(p_event)
    AND NOT public.is_blocked_pair(auth.uid(), ph.uploader_id)
  ORDER BY ph.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.night_roll(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.night_roll(UUID) TO authenticated;
