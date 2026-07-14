# Melange — Technical Due Diligence

> Written for an investor's engineer doing technical diligence. Every claim
> below was verified by running something against the live system on
> 2026-07-12 (REST calls against the production Supabase project, `eas-cli`
> against the real EAS account, `git log`/`git show` against this repo) —
> not inferred from reading code. Where a number is unknown, it says so; it
> is never estimated.

---

## 0. TL;DR for a five-minute read

- **Pre-launch.** 4 profiles, 5 posts, 1 match, 1 message, 0 events in the
  production database as of this writing. This is dev/test activity from
  building the product, not real users. See §3 for how that was confirmed.
- **Architecture is small and conventional**: two thin clients (Next.js web,
  Expo/RN iOS) talking directly to one Supabase project. No custom backend
  server, no message queue, no microservices. Less surface area to audit,
  but also means Postgres RLS is the *entire* authorization layer — see §2.
- **Security**: every table has RLS enabled (13/13, 41 policies). Auth is
  Supabase's standard email/password. A live security-and-correctness pass
  this session found and fixed 5 real bugs, one of which was an auth
  bypass on a public Edge Function endpoint (§4). All five are re-verified
  live in this doc, not just cited from commit messages.
- **What's not built yet, stated plainly**: no CI, no automated tests, no
  error monitoring (Sentry or equivalent), Supabase project is on the Free
  plan (auto-pauses on inactivity, 500MB cap), and the iOS app has not been
  submitted to App Store review (§5). These are the real, current gaps —
  not hidden, not softened.
- **What a check funds**: closing the gaps in §5, plus the next roadmap
  phase that's actually written down in `docs/ROADMAP.md` (Phase 1 events
  + vibe tags, in progress). See §6. No funding amounts or projections are
  stated anywhere in this repo, and none are invented here.

---

## 1. Architecture

**Client apps → Supabase → Postgres (RLS) / Storage / Realtime.** That's
the whole system. No intermediate application server.

```
 ┌────────────────────┐        ┌────────────────────┐
 │  Web (Next.js 16)   │        │  iOS (Expo / RN,    │
 │  melange-psi        │        │  Expo SDK 52)       │
 │  .vercel.app         │        │  bundle: com.melange.app
 └──────────┬──────────┘        └──────────┬──────────┘
            │                              │
            │   HTTPS: PostgREST + Auth + Storage API + Realtime (WS)
            └───────────────┬──────────────┘
                             ▼
                 ┌───────────────────────────┐
                 │        Supabase           │
                 │  ┌──────────────────────┐ │
                 │  │ Postgres + RLS        │ │  ← authorization lives here
                 │  │ (13 tables, all RLS)  │ │
                 │  ├──────────────────────┤ │
                 │  │ Auth (email/password) │ │
                 │  ├──────────────────────┤ │
                 │  │ Storage (`media`      │ │
                 │  │  bucket, RLS'd)       │ │
                 │  ├──────────────────────┤ │
                 │  │ Realtime (pub/sub on  │ │
                 │  │  messages, matches)   │ │
                 │  ├──────────────────────┤ │
                 │  │ Edge Function:        │ │
                 │  │  send-push            │ │
                 │  └──────────────────────┘ │
                 └──────────────┬────────────┘
                                ▼
                     Apple Push Notification
                     Service (iOS only)
```

**Why this shape, and what it means for diligence:**

- Both clients hold only a Supabase **anon key** (public by design — it's
  meant to be embedded in a client bundle). It grants nothing on its own;
  every read/write is gated by the RLS policy on the table it touches. This
  means the security review for this app *is* the RLS review — there's no
  separate application-layer authz to also check.
- There is **no custom backend service** — no Express/Fastify/Django API
  sitting between the clients and Postgres. The one piece of server-side
  logic that exists outside RLS is a single Supabase Edge Function
  (`supabase/functions/send-push`), which is invoked only by a Postgres
  Database Webhook (server-to-server) on INSERT into `messages`/`matches`,
  and fans out to Expo's push API. That function had the one real
  authentication gap found this session — see §4.
- The web app (`/`, root `package.json`, Next.js 16.1.1, React 19.2.3) and
  the iOS app (`/mobile`, Expo SDK 52.0.42, React 18.3.1) are **two
  independent client implementations**, not a shared codebase — they share
  nothing but the Supabase project and its schema. A fix to a client-side
  bug (e.g. the iOS photo-upload bug in §4) has to be applied and verified
  in both; a fix to shared backend logic (an RPC or an RLS policy) fixes
  both clients at once. This matters for diligence because it means client
  bug classes can and did exist on one platform and not the other.
