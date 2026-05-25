# Melange

**[Live web demo](https://melange-psi.vercel.app)** · **[iOS app](./mobile/README.md)** (Expo, App Store-ready)

**Where creative people find their next collaboration.** Photo walks. Open calls. Mutual swipes that lead to real shoots. The middle ground between Instagram and LinkedIn — built for the way creative work actually happens.

> 📖 **Product strategy + roadmap + architecture live in [`/docs`](./docs/).** Read [`STRATEGY.md`](./docs/STRATEGY.md) first to understand the bet.

This repo contains:

- **Web app** (`/app`) — Next.js 16 + React 19 + Supabase
- **iOS app** (`/mobile`) — Expo / React Native + Supabase, App Store-ready
- **Shared backend** (`/supabase`, `/supabase_schema*.sql`) — Postgres + RLS + Storage + Edge Function for push
- **Docs** (`/docs`) — strategy, roadmap, metrics, architecture
- **Ops scripts** (`/scripts`) — wipe users, apply migrations (read secrets from env only)

Both apps talk to the same Supabase project: same accounts, same posts, same matches. A user who signs up on iOS can sign in on web and vice versa.

## How it works

1. **Sign up** with your name, role, skills, and bio.
2. **Create a post** describing the collaboration you're looking for — add location, compensation, tags, and up to 5 images.
3. **Swipe** through other creatives' posts. Filter by role, location, or skill.
4. **Match** when both users like each other's posts.
5. **Message** your match in realtime to plan the collaboration.

## Features

### Shipped (web + iOS, full parity)

- Email/password auth with persistent sessions and Terms / 18+ acceptance
- Full profile editing (name, role, skills, bio, current project, avatar)
- **Posts** with title, description, looking-for tags, location, compensation, and **up to 5 images**
- **Edit / delete** your own posts
- **Swipe feed** filtered by search; respects blocks in both directions
- Mutual matching (both must right-swipe)
- **Realtime chat** per match with server-side unread tracking that syncs across devices
- **Block & report** for users, posts, and messages (App Store UGC compliance)
- **In-app account deletion** for App Store 5.1.1(v) compliance
- **Events** — host or RSVP to photo walks, open calls, gallery openings, workshops, meetups, exhibitions. Filter by city. *(Phase 1 — strategic bet, see [`docs/STRATEGY.md`](./docs/STRATEGY.md))*
- **Portfolio gallery** — up to 9 portfolio images per profile (web + iOS); strip on swipe cards on web
- Privacy policy and Terms of Service pages (rendered statically)
- Row-level security on every table

### iOS-only additions

- **Native swipe gestures** (Reanimated + Gesture Handler), feels like Tinder/Hinge
- **Push notifications** for new matches and messages (Expo Notifications + Supabase Edge Function)
- Native bottom tab bar (Connect · Events · Messages · Profile)
- Onboarding intro carousel before signup

### Coming next (see [`docs/ROADMAP.md`](./docs/ROADMAP.md))

- Vibe tags for aesthetic-driven matching
- Host events from iOS (browse + RSVP on iOS; create on web)
- Two-sided reviews after collabs
- Travel mode ("I'm in NYC next week")
- Shoot Diary (post your collab outputs for organic growth)

## Tech stack

| Layer | Web | iOS |
|---|---|---|
| Framework | Next.js (App Router) | Expo + Expo Router |
| Language | TypeScript | TypeScript |
| UI | React + Radix + Tailwind v4 | React Native + StyleSheet (matched palette) |
| Gestures | n/a | Reanimated + Gesture Handler |
| Notifications | n/a | Expo Notifications |
| Auth, DB, Storage, Realtime | Supabase | Supabase |
| Hosting | Vercel | EAS Build → App Store |

No separate backend. The clients talk directly to Supabase, secured by Postgres RLS.

## Repository layout

```
melange/
├── app/                         # Next.js web app (App Router)
│   ├── components/              # AuthPage, MelangeApp, EventsView, dialogs
│   ├── lib/                     # supabaseClient, db, events
│   ├── privacy/, terms/         # Static legal pages
│   └── page.tsx, layout.tsx
├── components/                  # shadcn/ui primitives (Button, Input, Dialog, ...)
├── lib/                         # Utilities (cn helper)
├── mobile/                      # Expo / React Native iOS app
│   ├── app/                     # Expo Router routes
│   ├── src/lib/                 # supabase, db, auth, matches, push, theme
│   ├── src/components/          # RN components + UI primitives
│   ├── assets/                  # Icons, splash
│   ├── store/                   # App Store submission metadata
│   ├── app.json, eas.json
│   └── README.md                # iOS-specific setup + submission guide
├── supabase/                    # Local Supabase CLI config + edge functions
│   └── functions/send-push/     # Push fan-out edge function
├── supabase_schema.sql          # Base schema
├── supabase_schema_v2.sql       # blocks, reports, push_tokens, match_reads, RPCs
├── supabase_schema_v3.sql       # Events, vibes, portfolios (Phase 1)
├── supabase_schema_v4.sql       # Reviews, social links, ranked feed RPCs
├── scripts/                     # Ops scripts — read secrets from env only
│   ├── apply_migration.mjs      # Apply a SQL file via the Management API
│   └── wipe_users.mjs           # Wipe all users + data (dev only)
├── docs/                        # Strategy, roadmap, design, metrics, architecture
│   ├── STRATEGY.md              # The bet we are making and why
│   ├── ROADMAP.md               # What we're shipping when
│   ├── DESIGN.md                # Visual language, tokens, components
│   ├── METRICS.md               # How we measure success
│   └── ARCHITECTURE.md          # Codebase guide for future contributors
├── PRIVACY.md, TERMS.md         # Source for /privacy and /terms pages
└── README.md                    # ← you are here
```

## Run locally

### Web

```bash
npm install
cp .env.local.example .env.local   # fill NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
npm run dev
# open http://localhost:3000
```

### iOS

```bash
cd mobile
npm install
cp .env.example .env               # same Supabase URL + ANON_KEY as web
npm run ios
```

See [`mobile/README.md`](./mobile/README.md) for the full iOS setup, push notifications wiring, and App Store submission guide.

## Database setup

Run all SQL files in the Supabase SQL Editor, in order:

1. `supabase_schema.sql` — base tables, RLS, storage bucket
2. `supabase_schema_v2.sql` — iOS additions (blocks, reports, push tokens, match reads, RPCs)
3. `supabase_schema_v3.sql` — events, vibes, portfolios
4. `supabase_schema_v4.sql` — collab reviews, Instagram/LinkedIn, ranked feed

Or via Management API:

```bash
SUPABASE_PROJECT_REF=... SUPABASE_ACCESS_TOKEN=... \
MIGRATION_FILE=supabase_schema_v4.sql node scripts/apply_migration.mjs
```

Both are idempotent. Then enable Realtime for the `messages` and `matches` tables under **Database → Replication**.

## App Store submission

The iOS app is App Store-ready. See [`mobile/README.md`](./mobile/README.md#building-for-the-app-store) for the EAS Build + Submit workflow. App Store listing copy is pre-written in [`mobile/store/metadata.md`](./mobile/store/metadata.md).

Apple's UGC compliance is fully covered:

- ✅ Reports (post, user, message — six categorized reasons + free text)
- ✅ Blocks (per-user, two-way feed filtering)
- ✅ Privacy policy + Terms of service (live in this repo, host them anywhere)
- ✅ In-app account deletion with cascading data wipe
- ✅ Age gate at signup (18+)
- ✅ Email contact for moderation concerns
