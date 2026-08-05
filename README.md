# Melange

**Where creative people find their next collaboration.**

A photographer needs a model. A model needs a stylist. A filmmaker needs a whole crew. Right now that all happens through Instagram DMs and group chats. Melange is a place built for it: post what you're working on, swipe through other people's projects, match when you both like each other's work, and message to plan the shoot.

**[Try the web app](https://melange-psi.vercel.app)** · **[iOS app setup](./mobile/README.md)**

> **Where things actually stand:** read [`docs/STATUS.md`](./docs/STATUS.md) first. It has the real numbers, what works, what's broken, and what's blocking launch — no spin.
>
> For the reasoning behind the product, read [`docs/STRATEGY.md`](./docs/STRATEGY.md).

## What's in this repo

| Folder | What it is |
|---|---|
| `app/` | The website (Next.js) |
| `mobile/` | The iPhone app (Expo / React Native) |
| `supabase/` | The database, security rules, and the server function that sends push notifications |
| `docs/` | Strategy, status, roadmap, design, setup guides |
| `scripts/` | Admin tools — apply a database change, wipe test data, seed demo accounts |

Both apps share one database. Sign up on your phone, sign in on the web, same account and same messages.

## How it works, for a user

1. **Sign up** — name, role, skills, bio.
2. **Post a collaboration** — what you're looking for, where, paid or unpaid, up to 5 photos.
3. **Swipe** through other people's posts.
4. **Match** when you both swipe right.
5. **Message** to plan the shoot.

There's also an events tab (photo walks, open calls, gallery openings) and a portfolio gallery on your profile.

## What's built

Everything below works on **both** the website and the iPhone app:

- Sign up and sign in, with sessions that persist
- Full profile editing, including avatar and up to 9 portfolio images
- Posts with photos, location, pay, and tags — create, edit, delete
- Swipe feed with search, filtered by who you've blocked
- Matching, and live chat with unread counts that stay in sync across devices
- Events — create one, browse by city, RSVP
- "Vibe" tags that influence what shows up in your feed
- Reviews after a collaboration, visible on both profiles
- Block and report, for users, posts, and messages
- Delete your account from inside the app
- Every database table is locked down so you can only read and write your own data

**iPhone-only extras:** native swipe gestures, push notifications for matches and messages, an intro carousel before signup.

**Not built yet:** travel mode ("I'm in NYC next week") and Shoot Diary (posting the results of a collaboration). See [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## How it's built

There is no backend server. Both apps talk straight to Supabase, and the database itself enforces who can see what.

| | Website | iPhone app |
|---|---|---|
| Framework | Next.js | Expo |
| Language | TypeScript | TypeScript |
| Look and feel | React + Tailwind | React Native |
| Database, login, file storage, live updates | Supabase | Supabase |
| Where it runs | Vercel | App Store |

More detail in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Running it yourself

**Website:**

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and key
npm run dev                  # open http://localhost:3000
```

**iPhone app:**

```bash
cd mobile
npm install
cp .env.example .env         # same Supabase URL and key as above
npm run ios
```

Full iPhone setup, push notification wiring, and the App Store submission steps are in [`mobile/README.md`](./mobile/README.md).

## Setting up the database

Run these five files in order, in the Supabase SQL Editor:

| File | What it adds |
|---|---|
| `supabase/schema/01_core.sql` | Accounts, profiles, posts, swipes, matches, messages |
| `supabase/schema/02_safety.sql` | Blocking, reporting, push notification tokens, unread tracking |
| `supabase/schema/03_events.sql` | Events, vibe tags, portfolios |
| `supabase/schema/04_reviews.sql` | Reviews, social links, feed ranking |
| `supabase/schema/05_ranking.sql` | Analytics, verified badges, better ranking, live chat updates |

Or from the command line:

```bash
SUPABASE_PROJECT_REF=... SUPABASE_ACCESS_TOKEN=... \
MIGRATION_FILE=supabase/schema/03_events.sql node scripts/apply_migration.mjs
```

You can safely run any of them more than once.

## App Store status

The app builds and the submission pipeline works, but it is **not submitted yet**. Screenshots are the main thing missing. The full checklist is in [`docs/STATUS.md`](./docs/STATUS.md#app-store-what-is-actually-left).

Apple requires certain safety features for any app with user-generated content. All of them are done: reporting, blocking, a privacy policy and terms, in-app account deletion, an 18+ age gate at signup, and a contact email for moderation.
