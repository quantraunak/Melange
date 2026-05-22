# Melange

**[Live web demo](https://melange-psi.vercel.app)** · **[iOS app](./mobile/README.md)** (Expo, App Store-ready)

A creative collaboration platform where artists, photographers, models, MUAs, stylists, and designers find each other. Post what you're working on, swipe through other creatives' projects, match when the interest is mutual, and message to plan the collaboration.

This repo contains:

- **Web app** (`/app`, `/components`, `/lib`) — Next.js + React + Supabase
- **iOS app** (`/mobile`) — Expo / React Native + Supabase, App Store-ready
- **Shared backend** (`/supabase`, `/supabase_schema.sql`, `/supabase_schema_v2.sql`) — Postgres + RLS + Storage + Edge Function for push

Both apps talk to the same Supabase project: same accounts, same posts, same matches. A user who signs up on iOS can sign in on web and vice versa.

## How it works

1. **Sign up** with your name, role, skills, and bio.
2. **Create a post** describing the collaboration you're looking for — add location, compensation, tags, and up to 5 images.
3. **Swipe** through other creatives' posts. Filter by role, location, or skill.
4. **Match** when both users like each other's posts.
5. **Message** your match in realtime to plan the collaboration.

## Features

### Shared (web + iOS)

- Email/password auth, persistent sessions
- Full profile editing (name, role, skills, bio, current project, avatar)
- Posts: title, description, looking-for tags, location, compensation, images
- Swipe feed filtered by search
- Mutual matching (both must right-swipe)
- Realtime chat per match
- Row-level security on every table

### iOS-only additions

- **Native swipe gestures** (Reanimated + Gesture Handler), feels like Tinder/Hinge
- **Push notifications** for new matches and messages (Expo Notifications + Supabase Edge Function)
- **Server-side unread tracking** — read state syncs across devices (`match_reads` table)
- **Multi-image posts** — up to 5 photos per post, swipeable gallery
- **Edit / delete your own posts**
- **Block & report** for App Store UGC compliance
- **In-app account deletion** for App Store 5.1.1(v) compliance
- **Onboarding intro** before signup

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
├── app/                        # Next.js web app (App Router)
├── components/                 # Web UI primitives (shadcn/ui)
├── lib/                        # Web utilities
├── mobile/                     # Expo / React Native iOS app
│   ├── app/                    # Expo Router routes
│   ├── src/lib/                # supabase, db, auth, matches, push, theme
│   ├── src/components/         # RN components + UI primitives
│   ├── assets/                 # Icons, splash
│   ├── store/                  # App Store submission metadata
│   ├── app.json, eas.json
│   └── README.md               # iOS-specific setup + submission guide
├── supabase/                   # Local Supabase CLI config + edge functions
│   └── functions/send-push/    # Push fan-out edge function
├── supabase_schema.sql         # Base schema (web + iOS)
├── supabase_schema_v2.sql      # iOS additions: blocks, reports, push_tokens, match_reads, RPCs
├── PRIVACY.md                  # Privacy policy (host this for App Store + GDPR)
├── TERMS.md                    # Terms of service
└── README.md                   # ← you are here
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

Run both SQL files in the Supabase SQL Editor, in order:

1. `supabase_schema.sql` — base tables, RLS, storage bucket
2. `supabase_schema_v2.sql` — iOS additions (blocks, reports, push tokens, match reads, RPCs)

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
