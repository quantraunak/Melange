# Onboarding someone to Melange

## What to give them

| Credential | Give it out? | Why |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Public. Visible in the website's JavaScript and the iPhone binary. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Public by design. Every user who installed the app already has it. Row-level security is what protects the data, not this key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** | Bypasses every RLS policy. Holder can read every user's messages, photos and email, and `scripts/wipe_users.mjs` deletes accounts with it. Not revocable per person. |
| `SUPABASE_ACCESS_TOKEN` | **Never** | Management API. Can change auth config or delete the project. |
| `ADMIN_REPORTS_KEY` | **Never** | Moderation queue. |

If someone needs to see production data, invite them to the Supabase
organization instead of sending a key. Dashboard access is per-person and
revocable; a leaked key is not.

## Setting someone up to run the app

```bash
git clone https://github.com/quantraunak/Melange.git
cd Melange
npm install
# create .env.local with the two public values above, then:
npm run dev            # web, on localhost:3000
cd mobile && npm install && npx expo start   # the phone app
```

They can sign up a normal account and use the app against the real database.
RLS keeps them inside their own rows, the same as any user.

## Supabase dashboard access

Organization settings → Team → Invite member. Roles, least to most:

- **Developer** — sees the dashboard, tables, logs. Cannot touch billing or
  delete the project. **This is the right default.**
- **Administrator** — plus member management.
- **Owner** — plus billing and project deletion.

Invite as Developer unless there is a reason not to. A non-engineer in the
table editor can delete production rows with two clicks, so Developer plus a
conversation about what not to click is the safe combination.
