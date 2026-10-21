# Melange

**Where creative people find their next collaboration.** Photographers,
models, stylists and other creatives find people whose work fits theirs, see
who's into what they make, and make something together.

iOS app on the [App Store](https://apps.apple.com/app/id6774481477) ·
website at [melange-psi.vercel.app](https://melange-psi.vercel.app) ·
built and run by one engineer (Raunak Sood), with Jolea on community.

<p>
  <img src="public/screenshots/discover.png" width="230" alt="Discover" />
  <img src="public/screenshots/explore.png" width="230" alt="Shoots with credits" />
  <img src="public/screenshots/showcase.png" width="230" alt="A shoot with credits" />
</p>

---

## What it does

1. **Discover** shows creatives and projects near you. Melange learns your
   taste from the work you make and like.
2. **Hearts** tell people you're into their work; when someone hearts yours,
   you can write back right away.
3. **Events** are where people meet in person: a link anyone can RSVP to, a
   chat for everyone going, and afterwards a photo roll private to the people
   who were there, plus quiet hearts that only reveal when they're mutual.
4. **Credits** record who made what, on everyone's profile.

## By the numbers

| | |
|---|---|
| App Store releases | 9 shipped: 1.0 in May 2026, then 1.2 → 1.8 between Oct 9 and Oct 20 |
| Database migrations | 27, every one idempotent; the recent ones tested against production inside a rolled-back transaction before applying |
| Code | ~35k lines of TypeScript and SQL across an Expo app, a Next.js site and Postgres |
| Production bugs found by querying the live database | ~40, most of them the "reports success, does nothing" kind |
| Users | early: about a dozen accounts. This is a working product, not a traction story yet. |

## The AI: who you should work with

The hard part of a collaboration app is who to show you. Melange learns it
from the work people make, and checks itself against chance.

- **Taste** is the average CLIP embedding of the images a member has posted
  and hearted ([`scripts/taste/embed.py`](scripts/taste/embed.py)). The model
  is open-source and runs locally on Apple silicon: no photo goes to a third
  party, and nothing asks it about anyone's face.
- **A pair score** combines taste similarity, whether two roles make each
  other's work possible (a photographer and a stylist, not two
  photographers) and shared interests. The weights start as a prior and are
  refit from outcomes ([`scripts/taste/learn.py`](scripts/taste/learn.py)),
  which refuses to fit on too little data rather than memorise a handful of
  pairs.
- **At events, a composer** seats whole tables
  ([`compose.ts`](supabase/functions/compose-tables/compose.ts)): each
  person's average chemistry with their tablemates through a concave curve,
  so lifting the person who's worst off beats polishing a good table; local
  search with random restarts; blocked pairs never together. It runs as an
  Edge Function under the host's own session, so the database decides who may
  seat a room.
- **It's tested, not assumed.** At an event, half the attendees are seated by
  the composer and half at random, in the same room, with nobody told which
  half they're in. [`26_room_composer.sql`](supabase/schema/26_room_composer.sql)
  compares the arms on mutual hearts, conversations still going a week later,
  and coming back.

The first production run caught a flaw in the design: with thirteen people
each arm got one table, so the composer had no choice to make and its table
scored *worse* than random (0.67 vs 0.74 taste similarity). Tables now shrink
until each arm has at least two. Across three runs after the fix, composed
tables scored 0.77–0.85 against 0.64–0.69 for random ones. That shows the
optimizer works; whether it leads to more real collaborations is what real
events will measure.
- **Discover uses taste too.** The deck is re-ordered by how close each
  person's work is to yours ([`27_taste_in_discover.sql`](supabase/schema/27_taste_in_discover.sql),
  [`taste.ts`](mobile/src/lib/taste.ts)): it nudges the server's ranking of
  projects and leads the ordering of people.

## Engineering worth looking at

**Privacy and safety enforced by the database, not the client.** Both apps
talk straight to Postgres with a public key, so every rule lives in row-level
security and `SECURITY DEFINER` functions
([`supabase/schema`](supabase/schema)). A few examples:

