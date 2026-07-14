# Melange setup (website + iOS)

## One command (local)

```bash
node scripts/setup_all.mjs
```

Requires `.env.local` at repo root (see `.env.example`).

## Run website

```bash
npm run dev
```

Open http://localhost:3000

## Run iOS app (simulator)

```bash
cd mobile
npm run ios
```

First run may take several minutes (Xcode build).

## Production website (Vercel)

Dashboard → Project → **Settings → Environment Variables** — same four keys as `.env.local`:

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret / service key (server only) |
| `ADMIN_REPORTS_KEY` | Your chosen password for `/internal/reports` |

Redeploy after saving.

## TestFlight build (after Apple Developer is active)

```bash
cd mobile
eas login
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "..." --type string
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..." --type string
eas build --platform ios --profile production
```

Use the same URL and anon key as `.env.local` (not the service secret).

## Demo logins

- `review@melange.app` / `ReviewMelange2026!`
- `demo2@melange.app` / `DemoMelange2026!`