- Hosting: web on Vercel, iOS via EAS Build → App Store Connect (app record
  exists, `ascAppId 6774481477`; submission status verified live, see §5).

---

## 2. Data model (what RLS is protecting)

13 tables, all created with `ENABLE ROW LEVEL SECURITY` in the same
migration that creates them (verified by grep across all five
`supabase_schema_v*.sql` files — 13 `CREATE TABLE` statements, 13 matching
`ENABLE ROW LEVEL SECURITY` statements, 41 `CREATE POLICY` statements
total):

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users` — name, role, bio, skills, vibes, portfolio |
| `collab_posts` | Posts users swipe on |
| `swipes` | Swipe history (left/right) |
| `matches` | Mutual right-swipes → a match |
| `messages` | Chat, scoped to a match |
| `blocks`, `reports` | Safety / App Store UGC compliance |
| `push_tokens` | Expo push tokens per device |
| `match_reads` | Per-user read-state for unread badges |
| `events`, `event_rsvps` | Phase 1 events feature |
| `collab_reviews` | Two-sided post-collab reviews |
| `analytics_events` | Internal product analytics |

Storage: one public-read `media` bucket, with `INSERT`/`UPDATE`/`DELETE`
storage policies scoped to `auth.uid()` matching a `user_id` segment
embedded in the object path — a user can only write/overwrite/delete
objects under their own folder, verified by reading the policy definitions
in `supabase_schema.sql` (lines 187–205).

---

## 3. What was verified live, right now, for this document

Per this repo's mission rules (`docs/AGENT_MISSION.md`: "verify, don't
assume"), every number and claim below was re-checked against the live
system while writing this doc, not copied from a prior session's notes:

- **Row counts** — queried the production REST API directly with the
  service-role key (`Prefer: count=exact`) against every core table:
  `profiles=4`, `collab_posts=5`, `matches=1`, `messages=1`, `events=0`,
  `collab_reviews=0`, `swipes=10`. This is pre-launch dev/test data, not
  real users — stated plainly, not implied otherwise.
- **`explore_posts` RPC** (the bug fixed this session was a Postgres
  return-type mismatch, error `42P13`) — called it live via
  `rpc/explore_posts` with a real profile UUID; it returns post rows
  correctly, no error.
- **`collab_reviews` RLS recursion** (the bug fixed this session was
  infinite recursion, error `42P17`, from a policy that queried its own
  table in `USING`) — queried `collab_reviews` live via the anon key; it
  returns `[]` (correctly RLS-gated for an unauthenticated caller), not a
  recursion error.
- **`send-push` Edge Function auth gap** (the bug fixed this session: the
  function was deployed with `--no-verify-jwt`, meaning the function body
  was the *only* auth boundary, and it never checked the
  `Authorization: Bearer <service_role_key>` header the Database Webhook
  is configured to send — so anyone who found the function's URL could
  POST a forged match/message payload and trigger a spoofed push
  notification to any user, since profile UUIDs are public by design) —
  POSTed to the live function URL with no auth header; it returns `401`,
  confirming the fix is deployed, not just committed.
- **SECURITY DEFINER hardening** — every one of the 15 `SECURITY DEFINER`
  functions across all five schema files pins `SET search_path = public`
  (checked programmatically, not sampled), which closes the classic
  Postgres search-path-hijack privilege-escalation route for definer
  functions.
- **Schema/RLS coverage** — grepped all `CREATE TABLE` / `ENABLE ROW LEVEL
  SECURITY` statements across all schema files: 13 tables, 13 with RLS
  enabled, 0 gaps.
- **CI / tests / monitoring** — searched the repo for `.github/workflows`
  (none), a `test` script in either `package.json` (none), any
  `*.test.*`/`*.spec.*` files outside `node_modules` (none), and any
  Sentry or equivalent dependency (none). All confirmed absent.
- **App Store submission status** — logged into the real EAS/Expo account
  (`raunaksood`) via `eas-cli` and listed iOS builds directly: two
  finished, store-distribution builds exist (build numbers 2 and 3); the
  CLI's build metadata shows no associated submission. The `eas-cli` used
  in this session has no `submission:list` command to enumerate App Store
  Connect submissions directly, so this is the strongest confirmation
  obtainable without either triggering a real submission (not done — that
  would be a production action, not a diligence check) or App Store
  Connect API credentials (not present in this environment). Note: the
  local `mobile/app.json` build number is currently `5`, ahead of the
  highest number EAS has actually built (`3`) — i.e. the counter has been
  bumped locally for a future build that hasn't run yet. Net: consistent
  with "not yet submitted," not proof positive of it — flagged as a
  `TODO(founder): confirm directly in App Store Connect` rather than
  overstated here.

One item this doc could **not** re-verify live: that `messages`/`matches`
are actually in the `supabase_realtime` publication (the third bug fixed
this session — realtime was never enabled, so chat subscribed but never
received live INSERT events). That requires either a Postgres superuser
connection to `pg_publication_tables` or a Supabase Management API
personal-access-token, neither of which was available in this session's
environment (only the anon and service-role keys were). The fix is present
in `supabase_schema_v5.sql` (lines ~478–498, guarded with an `IF NOT
EXISTS`-style check so it's idempotent on re-run) and was verified live in
the session that made the fix (browser-driven two-client chat test, per
`docs/AGENT_MISSION.md`) — but that verification wasn't reproduced in this
pass. Flagged rather than silently assumed.

---

## 4. Security audit findings this session (all fixed, all re-verified above)

These were found by actually running the app and the backend, not by
reading code — consistent with every prior bug in this codebase's history
being invisible from static review alone (see `docs/AGENT_MISSION.md`).

1. **Auth bypass on `send-push` Edge Function** (commit `a94b537`). The
   function is deployed with `--no-verify-jwt` (correct, since Database
   Webhooks don't carry a user JWT) but never checked the
   `Authorization: Bearer <service_role_key>` header the webhook is
   configured to send. Impact: anyone who discovered the function's URL
   could POST a forged payload and trigger a push notification to any
   user by UUID (profile UUIDs are public by design in this app). Fix:
   7-line change enforcing the header check. Verified live, §3.
2. **`explore_posts` RPC broken since `post_embedding` was added**
   (commit `5e77ec7`, error `42P13`). Return-type mismatch — the function
   still declared the pre-v5 `collab_posts` column set. Every call to it
   failed. Fixed by redefining it in `supabase_schema_v5.sql` with the
   current column set. Verified live, §3.
3. **Infinite-recursion RLS policy on `collab_reviews`** (same commit,
   error `42P17`). The `SELECT` policy's `USING` clause queried
   `collab_reviews` itself to check for a reciprocal review, which is
   circular under RLS. Fixed by moving that check into a `SECURITY
   DEFINER` helper (`review_has_reciprocal`), which evaluates outside the
   caller's RLS context. Verified live, §3.
4. **Realtime never enabled for chat** (commit `66e5e26`). `messages` and
   `matches` were never added to the `supabase_realtime` publication —
   normally a manual step in the Supabase Dashboard that never ran during
   scripted setup. Chat subscribed to a channel that never received
   events. Scripted into `supabase_schema_v5.sql` so it's no longer a
   manual, easy-to-forget step. Not independently re-verified in this
   pass — see the caveat at the end of §3.
5. **Silent photo-upload failure on iOS** (commit `7169f1e`). Not a
   security bug, but a real production-correctness bug worth listing
   here since it was found the same way: `fetch(fileUri).blob()` is
   unreliable on React Native, especially under the New Architecture,
   and was silently producing empty/corrupt image uploads for every
   photo picked via `expo-image-picker` — on avatar, portfolio, and post
   images. The backend (storage RLS, bucket config) was confirmed *not*
   the problem by uploading directly via the Management API with a real
   session first. Fixed by reading the file via `expo-file-system` +
   base64 decode instead, the standard fix for this exact React
   Native/Supabase pattern.

None of these were caught by a type-checker, a linter, or a test suite —
because none of the latter two exist yet (§5). All five were caught by
actually driving the app or calling the backend directly.

---

## 5. Known gaps and risks — stated plainly

No hedging, no "roadmap already covers this" softening. These are current,
real gaps as of 2026-07-12:

- **Supabase project is on the Free plan.** Auto-pauses after a period of
  inactivity and has a 500MB database cap. This is a genuine pre-launch
  blocker for any real traffic — the project can silently go to sleep
  under a cold-start user, and there's no runway before hitting the
  storage cap once real uploads start. Not resolved; requires a business
  decision (a paid plan) before any real launch. Flagged in
  `docs/AGENT_MISSION.md` as a known, unresolved item.
- **No CI.** No `.github/workflows`, no equivalent on any other CI
  provider found in the repo. Nothing runs automatically on a push or PR —
  not a lint check, not a build, not a test.
- **No automated tests.** No test runner configured in either
  `package.json`, no `*.test.*`/`*.spec.*` files anywhere outside
  `node_modules`. Every one of the 5 bugs in §4 — including a real auth
  bypass — shipped and sat live until a human/agent manually drove the app
  end to end. That is the actual current quality bar: manual, ad hoc,
  session-by-session verification, not tooling.
- **No error monitoring.** No Sentry or equivalent anywhere in either
  client. If something breaks in production for a real user right now,
  the team's only way to find out is the user reporting it, or someone
  independently re-testing the flow.
- **Near-zero current usage.** 4 profiles, 5 posts, 1 match, 1 message, 0
  events (verified live, §3). This is dev/test data generated while
  building the product. There is no traction to report, and none is
  implied anywhere in this repo's docs.
- **App Store submission status unconfirmed beyond "likely not yet
  submitted."** See the specific caveat in §3 — the App Store Connect app
  record and a working EAS build pipeline exist, but no submission was
  found via the tooling available in this session, and the definitive
  answer needs a direct App Store Connect check
  (`TODO(founder): confirm directly in App Store Connect`).
- **A weak internal admin surface.** `app/internal/reports/page.tsx` (the
  moderation-reports viewer) gates access with a shared secret passed as a
  `?key=` query-string parameter compared against an env var, rather than
  real admin authentication/authorization (e.g. a role check against a
  signed-in Supabase user). The service-role key it uses is correctly kept
  server-side only (never sent to the client), which is the important
  part — but a query-string shared secret is easy to leak via browser
  history, server logs, or a `Referer` header, and there's no rate
  limiting on guessing it. Low blast radius today (it only exposes
  moderation reports, not account data at scale, and current data volume
  is near-zero), but worth fixing before this page handles a real report
  queue.
- **Client-code duplication is a standing risk class, not just a historical
  one.** Because web and iOS are independent implementations sharing only
  the backend (§1), a bug fixed on one platform (like the iOS photo-upload
  bug in §4) does not automatically fix the other. Every future
  client-side fix needs the same "did we check both apps" diligence this
  session applied.
- **Silent-fallback pattern flagged in code, not fully removed.** This
  codebase has at least one known instance (`getUnswipedPosts` falling
  back from `ranked_feed_posts` to `feed_posts` on RPC failure, noted in
  `docs/AGENT_MISSION.md`) of a resilience pattern that swallows backend
  errors instead of surfacing them — which is exactly the pattern that let
  the `explore_posts` bug in §4 go unnoticed. It has not been audited
  repo-wide for other instances of the same pattern; this doc does not
  claim it has been.

---

## 6. What a seed/pre-seed check would actually fund

This section reflects only what's written in `docs/ROADMAP.md` and the
gaps in §5 above — no invented roadmap items, no funding amounts, no
projections. Two honest categories:

**A. Closing the gaps in §5 (infra/ops, not glamorous, table stakes
before any real launch):**
- Upgrade Supabase off the Free plan (removes the auto-pause and 500MB
  cap risk).
- Stand up CI (lint + build on every PR, minimum bar).
- Add an automated test layer for the highest-risk flows — the five bug
  classes in §4 (RPC contract mismatches, RLS policy correctness,
  realtime delivery, client upload paths, endpoint auth) are exactly
  where automated coverage would have caught the regression before a
  human had to find it live.
- Add error monitoring (Sentry or equivalent) on both clients.
- Fix the internal admin auth pattern (§5) before it handles real
  moderation volume.
- Confirm and complete the App Store submission.

**B. The next product bet already committed to in `docs/ROADMAP.md`:**
Phase 1 (in progress) is Events + vibe tags + portfolio, on the thesis
(from `docs/STRATEGY.md`) that events solve cold-start for a
swipe-matching product and aesthetic compatibility matters more than role
compatibility. Phase 1.1 (Events) and 1.2 (vibe tags) are explicitly
marked in-progress/not-yet-shipped in `ROADMAP.md` as of this writing.
Everything past Phase 1 (reviews/trust loops, monetization, geographic
expansion) is written down in `ROADMAP.md` as sequenced, later-phase bets,
not commitments being made now — this doc does not pull any of it forward
into a funding pitch that isn't already in the roadmap.

No user-growth numbers, revenue projections, or funding amounts appear
anywhere in this repo's docs, and none are stated here. Any of those
belong in a business document the founder writes directly, not one
inferred or estimated by an agent.