- **Mutual-only reveals.** Hearts between people from the same event go in a
  table with RLS on and *no read policy at all*; the only way in is a
  function that tells you about a heart when it's mutual
  ([`23_scenes_invites_nights.sql`](supabase/schema/23_scenes_invites_nights.sql)).
  The first design reused the app's general hearts table — which notifies the
  recipient on insert — and would have leaked every one-way heart.
- **Private event photos.** A storage bucket whose read policy derives
  membership from the object path, so a photo is visible only to the host and
  the people going, and nobody can upload under someone else's name
  ([`25_web_rsvp_and_night_photos.sql`](supabase/schema/25_web_rsvp_and_night_photos.sql)).
- **Server-only fields.** Verification status and founding status are guarded
  by triggers that ignore client writes, after an audit found any user could
  give themselves the verified badge with one API call
  ([`21_trust_and_support.sql`](supabase/schema/21_trust_and_support.sql)).

**Testing migrations against production without changing it.** Every recent
migration was run inside `BEGIN … ROLLBACK` against the live database with
behavior tests that impersonate real roles (`SET LOCAL ROLE authenticated`,
forged JWT claims): can an outsider read an event chat, can a spoofed upload
path get through, does a second invite code get refused. That caught a policy
someone had added in the dashboard — present in production, in no migration —
that let signed-out visitors read every profile.

**The bug class that shaped the codebase.** The recurring defect was
"something reports success while doing nothing": a zero-row `UPDATE` returns
no error; a `void supabase.rpc(...)` never sends because the builder is lazy
(that one silently dropped five months of analytics); push webhooks configured
by a comment telling a human to click through a dashboard, which nobody did.
The fixes moved configuration into migrations
([`12_push_webhooks.sql`](supabase/schema/12_push_webhooks.sql)) and made
"await it and check the error" a house rule.

**A security pass a reviewer would actually find.** The published support
address was on a parked domain someone else owned (mail to it could never
arrive, and its buyer could have reset the review accounts); demo passwords
were in the public repo; toggling a heart could buzz someone's phone
indefinitely; a heart you *sent* lifted the cold-message limit. Each is fixed
and the reasoning is in the migration that fixed it.

**Shipping from the command line.** EAS builds, an App Store Connect API
script ([`scripts/asc.mjs`](scripts/asc.mjs)) that creates versions, attaches
builds and submits for review, and `fastlane` for screenshots — so a release
is a few commands, not an afternoon in a web console.

## Product decisions, and why

Melange started as swipe-to-match for creative collaborators, and that's
still its core. Research shaped what grew around it: a free collaboration has
no transaction to build a business on, and Instagram already makes the
introduction ([`docs/MARKET_RESEARCH_2026-10.md`](docs/MARKET_RESEARCH_2026-10.md)).
A second pass studied ~50 consumer social companies from 2023–2026
([`docs/RESEARCH_2026.md`](docs/RESEARCH_2026.md)). What it pointed to:

- **Give people a reason to meet in real life** (Timeleft, run clubs grew;
  one-mechanic apps faded) → events, with a chat before and photos after.
- **The invite should work before the download** (Partiful) → anyone can
  RSVP from an event's web page.
- **Private content of you and your people beats public feeds** (Locket,
  Retro) → an event's photos are visible only to the people who were there.
- **Get dense in one place first** → scenes, starting with LA.

## How it's built

| | Website | iOS app | Backend |
|---|---|---|---|
| | Next.js (App Router), Tailwind | Expo / React Native, expo-router | Supabase: Postgres, Auth, Storage, Realtime, Edge Functions |
| Hosting | Vercel | App Store | Supabase |

Both clients share one database and no other code. Push notifications are
Postgres triggers that call an Edge Function (`supabase/functions/send-push`),
which sends through Expo. More in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Running it

```bash
npm install
cp .env.example .env.local   # Supabase URL + anon key
npm run dev                  # website on http://localhost:3000

cd mobile && npm install && npx expo start   # iOS app
```

Database changes are plain SQL files in `supabase/schema`, applied in order
(`scripts/apply_migration.mjs`). Setup details in [`docs/SETUP.md`](docs/SETUP.md).
