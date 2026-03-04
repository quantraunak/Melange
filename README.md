# Melange

A swipe-based matchmaking app for creative collaborators. Photographers, models, designers, and other creatives post collaboration proposals and swipe on each other's posts. Mutual right-swipes create a match.

## Current Features

- **Auth**: Email/password signup and login via Supabase Auth, with profile creation (name, role, skills, bio)
- **Feed**: Swipeable card stack of collaboration posts from other users, excluding already-swiped posts
- **Swipe & Match**: Left/right swipe on posts; mutual right-swipes trigger match creation with canonical user ordering
- **Matches View**: List of matches enriched with the other user's post details, with a detail dialog
- **Database**: Full Postgres schema with RLS policies enforcing ownership-based access control

Not yet implemented: messaging, file uploads (profile pictures / work samples), post creation UI.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| UI | React 19, Radix UI primitives, Tailwind CSS 4 |
| Backend / Auth | Supabase (hosted Postgres + GoTrue auth + PostgREST API) |
| Database | PostgreSQL via Supabase |
| Client | `@supabase/supabase-js` v2 |

## Architecture

```
app/
├── page.tsx                  # Entry point, renders AuthPage
├── layout.tsx                # Root layout
├── components/
│   ├── AuthPage.tsx          # Login/signup forms, session gating
│   └── MelangeApp.tsx        # Post-login app (feed, swipe, matches)
├── lib/
│   ├── supabaseClient.ts     # Singleton Supabase client (browser-side)
│   └── db.ts                 # All database queries (posts, swipes, matches)
components/ui/                # shadcn/ui components (Button, Card, Dialog, etc.)
```

There is no separate backend server. All data access goes directly from the browser to Supabase's PostgREST API, secured by Row Level Security policies.

## Database Schema

Five tables, all with RLS enabled:

| Table | Purpose | Key Columns |
|---|---|---|
| `profiles` | User profile data | `user_id` (FK → auth.users), name, role, skills[], bio |
| `collab_posts` | Collaboration proposals | `owner_id` (FK → auth.users), title, description, looking_for[], location, compensation, media_urls[] |
| `swipes` | Swipe actions | `swiper_id`, `post_id`, direction (left/right). Unique on (swiper_id, post_id) |
| `matches` | Mutual swipe matches | `user1_id`, `user2_id`, `post1_id`, `post2_id`. Unique on (user1_id, user2_id) |
| `messages` | Chat messages (stub) | `match_id`, `sender_id`, content |

Schema SQL is in `supabase_schema.sql`. Run it in the Supabase SQL Editor to set up tables and RLS policies.

## Local Setup

```bash
git clone <repo-url> && cd melange
npm install
cp .env.local.example .env.local   # then fill in your Supabase credentials
npm run dev                         # starts at http://localhost:3000
```

Prerequisites: Node.js 18+, a Supabase project with the schema applied.

## Environment Variables

Create `.env.local` in the repo root:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # JWT anon key from Supabase Dashboard → Settings → API
```

Both variables use the `NEXT_PUBLIC_` prefix so they are inlined into the client bundle at build time. The anon key must be the JWT format (starts with `eyJ`), not the newer `sb_publishable_` format.

## Future Roadmap

- [ ] Post creation UI (currently posts are inserted via SQL or debug buttons)
- [ ] Real-time messaging between matched users (schema exists, UI does not)
- [ ] Profile picture and work sample uploads via Supabase Storage
- [ ] Profile editing
- [ ] Push notifications for new matches
- [ ] Search/filter posts by role, location, skills
- [ ] Clean up debug logging in `db.ts` and `AuthPage.tsx`
