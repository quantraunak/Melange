-- 32_shared_projects.sql — a project you can send to anyone, and Discover
-- without the App Review login.
--
-- 1. get_shared_project(): what /p/<id> on the website shows, signed out.
--    Crew calls already travel through group chats, Instagram stories and
--    r/USC; a project that can't leave the app can't fill its roles. Same
--    shape as get_shared_story (22_crew_and_credits.sql): only active
--    projects, only what the app already shows any signed-in member, never
--    the embedding. A project id is an unguessable UUID, so this is "anyone
--    with the link", not a public index.
--
-- 2. profiles.hide_from_discover: the App Review login was a person card in
--    every new member's deck. Set by hand for accounts that aren't people.
--
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION public.get_shared_project(p_post UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'description', p.description,
    'roles', to_jsonb(CASE WHEN cardinality(p.roles) > 0 THEN p.roles
                            ELSE coalesce(p.looking_for, '{}'::text[]) END),
    'location', p.location,
    'is_remote', coalesce(p.is_remote, false),
    'project_start', p.project_start,
    'project_end', p.project_end,
    'pay_type', p.pay_type,
    'pay_types', to_jsonb(coalesce(p.pay_types, '{}'::text[])),
    'compensation', p.compensation,
    'media_urls', to_jsonb(coalesce(p.media_urls, '{}'::text[])),
    'owner', jsonb_build_object(
      'name', o.name, 'role', o.role, 'avatar_url', o.avatar_url, 'handle', o.handle)
  )
  FROM public.collab_posts p
  LEFT JOIN public.profiles o ON o.user_id = p.owner_id
  WHERE p.id = p_post AND p.is_active AND p.finished_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_shared_project(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_project(UUID) TO anon, authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_from_discover BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles p SET hide_from_discover = true
FROM auth.users u
WHERE u.id = p.user_id AND u.email = 'review@melange.app';
