-- ============================================================
-- 24_open_doors_and_posting.sql — open app, invite-only nights, and a
-- reason to post
--
-- 1. OPEN SIGNUP. The app is no longer gated: a hard gate leaves people
--    whose friends can't get in looking at an empty app. Everyone who signs
--    up is a member. Founding codes still exist, and now grant the ✦ to
--    someone who's already a member instead of being their way in.
-- 2. WEEKLY THEMES. One prompt for the whole app each week ("golden
--    hour"). A frame removes "what do I even post?".
-- 3. TAGS NOTIFY. Being credited on a post (collab_stories.credits with
--    your user_id) pushes "Maya tagged you in …", once per person per post.
-- 4. PUBLIC NIGHT PAGES. A night's share link shows signed-out visitors
--    the theme, time, place, host, and who's going (first name + photo
--    only) — the guest list is what makes people say yes.
--
-- Safe to run more than once. Apply AFTER 23_scenes_invites_nights.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Open signup
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, role, member_since)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'role'), ''), 'other'),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Anyone who signed up while the gate was on is in.
UPDATE public.profiles SET member_since = now() WHERE member_since IS NULL;

-- A founding code now works for members: it grants the ✦ (once), records
-- who invited you if nobody had, and counts as a use.
CREATE OR REPLACE FUNCTION public.redeem_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   UUID := auth.uid();
  v_code public.invite_codes%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT * INTO v_code FROM public.invite_codes
  WHERE code = upper(btrim(coalesce(p_code, '')))
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That code doesn''t work. Check it with whoever sent it.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.invite_redemptions WHERE user_id = v_me) THEN
    RAISE EXCEPTION 'You''ve already used a code.';
  END IF;
  IF v_code.uses >= v_code.max_uses THEN
    RAISE EXCEPTION 'That code has already been used.';
  END IF;
  IF v_code.owner_id = v_me THEN
    RAISE EXCEPTION 'That''s your own code. Send it to a friend.';
  END IF;

  UPDATE public.invite_codes SET uses = uses + 1 WHERE code = v_code.code;
  INSERT INTO public.invite_redemptions (code, user_id) VALUES (v_code.code, v_me);
  UPDATE public.profiles
  SET member_since = coalesce(member_since, now()),
      invited_by   = coalesce(invited_by, v_code.owner_id),
      scene        = coalesce(scene, v_code.scene),
      founding     = founding OR v_code.founding
  WHERE user_id = v_me;

  RETURN jsonb_build_object('ok', true, 'scene', v_code.scene, 'founding', v_code.founding);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 2. Weekly themes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_themes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_on  DATE NOT NULL UNIQUE,         -- the Monday it starts
  title      TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 60),
  prompt     TEXT CHECK (prompt IS NULL OR length(prompt) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Themes are readable" ON public.weekly_themes;
CREATE POLICY "Themes are readable"
  ON public.weekly_themes FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE public.collab_stories
  ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES public.weekly_themes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_collab_stories_theme ON public.collab_stories(theme_id) WHERE theme_id IS NOT NULL;

-- This week's theme: the latest one that has started.
CREATE OR REPLACE FUNCTION public.current_theme()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('id', t.id, 'title', t.title, 'prompt', t.prompt, 'starts_on', t.starts_on,
    'posts', (SELECT count(*) FROM public.collab_stories s WHERE s.theme_id = t.id AND s.is_public))
  FROM public.weekly_themes t
  WHERE t.starts_on <= current_date
  ORDER BY t.starts_on DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_theme() TO anon, authenticated;

-- Editors set themes.
CREATE OR REPLACE FUNCTION public.set_weekly_theme(p_starts_on DATE, p_title TEXT, p_prompt TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only editors set the theme.';
  END IF;
  INSERT INTO public.weekly_themes (starts_on, title, prompt)
  VALUES (p_starts_on, btrim(p_title), nullif(btrim(coalesce(p_prompt, '')), ''))
  ON CONFLICT (starts_on) DO UPDATE SET title = EXCLUDED.title, prompt = EXCLUDED.prompt
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_weekly_theme(DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_weekly_theme(DATE, TEXT, TEXT) TO authenticated;

-- The first two weeks, so Explore never opens on an empty theme.
INSERT INTO public.weekly_themes (starts_on, title, prompt) VALUES
  (date_trunc('week', current_date)::date, 'Golden hour', 'The last light of the day. Post one photo you love.'),
  ((date_trunc('week', current_date) + interval '7 days')::date, 'Red', 'Anything red: a fit, a wall, a mood.')
ON CONFLICT (starts_on) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Being tagged notifies you
-- ------------------------------------------------------------
-- One row per (post, person) we've told, so an edit that keeps the tag
-- doesn't buzz them again.
CREATE TABLE IF NOT EXISTS public.tag_notifications (
  story_id UUID NOT NULL REFERENCES public.collab_stories(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
ALTER TABLE public.tag_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.notify_tags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret TEXT;
  v_url    TEXT;
  v_uid    UUID;
BEGIN
  IF NOT NEW.is_public THEN
    RETURN NEW;
  END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret';
  SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'push_function_url';

  FOR v_uid IN
    SELECT DISTINCT (c ->> 'user_id')::uuid
    FROM jsonb_array_elements(NEW.credits) c
    WHERE nullif(c ->> 'user_id', '') IS NOT NULL
      AND (c ->> 'user_id')::uuid <> NEW.author_id
  LOOP
    CONTINUE WHEN public.is_blocked_pair(NEW.author_id, v_uid);
    INSERT INTO public.tag_notifications (story_id, user_id) VALUES (NEW.id, v_uid)
    ON CONFLICT DO NOTHING;
    CONTINUE WHEN NOT FOUND;
    IF v_secret IS NOT NULL AND v_url IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
        body    := jsonb_build_object('type', 'tagged', 'record', jsonb_build_object(
                     'story_id', NEW.id, 'user_id', v_uid, 'author_id', NEW.author_id, 'title', NEW.title)),
        timeout_milliseconds := 5000
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_tags() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_tags ON public.collab_stories;
CREATE TRIGGER trg_notify_tags
  AFTER INSERT OR UPDATE OF credits, is_public ON public.collab_stories
  FOR EACH ROW EXECUTE FUNCTION public.notify_tags();

-- Searching members to tag: name or handle, members only, not blocked.
CREATE OR REPLACE FUNCTION public.search_people(p_query TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (user_id UUID, name TEXT, handle TEXT, avatar_url TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.handle, p.avatar_url, p.role
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND length(btrim(coalesce(p_query, ''))) >= 1
    AND p.user_id <> auth.uid()
    AND p.member_since IS NOT NULL
    AND NOT public.is_blocked_pair(auth.uid(), p.user_id)
    AND (p.name ILIKE '%' || btrim(p_query) || '%' OR p.handle ILIKE ltrim(btrim(p_query), '@') || '%')
  ORDER BY (p.handle ILIKE ltrim(btrim(p_query), '@') || '%') DESC, p.name
  LIMIT least(greatest(p_limit, 1), 25);
$$;

REVOKE ALL ON FUNCTION public.search_people(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_people(TEXT, INT) TO authenticated;

-- ------------------------------------------------------------
-- 4. Public night pages
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_shared_event(p_event UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'going_count', (SELECT count(*) FROM public.event_rsvps r WHERE r.event_id = e.id AND r.state = 'going'),
    'going', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', split_part(p.name, ' ', 1), 'avatar_url', p.avatar_url)
                       ORDER BY r.created_at)
      FROM (SELECT * FROM public.event_rsvps WHERE event_id = e.id AND state = 'going'
            ORDER BY created_at LIMIT 12) r
      JOIN public.profiles p ON p.user_id = r.user_id
    ), '[]'::jsonb)
  )
  FROM public.events e
  LEFT JOIN public.profiles h ON h.user_id = e.host_id
  WHERE e.id = p_event AND NOT e.is_canceled;
$$;

REVOKE ALL ON FUNCTION public.get_shared_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_event(UUID) TO anon, authenticated;
