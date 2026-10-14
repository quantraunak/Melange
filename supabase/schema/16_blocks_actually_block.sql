-- ============================================================
-- 16_blocks_actually_block.sql — make Block do what the dialog promises
--
-- Blocking someone wrote a row into public.blocks and changed nothing else.
--
-- Nothing in the messaging path consulted that table. The messages SELECT and
-- INSERT policies checked participation only. The matches SELECT policy
-- checked participation only. notify_push, the trigger that sends the push,
-- never mentioned blocks. start_conversation() was the single place a block
-- was honoured, and only to refuse a NEW thread.
--
-- So blocking someone you were already talking to did nothing at all: the
-- thread stayed in both lists, both people kept full read access to the whole
-- history, either could keep sending, and every message the blocked person
-- sent still arrived as a push notification. The chat screen's own flow blocks
-- the person and returns you to a Messages list that still contains them.
--
-- On an app for meeting strangers, that is the one control that has to work.
--
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. One definition of "these two are blocked", either direction
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_blocked_pair(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

REVOKE ALL ON FUNCTION public.is_blocked_pair(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked_pair(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 2. A blocked pair cannot write to their thread
--
-- Reading the history is deliberately left alone. Removing it would make
-- messages vanish from the blocker's own records too, and the thread is
-- hidden in the client. What must stop is NEW contact.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can send messages in their matches" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
        AND NOT public.is_blocked_pair(m.user1_id, m.user2_id)
    )
  );

-- ------------------------------------------------------------
-- 3. And a blocked pair sends no notifications
--
-- Even with the write blocked, a message already in flight, or one sent by a
-- path added later, must not reach someone who blocked its sender.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret TEXT;
  v_url    TEXT;
  v_rec    JSONB := to_jsonb(NEW);
  v_u1     UUID;
  v_u2     UUID;
BEGIN
  -- NEW is read as jsonb so one trigger function can serve three table shapes
  -- without naming a column only one of them has. See 12_push_webhooks.sql.
  IF TG_ARGV[0] = 'like' THEN
    IF COALESCE(v_rec ->> 'direction', '') <> 'right' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Never notify across a block, whatever produced the row.
  IF TG_ARGV[0] = 'message' THEN
    SELECT m.user1_id, m.user2_id INTO v_u1, v_u2
    FROM public.matches m WHERE m.id = (v_rec ->> 'match_id')::uuid;
    IF v_u1 IS NOT NULL AND public.is_blocked_pair(v_u1, v_u2) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_ARGV[0] = 'match' THEN
    IF public.is_blocked_pair((v_rec ->> 'user1_id')::uuid, (v_rec ->> 'user2_id')::uuid) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret';
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_function_url';
  IF v_secret IS NULL OR v_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object('type', TG_ARGV[0], 'record', v_rec),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_push() FROM PUBLIC, anon, authenticated;
