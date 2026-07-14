# Melange — Investor / Technical Diligence Overview

> Written for a seed investor's technical advisor. ~10 minute read.
> Last updated: 2026-07-12. Every claim below was verified by reading the
> codebase, running the app, or querying the live database directly — see
> [`docs/AGENT_MISSION.md`](./AGENT_MISSION.md) for the verification standard
> this repo holds itself to. No traction or financial numbers here are
> estimated; where a number doesn't exist yet, it's marked `TODO(founder)`.

---

## 1. One-line pitch

**Melange is where creative people find their next collaboration.**
A photographer finds a model. A model finds a stylist. A director finds a DP.
Discovery happens through events you can actually show up to, portfolios that
show taste, and a swipe layer for asynchronous matching.

*(Pulled verbatim from [`docs/STRATEGY.md`](./STRATEGY.md) §1 — not rewritten for this doc.)*

---

## 2. Problem and wedge

The matching market for creative collaboration is structurally thin, and no
existing product covers it:

| Problem | Why existing tools fail |
|---|---|
| Role complementarity (a photographer needs a model, not another photographer) | Instagram/Behance optimize for follower-fan dynamics, not collaboration |
| Aesthetic fit (a moody portrait shooter doesn't want bright commercial work) | Job boards treat "photographer" as fungible; taste-match is what actually matters |
| Geographic + temporal overlap (both parties need to be in the same city, this weekend) | Static profiles don't surface who's available now or passing through |
| Trust (meeting strangers for a shoot is high-stakes, especially for models) | Generic platforms have no creative-specific reputation system |
| Cold start ("I don't even know how to ask" is the #1 reason collabs don't happen) | No structured prompt to introduce yourself about a specific project |

Instagram sits at one end (no structured collab signal, DMs are cold-outreach
noise). LinkedIn/Mandy.com/StarNow sit at the other (transactional, no
aesthetic signal, job-board energy). The relational + creative-specific
quadrant in the middle is open — held together today by DMs, group chats,
and luck. That's the wedge.

**The unique insight:** creative collaboration is low-frequency (2–6x/year
per user), so a pure swipe product is too thin a market to ever feel
magical. Melange's bet is to bundle low-frequency matching with
high-frequency activity — **events** (real-world density + low-risk group
meetups), **aesthetic signal** (vibe tags, portfolios), and **matching**
(swipe + chat, informed by the other two) — stacked together. No competitor
stacks all three today. Full detail, personas, and moat analysis in
[`docs/STRATEGY.md`](./STRATEGY.md).

---

## 3. What's built and shipped today

Both the web app and the iOS app are real, running software against a shared
production Supabase backend — not a prototype or a clickable mock. This
section is deliberately conservative: it lists what is live and working
today, not what's planned (see `docs/ROADMAP.md` for that).

**Shipped, web + iOS, full parity:**
- Email/password auth with persistent sessions, Terms/18+ acceptance at signup
- Full profile editing (name, role, skills, bio, current project, avatar)
- Collaboration posts — title, description, looking-for tags, location, compensation, up to 5 images; edit/delete your own
- Swipe feed with search filtering; respects two-way blocks
- Mutual matching (both users must right-swipe)
- Realtime chat per match with server-side unread tracking synced across devices
- Block & report for users, posts, and messages (Apple UGC-compliance requirement)
- In-app account deletion with cascading data wipe (Apple 5.1.1(v) compliance)
- Events — host or RSVP to photo walks, open calls, gallery openings, workshops, meetups, exhibitions; filterable by city (this is the Phase 1 strategic bet — see Strategy §4)
- Portfolio gallery — up to 9 images per profile, shown as a strip on swipe cards (web) and full profile grid
- Static Privacy Policy and Terms of Service pages
- Row-level security enforced on every table (no server-side business logic bypasses it)

**iOS-only:** native swipe gestures (Reanimated + Gesture Handler), push
notifications for matches/messages via a Supabase Edge Function, native tab
bar, onboarding carousel.

**Not yet built** (see [`docs/ROADMAP.md`](./ROADMAP.md) for sequencing):
vibe-tag aesthetic matching, two-sided reviews, travel mode, Shoot Diary
(content/social-proof loop), any monetization (subscriptions, sponsored
events, payments) — all deliberately deferred per the "what we are not
building" list in Strategy §10, to stay focused pre-PMF.

**This session's engineering work** (2026-07-12, verified by live browser
automation, an iOS Simulator build, and direct Supabase queries — not just
code review): found and fixed 5 real production bugs — a dropped Events tab
on web, a broken `explore_posts` RPC caused by a Postgres return-type
mismatch, a recursive RLS policy on `collab_reviews` that made reviews
unreadable, Realtime replication that was never actually enabled for chat
despite the code assuming it was, and a silent photo-upload failure on iOS
caused by `fetch().blob()` being unreliable under React Native's New
Architecture. All five were invisible from reading the code alone — each
required actually running the app. Detail and root-cause fixes are in
[`docs/AGENT_MISSION.md`](./AGENT_MISSION.md) and the corresponding commits.

---

## 4. Architecture summary

| Layer | Web | iOS |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19 | Expo / React Native, Expo Router |
| Language | TypeScript throughout | TypeScript throughout |
| Auth, DB, Storage, Realtime | Supabase | Supabase (same project) |
| Hosting | Vercel | EAS Build → App Store |

**One backend, two clients, no duplicated business logic.** Both the Next.js
web app and the Expo iOS app talk directly to the same Supabase project —
same accounts, same posts, same matches, same database. A user who signs up
on iOS can sign in on web and vice versa. There is no separate application
server: clients hit Supabase's REST/Realtime/Storage APIs directly, and
Postgres Row-Level Security is the actual authorization boundary (the client
only ever holds the public anon key; a service-role key exists only for
one-off ops scripts run outside the app).

**Why Supabase, and why this is cheap to run pre-scale:**
- Postgres + Auth + Storage + Realtime + Edge Functions in one managed
  product means no separate auth service, no separate object store, no
  separate WebSocket infrastructure to operate — one vendor, one bill,
  one thing to monitor once monitoring exists.
- RLS pushes authorization into the database itself, so both clients get
  identical security guarantees for free instead of re-implementing access
  control in two codebases.
- A single Postgres Edge Function (`send-push`) — not a standalone
  always-on server — handles the one bit of server-side logic needed
  (push notification fan-out on new messages/matches). No app server to
  provision, scale, or patch.
- At current pre-launch scale this runs on Supabase's **Free tier** (see
  Current Stage below) — i.e., the infrastructure cost today is $0, and the
  first real infra spend the business will need to make is upgrading that
  one plan, not standing up new systems.

