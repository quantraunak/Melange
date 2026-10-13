-- ============================================================
-- 12_push_webhooks.sql — make push notifications actually fire
--
-- Push has never worked, for anything, since the feature was built.
--
-- The `send-push` Edge Function was deployed and its PUSH_WEBHOOK_SECRET was
-- set. Six real devices had registered push tokens. But nothing ever called
-- the function: the header of send-push/index.ts told a human to go create
-- Database Webhooks in the Supabase Dashboard, and that was the only record
-- that the step existed. It was never done, and because a missing webhook
-- produces no error anywhere, nothing surfaced it. Matches, messages and
-- likes all silently notified nobody.
--
-- The fix is to stop treating the caller as console configuration. These are
-- ordinary triggers, so they live in this file, apply with every other
-- migration, and are visible in `git log` like the rest of the schema.
--
-- The secret is read from Vault rather than written into the trigger body, so
-- it is not recoverable from `pg_get_functiondef` or from this file.
--
-- Safe to run more than once.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 1. The dispatcher.
--
-- One function for all three events. It posts the same envelope shape the
-- Edge Function already expects, `{ type, record }`, so send-push did not
-- need a new contract.
--
-- net.http_post queues the request and returns immediately, so a slow or
-- failed push can never delay or roll back the INSERT that triggered it.
-- A notification is worth strictly less than the swipe it announces.
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
BEGIN
  -- Right swipes only. A left swipe is private by construction: telling
  -- someone they were passed on is the one notification nobody wants.
  IF TG_ARGV[0] = 'like' AND NEW.direction <> 'right' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret';

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_function_url';

  -- No secret configured means push is intentionally off, not broken.
  IF v_secret IS NULL OR v_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object('type', TG_ARGV[0], 'record', to_jsonb(NEW)),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_push() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 2. The three callers.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_push_on_like ON public.swipes;
CREATE TRIGGER trg_push_on_like
  AFTER INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.notify_push('like');

DROP TRIGGER IF EXISTS trg_push_on_match ON public.matches;
CREATE TRIGGER trg_push_on_match
  AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_push('match');

DROP TRIGGER IF EXISTS trg_push_on_message ON public.messages;
CREATE TRIGGER trg_push_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_push('message');
