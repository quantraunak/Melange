# Melange

**[Live Demo](https://melange-psi.vercel.app)**

A creative collaboration platform where artists, photographers, models, and other creatives find each other. Create a profile, post what you're working on, swipe through others' projects, match when the interest is mutual, and message to plan the collaboration.

## How It Works

1. **Sign up** with your name, role, skills, and bio.
2. **Create a post** describing the collaboration you're looking for -- add location, compensation, tags, and an image.
3. **Swipe** through other creatives' posts. Filter by role, location, or skill.
4. **Match** when both users like each other's posts.
5. **Message** your match in realtime to plan the collaboration.

## Features

- **Auth** -- Email/password signup and login with full profile creation.
- **Profile editing** -- Update name, role, skills, bio, and current project at any time.
- **Avatar upload** -- Upload a profile photo, displayed across feed cards, matches, and chat.
- **Post creation** -- Publish collaboration posts with title, description, looking-for tags, location, compensation, and an optional image.
- **Swipe feed** -- Card stack of posts from other users, filtered by search query across all fields.
- **Mutual matching** -- Right-swipe on a post; if the post owner has also right-swiped on one of yours, a match is created.
- **Realtime chat** -- Per-match conversation threads with live message delivery via Supabase Realtime.
- **Unread indicators** -- Badge count on the Messages tab and visual distinction for conversations with new messages.
- **Realtime matches** -- New matches appear automatically without requiring a page refresh.
- **Row Level Security** -- All data access enforced at the database level.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| UI | React, Radix UI, Tailwind CSS |
| Auth, Database, Storage, Realtime | Supabase (Postgres, GoTrue, PostgREST, Realtime, Storage) |
| Hosting | Vercel |

No separate backend. The browser talks directly to Supabase's APIs, secured by Postgres RLS policies.

## Run Locally

Prerequisites: Node.js 18+, a [Supabase](https://supabase.com) project.

```bash
git clone <repo-url> && cd melange
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Get both values from your Supabase Dashboard under **Settings > API**. The anon key must be the JWT format (starts with `eyJ`).

### Database Setup

Open the Supabase SQL Editor and run the contents of [`supabase_schema.sql`](./supabase_schema.sql). This single file creates all tables, indexes, RLS policies, and the storage bucket in one pass. It is idempotent.

### Supabase Dashboard Setup

After running the schema SQL:

1. **Realtime** -- Enable Realtime for the `messages` and `matches` tables.
   Go to **Database > Replication**, find each table, and toggle Realtime on.

2. **Storage** -- The schema SQL creates a public `media` bucket automatically.
   Verify it exists under **Storage** in the dashboard. If not, create a bucket named `media` with public access enabled.

3. **Auth** -- Email confirmations are off by default for local development.
   Under **Authentication > Providers > Email**, ensure "Confirm email" is disabled if you want instant sign-in during development.

### Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

The app deploys to [Vercel](https://vercel.com) with zero configuration. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables in the Vercel project settings.

## Project Structure

```
app/
  components/
    AuthPage.tsx       # Login, signup, and profile creation
    MelangeApp.tsx     # Main app: feed, messages, profile tabs
  lib/
    db.ts              # All Supabase queries and types
    supabaseClient.ts  # Supabase client initialization
  layout.tsx           # Root layout
  page.tsx             # Entry point
components/ui/         # shadcn/ui primitives
supabase/              # Supabase CLI config (local dev)
supabase_schema.sql    # Canonical database + storage schema
```

## Known Limitations

- **Per-device unread tracking** -- Unread message state is stored in the browser's localStorage rather than in the database, so read/unread status does not sync across devices or browsers.
- **No push notifications** -- New matches and messages are only visible when the app is open.
- **No post editing or deletion** -- Posts are immutable after creation.
- **Single image per post** -- Posts support one image; galleries are not implemented.
- **No blocking or reporting** -- No moderation tools exist yet.
- **Client-side search only** -- Post filtering happens in-memory on already-loaded data, not via server-side full-text search.