Full system diagram, data model, ranking algorithm, and RPC inventory in
[`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 5. Current stage — honestly stated

This is **pre-launch**. The numbers below are the actual row counts in the
production database as of 2026-07-12, verified directly:

| Table | Count |
|---|---|
| Profiles | 4 |
| Collab posts | 5 |
| Matches | 1 |
| Messages | 1 |
| Events | 0 |

This is internal dev/test data from building and QA-ing the product, **not**
real users or real traction. There is no user base to report yet, and this
document makes no claims otherwise.

**App Store status:** an App Store Connect app record exists (`ascAppId
6774481477`), the EAS project is configured, and two production-profile iOS
builds have completed (build numbers 2 and 3; `app.json` is currently
configured for build 5, i.e. the next build to ship). Verified directly this session: an unauthenticated Apple App Store lookup
for this app ID (`itunes.apple.com/lookup?id=6774481477`) returns zero
results, i.e. no live or publicly-listed app exists under that ID — consistent
with the app **not yet having been submitted for App Store review** (or, at
minimum, not yet approved). This environment has no App Store Connect API
credentials and this EAS CLI version has no submission-history command, so
Apple's actual review-queue status couldn't be queried directly — the App
Store lookup above is the strongest signal obtainable without those
credentials, and the founder should confirm directly in App Store Connect
before treating this as certain.

**Known pre-launch blockers, not yet resolved:**
- **Supabase org is on the Free plan** — auto-pauses the database after a
  period of inactivity and caps storage at 500MB. This is a real blocker for
  any real launch and requires a business decision (upgrade + payment)
  before real users show up.
- **No CI, no automated tests, no error monitoring** (e.g. Sentry) anywhere
  in the repo. Every bug found and fixed this session was caught by a human
  or agent manually driving the app end-to-end — not by any tooling. This is
  an honest gap, not yet addressed.

---

## 6. Business inputs needed

Everything below is a placeholder. These are business/financial decisions
for the founder to fill in — this document does not estimate, project, or
invent any of them.

- **Ask amount:** `TODO(founder): fill in target raise amount`
- **Use of funds:** `TODO(founder): breakdown of what the raise funds (e.g. infra upgrade, first hires, city-launch marketing per Strategy §9)`
- **Valuation:** `TODO(founder): pre-money / post-money target`
- **Cap table:** `TODO(founder): current ownership breakdown, option pool sizing`
- **Team bios:** `TODO(founder): founder(s) + any early team background`
- **Go-to-market plan:** `TODO(founder): concrete launch city, launch date, and the "hand-curate first 20 events, personally DM 100 photographers + 100 models" plan referenced in Strategy §9 — needs dates and owners`
- **Financial projections:** `TODO(founder): revenue model activation timeline against the Phase 3 monetization plan in ROADMAP.md (Pro subscriptions, sponsored events, take-rate on paid bookings) — no numbers exist yet since Phase 3 hasn't shipped`
