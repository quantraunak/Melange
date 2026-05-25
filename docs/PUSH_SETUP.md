# Push notifications setup

Melange sends push via `supabase/functions/send-push` when new messages or matches are inserted.

## 1. Deploy the edge function

```bash
cd /path/to/melange
supabase functions deploy send-push --no-verify-jwt
```

Set secrets in Supabase Dashboard → Edge Functions → send-push:

- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto)

## 2. Database webhooks (Supabase Dashboard)

**Database → Webhooks → Create hook**

### Hook A — new message

- Table: `messages`
- Events: `INSERT`
- HTTP POST: `https://<project-ref>.supabase.co/functions/v1/send-push`
- Header: `Authorization: Bearer <service_role_key>`
- Body (JSON):

```json
{
  "type": "message",
  "record": {
    "id": "{{ record.id }}",
    "match_id": "{{ record.match_id }}",
    "sender_id": "{{ record.sender_id }}",
    "content": "{{ record.content }}"
  }
}
```

### Hook B — new match

- Table: `matches`
- Events: `INSERT`
- Same URL and auth header
- Body:

```json
{
  "type": "match",
  "record": {
    "id": "{{ record.id }}",
    "user1_id": "{{ record.user1_id }}",
    "user2_id": "{{ record.user2_id }}"
  }
}
```

## 3. Test on a physical iPhone

The iOS Simulator does **not** receive push tokens. Use TestFlight or a dev build on device.

1. Sign in on device
2. Accept notification permission
3. From another account, send a message or create a mutual match
4. Recipient should get a push within a few seconds

## 4. Expo / EAS

Ensure `mobile/app.json` has the correct `extra.eas.projectId` after `eas project:init`.
