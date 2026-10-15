-- ============================================================
-- 17_audit_fixes.sql — the database half of the audit findings
--
-- A seven-agent audit checked every feature area against production and a
-- second pass tried to refute each finding. These are the ones that live in
-- the database rather than in a screen.
--
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The message length limit was a suggestion
--
-- start_conversation refuses a body over 2000 characters, so the cap is
-- clearly intended. But only the FIRST message goes through that function;
-- every later one is a plain insert from the client, and the table had no
-- constraint. The limit therefore held exactly once per conversation and the
-- TextInput was the only thing enforcing it afterwards.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_content_len') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_content_len
      CHECK (char_length(content) BETWEEN 1 AND 2000);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. messages.body was undeclared drift
--
-- The table carried both `content`, which everything uses, and `body`, which
-- appears in no schema file, is written and read by nothing, and is NULL in
-- every row that has ever existed. Two columns with the same meaning next to
-- each other is how the next person writes to the wrong one.
-- ------------------------------------------------------------
ALTER TABLE public.messages DROP COLUMN IF EXISTS body;

-- ------------------------------------------------------------
-- 3. The daily cold-message limit reset when you deleted the evidence
--
-- The limit counted rows in `matches` where started_by = you within 24 hours.
-- Unmatching DELETEs the matches row, so sending five, deleting them, and
-- sending five more was unlimited. The counter has to survive the thing it
-- counts, so reach-outs are recorded separately and never deleted.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reach_outs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reach_outs_sender_time
  ON public.reach_outs(sender_id, created_at DESC);

ALTER TABLE public.reach_outs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reach_outs_select_own" ON public.reach_outs;
CREATE POLICY "reach_outs_select_own"
  ON public.reach_outs FOR SELECT TO authenticated
  USING (sender_id = auth.uid());
-- No INSERT policy on purpose: only start_conversation writes here, as definer.

-- ------------------------------------------------------------
-- 4. can_message(): so the Message button is not a trap
--
-- The button rendered on every profile but your own. A blocked person's
-- profile is still readable, so it rendered for them too: you could open the
-- composer, write a message, press Send, and only then be told you cannot
-- message this person. Same for a profile below the quality floor.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_message(p_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_other IS NOT NULL
     AND p_other <> auth.uid()
     AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_other)
     AND NOT public.is_blocked_pair(auth.uid(), p_other)
     AND COALESCE(public.profile_meets_floor(auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.can_message(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_message(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 5. Reports went into a queue nothing could empty
--
-- submitReport works and real reports exist, three of them pending for up to
-- 49 days. The other half was never built: public.reports had only SELECT-own
-- and INSERT policies, so no signed-in user could move a report off 'pending',
-- and the moderation page renders the list and stops.
--
-- This is deliberately service-role only. Moderation is not a user capability,
-- and handing an UPDATE policy to `authenticated` would let anyone close
-- reports about themselves.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_report(p_id UUID, p_status TEXT)
RETURNS public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.reports;
BEGIN
  IF current_setting('role', true) NOT IN ('service_role', 'postgres')
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'resolve_report is service-role only';
  END IF;
  IF p_status NOT IN ('reviewed', 'dismissed', 'actioned', 'pending') THEN
    RAISE EXCEPTION 'unknown status %', p_status;
  END IF;
  UPDATE public.reports SET status = p_status WHERE id = p_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'no such report %', p_id;
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_report(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_report(UUID, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 6. Two definitions of "past collab" that disagreed
--
-- The `credits` view, read for your own Work section, picked the project by
-- POSITION: post1_id when you were user1, else post2_id. create_match fills
-- those slots crosswise, and start_conversation fills them aligned, so the
-- view read the wrong one, and its INNER JOIN dropped reach-out collabs
-- entirely because those have no project at all. public_credits, read for
-- someone else's profile, resolves by owner. The same collaboration therefore
-- appeared on one screen and not the other.
--
-- One definition now: resolve by owner, LEFT JOIN so a collab with no project
-- still counts with a NULL title, and require the review to be mutual, which
-- is what "a confirmed past collab" has always meant everywhere else.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.credits
WITH (security_invoker = true)
AS
  SELECT
    r.id          AS review_id,
    r.match_id,
    r.reviewee_id AS user_id,
    r.reviewer_id AS credited_by,
    p.id          AS post_id,
    p.title,
    p.project_start,
    p.project_end,
    r.rating,
    r.created_at
  FROM public.collab_reviews r
  JOIN public.matches m ON m.id = r.match_id
  LEFT JOIN LATERAL (
    SELECT cp.id, cp.title, cp.project_start, cp.project_end
    FROM public.collab_posts cp
    WHERE cp.id IN (m.post1_id, m.post2_id)
    ORDER BY (cp.owner_id = r.reviewer_id) DESC
    LIMIT 1
  ) p ON true
  WHERE EXISTS (
    SELECT 1 FROM public.collab_reviews back
    WHERE back.match_id    = r.match_id
      AND back.reviewer_id = r.reviewee_id
      AND back.reviewee_id = r.reviewer_id
  );

-- ------------------------------------------------------------
-- 7. "It's a match!" fired again for a pair that already matched
--
-- A conversation is per PAIR, not per project: UNIQUE(user1_id, user2_id).
-- That is the right model — nobody wants three threads with one person — but
-- create_match returned the existing row unconditionally, so right-swiping a
-- second project by someone you already match with replayed the full match
-- celebration and then opened a thread labelled with the FIRST project.
--
-- It now returns a row only when it actually created one. The like is still
-- recorded; there is simply nothing new to celebrate, and the conversation is
-- already in Messages where it has been all along.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_match(p_post_id UUID)
RETURNS SETOF public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me         UUID := auth.uid();
  v_owner      UUID;
  v_their_post UUID;
  v_user1      UUID;
  v_user2      UUID;
  v_post1      UUID;
  v_post2      UUID;
  v_new        public.matches;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT owner_id INTO v_owner FROM public.collab_posts WHERE id = p_post_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'post not found';
  END IF;
  IF v_owner = v_me THEN
    RETURN;
  END IF;

  IF public.is_blocked_pair(v_me, v_owner) THEN
    RETURN;
  END IF;

  -- (a) the caller actually swiped right on this post
  IF NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = v_me AND post_id = p_post_id AND direction = 'right'
  ) THEN
    RETURN;
  END IF;

  -- (b) the owner swiped right on one of the caller's posts
  SELECT s.post_id INTO v_their_post
  FROM public.swipes s
  JOIN public.collab_posts p ON p.id = s.post_id
  WHERE s.swiper_id = v_owner
    AND s.direction = 'right'
    AND p.owner_id = v_me
  ORDER BY s.created_at
  LIMIT 1;
  IF v_their_post IS NULL THEN
    RETURN;
  END IF;

  IF v_me < v_owner THEN
    v_user1 := v_me;      v_user2 := v_owner;
    v_post1 := p_post_id; v_post2 := v_their_post;
  ELSE
    v_user1 := v_owner;      v_user2 := v_me;
    v_post1 := v_their_post; v_post2 := p_post_id;
  END IF;

  INSERT INTO public.matches (user1_id, user2_id, post1_id, post2_id)
  VALUES (v_user1, v_user2, v_post1, v_post2)
  ON CONFLICT (user1_id, user2_id) DO NOTHING
  RETURNING * INTO v_new;

  -- Nothing inserted means this pair already had a conversation. No new match.
  IF v_new.id IS NULL THEN
    RETURN;
  END IF;

  RETURN NEXT v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.create_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_match(UUID) TO authenticated;
