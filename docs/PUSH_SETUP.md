# Push notifications

Melange sends push through `supabase/functions/send-push`. Three things trigger
it: a right swipe on someone's project, a new match, and a new chat message.

**You do not need to configure anything in the Supabase Dashboard.** That is the
whole point of how this is wired now, and it is worth reading the history below
before changing it.

## What is where

| Piece | Lives in |
|---|---|
| Who gets notified, and what it says | `supabase/functions/send-push/index.ts` |
| What calls the function | `supabase/schema/12_push_webhooks.sql` |
| The shared secret and the endpoint | Supabase Vault, plus the function's env |
| Device token registration | `mobile/src/lib/push.ts` |

## Deploying a change to the message copy

```bash
cd ~/Projects/melange
npx supabase functions deploy send-push \
  --project-ref <project-ref> --no-verify-jwt
```

`--no-verify-jwt` is required: the callers are database triggers, which carry no
user JWT. The function's own bearer-token check is therefore the only auth
boundary, which is why it compares in constant time and why the token is a
dedicated secret rather than the service-role key.

## Rotating the secret

Two places must match, or every notification silently stops.

1. The function's env var `PUSH_WEBHOOK_SECRET`, set through the Management API
   or the Dashboard's Edge Function secrets.
2. The Vault secret `push_webhook_secret`, which the trigger reads.

The endpoint lives in Vault too, as `push_function_url`. If either Vault secret
is missing the trigger returns without sending, on the reasoning that an
unconfigured push system is off rather than broken.

## Why the triggers are in SQL

This file used to tell a human to open Database → Webhooks and create two hooks
by hand. Nobody did, and nothing anywhere reported a problem, so push notifications
never fired once between the feature being built and 2026-10-13. Six real devices
had registered tokens. `net._http_response` had zero rows. Two people matched and
neither was told.

A setup step that exists only in a console cannot be code-reviewed, cannot be
diffed, does not travel with a clone, and fails silently when skipped. So the
callers are ordinary Postgres triggers in a migration file, and they apply with
every other schema change.

The old instructions also had the webhook send `Authorization: Bearer
<service_role_key>`. Do not reintroduce that. A leaked header would then grant
full database admin rather than only the ability to send a push.

## Deliberate choices

- **Left swipes never notify.** Telling someone they were passed on is the one
  notification nobody wants.
- **A like does not name the liker.** The owner is told that someone liked their
  project. Seeing who is the thing worth charging for later, so naming them in
  the notification would give it away for free.
- **`net.http_post` is queued, not awaited.** A slow or failing push can never
  delay or roll back the swipe that triggered it. A notification is worth
  strictly less than the action it announces.
