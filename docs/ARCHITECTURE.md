# Melange — Architecture

> How the codebase is organized and why.

Last updated: 2026-05-22

---

## High-level system

```
┌─────────────────────┐         ┌─────────────────────┐
│   Web (Next.js)     │         │  iOS (Expo / RN)    │
│   melange-psi       │         │   bundle: melange   │
│   .vercel.app       │         │                     │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │  HTTPS REST + Realtime + Storage
           └──────────────┬────────────────┘
                          ▼
            ┌─────────────────────────────┐
            │       Supabase              │
            │   (Postgres + Auth +        │
            │    Storage + Realtime +     │
            │    Edge Functions)          │
            └─────────────────────────────┘
                          │
                          ▼
                 Apple Push Notification
                 Service (via Edge Fn)
```

- **One backend** serves both clients. No code duplication on business logic.
- **Row-level security** at the database. Clients use the anon key; users only see what their RLS policies grant.
- **Realtime** for messages and matches via Supabase channels.
- **Edge Function** (`supabase/functions/send-push`) catches database webhooks for new messages / matches and sends Expo push notifications. Web ignores these; iOS subscribes.

---

## Repository layout

```
melange/
├── app/                       Next.js App Router (web app)
│   ├── layout.tsx
│   ├── page.tsx               → renders <AuthPage />
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   ├── components/
│   │   ├── AuthPage.tsx       login / signup / onboarding
│   │   ├── MelangeApp.tsx     the signed-in shell (tabs, modals)
│   │   ├── EventsView.tsx     events feature (Phase 1)
│   │   ├── ReportDialog.tsx
│   │   ├── EditPostDialog.tsx
│   │   ├── AccountSafetyDialog.tsx
│   │   └── ui/                shadcn primitives
│   └── lib/
│       ├── supabaseClient.ts  shared anon-key client
│       ├── db.ts              typed wrappers for all data access
│       └── events.ts          events-specific data access
│
├── mobile/                    Expo / React Native (iOS)
│   ├── app/                   Expo Router file-based routes
│   │   ├── (auth)/            login, signup, onboarding
│   │   ├── (tabs)/            connect, messages, profile, (events soon)
│   │   ├── chat/[matchId].tsx
│   │   ├── post/[id].tsx, post/new.tsx, post/edit/[id].tsx
│   │   └── account/blocked.tsx, account/delete.tsx
│   ├── src/
│   │   ├── lib/               theme, supabase, db, auth, push, matches
│   │   └── components/        SwipeCard, BrandHeader, Avatar, Logo, ui/*
│   └── assets/                icon, splash, adaptive-icon, notification
│
├── supabase/
│   └── functions/send-push/   Edge Function for push notifications
│
├── supabase_schema.sql        v1 — auth, profiles, posts, swipes, matches, messages
├── supabase_schema_v2.sql     v2 — blocks, reports, push_tokens, match_reads
├── supabase_schema_v3.sql     v3 — events, vibes, portfolios (Phase 1)
├── wipe_users.sql             dev utility — wipe all data
│
├── scripts/                   one-off ops scripts (run with env vars only)
│   ├── apply_migration.mjs    apply a SQL file via Management API
│   └── wipe_users.mjs         wipe all users via service role
│
├── docs/
│   ├── STRATEGY.md            why we're building this
│   ├── ROADMAP.md             what we're shipping when
│   ├── METRICS.md             how we measure success
│   └── ARCHITECTURE.md        this file
│
├── PRIVACY.md                 source for /privacy page
├── TERMS.md                   source for /terms page
└── README.md                  setup, build, deploy
```

---

## Data model

The current schema (v1 + v2 + v3) is roughly:

```
auth.users (managed by Supabase)
    │
    ├── profiles               1:1 with auth.users
    │     name, role, bio, current_project, skills[], avatar_url,
    │     vibes[] (v3), portfolio_media (v3)
    │
    ├── collab_posts           1:N — your posts
    │     title, description, looking_for[], location, compensation,
    │     media_urls[], is_active, updated_at,
    │     vibes[] (v3)
    │
    ├── swipes                 your swipe history (left/right)
    │     post_id, direction
    │
    ├── matches                bidirectional pairs derived from mutual right-swipes
    │     user1_id, user2_id, post1_id, post2_id
    │     └── messages         realtime
    │     └── match_reads      server-side unread tracking (v2)
    │
    ├── blocks                 you-blocked-them (v2)
    ├── reports                you-flagged-them (v2)
    ├── push_tokens            your iOS device tokens (v2)
    │
    ├── events                 (v3) you-host or you-RSVP
    │     title, category, start_at, end_at, location_name, city, lat, lng,
    │     cover_url, capacity, is_canceled
    │     └── event_rsvps      (v3) M:N — user × event
    │
    ├── collab_reviews         (v4) two-sided reviews per match; mutual reveal
    │     match_id, reviewer_id, reviewee_id, rating 1–5, tags[], body
    │
    └── (future) shoot_diary   (Phase 2) public collab outputs
```

Every table has Row Level Security enabled. Policies grant:
- **SELECT** based on ownership or public visibility (e.g. you can see any active post)
- **INSERT** only with your own `user_id`
- **UPDATE / DELETE** only on your own rows

RPCs that bypass RLS for legitimate reasons:
- `feed_posts(p_user_id UUID)` — chronological swipe feed (legacy fallback).
- `ranked_feed_posts(p_user_id UUID)` — **v4** scored feed (see Ranking below).
- `explore_posts(p_user_id, p_limit)` — browse feed with block filter + reputation sort.
- `creator_reputation(p_user_ids UUID[])` — avg rating + count for visible (mutual) reviews.
- `delete_account()` — deletes the calling user's `auth.users` row, which cascades to everything else.

### Ranking (v4 — “Tinder engineering” without ML infra yet)

`ranked_feed_posts` scores each candidate post in SQL:

| Signal | Weight | Notes |
|--------|--------|-------|
| Recency | 30% | Exponential decay (~7-day half-life) |
| Vibe overlap | 25% | Jaccard on `profiles.vibes` ∩ `collab_posts.vibes` |
| Role complementarity | 20% | Boost if your role ∈ post `looking_for`; partial if roles differ |
| Reputation | 15% | Normalized avg of mutually revealed collab reviews |
| Portfolio depth | 10% | Up to 9 images on profile |

Client-side **diversity pass** (`diversifyFeed` in `app/lib/db.ts`) interleaves creators so the same photographer does not dominate the stack.

**Next (Phase 3):** embeddings on portfolio images (CLIP), event co-attendance boost, swipe caps, “see who liked you.”

### Collab reviews (v4)

- One review per user per match, after **14 days** from `matches.created_at`.
- Reviews are **hidden until both parties submit** (double-blind, anti-retaliation).
- Short form: 1–5 stars, up to 2 tags, optional text.
- Profile fields: `instagram_url`, `linkedin_url` (normalized on save).

---

## Auth flow

1. User signs up → Supabase Auth creates a row in `auth.users` and returns a session.
2. Client immediately creates a row in `public.profiles` with the same `user_id`.
3. JWT cookies (web) or AsyncStorage (mobile) hold the session.
4. Every request to Supabase carries the JWT; RLS policies look at `auth.uid()` to gate access.
5. On signout we clear local state and tell Supabase to invalidate the session.

---

## Realtime

```
Client subscribes to channel: chat:<match_id>
     └── INSERT on messages WHERE match_id = <match_id>

Client subscribes to channel: feed-events-<user_id>
     ├── INSERT on matches WHERE user1_id = <user_id>
     ├── INSERT on matches WHERE user2_id = <user_id>
     └── INSERT on messages (any) → update sidebar last-message preview
```

Phase 1 adds:
```
Client subscribes to channel: events-<city>
     └── INSERT on events WHERE city = <city>     (events feed live updates)
```

---

## Push notifications

Per-device token flow:
1. iOS app launches → asks for permission
2. If granted, gets an Expo push token
3. Upserts the token into `public.push_tokens` for this user
4. Supabase webhook fires on `INSERT` to `messages` / `matches`
5. Webhook hits our `send-push` Edge Function
6. Edge function looks up the recipient's tokens and posts to `exp.host/api/v2/push/send`
7. Expo delivers via APNs

Web ignores push notifications entirely. (Browser notifications were considered and rejected — low value, high implementation cost.)

---

## Deployment

| Surface | Where | Trigger |
|---|---|---|
| Web | Vercel | `git push origin main` |
| iOS dev build | Expo Go / local sim | `cd mobile && npx expo start` |
| iOS production | EAS Build → App Store | `eas build && eas submit` |
| Database migrations | Supabase Management API | `node scripts/apply_migration.mjs` |
| Edge Functions | Supabase CLI | `supabase functions deploy send-push` |

---

## Style & conventions

- TypeScript everywhere. No `any` without an explicit `// reason:` comment.
- Tailwind 4 on the web. StyleSheet on native, with shared design tokens in `mobile/src/lib/theme.ts`.
- Functional components, no class components.
- One source of truth: the database. No client-side global state managers (Redux, Zustand). React state + Supabase + URL params are enough.
- Server-side wherever possible. The Edge Function for push exists because the alternative — a long-running Node server — would be operational overhead we don't need yet.

---

## Security model

- Two keys: the **anon key** (public, shipped in client bundles, only does what RLS allows) and the **service role key** (never in client code, used for one-off admin ops via the `scripts/` utilities).
- All user-controllable input passes through Postgres-level constraints + RLS — we don't trust client validation.
- Auth tokens stored in `httpOnly` cookies (web) / `AsyncStorage` (mobile, encrypted via Expo SecureStore in production).
- File uploads scoped to the user's path: `media/<folder>/<user_id>/<random>.ext`. RLS on `storage.objects` enforces this.
- No third-party analytics / tracking in Phase 1. (Privacy budget = strategic moat.)

---

## When you're stuck

- **DB schema questions** → `supabase_schema*.sql` are the source of truth.
- **What does this function do?** → All data access goes through `app/lib/db.ts` (web) or `mobile/src/lib/db.ts` (native). The types are accurate.
- **Why does this look like this?** → `docs/STRATEGY.md` § "What we believe".
- **What should I build?** → `docs/ROADMAP.md`.
- **How do I know if my change worked?** → `docs/METRICS.md`.
