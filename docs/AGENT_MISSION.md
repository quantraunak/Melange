# Agent mission — Melange production hardening

> This file exists so any future Claude Code session (or subagent) picks up
> this mission with full context, without re-deriving it from scratch.
> Written 2026-07-12 after a live debugging session that found and fixed
> four real production bugs (see git log around commit `5e77ec7`..`7169f1e`).

## The ask

Get Melange to two states simultaneously:

1. **A genuinely working app**, verified end-to-end (not "looks done"),
   ready to submit to the App Store.
2. **A repo an investor's technical diligence would survive.** Not a pitch
   deck with fake numbers — accurate docs, a clean architecture story, and
   an honest account of what's shipped vs. not.

## Ground rules for any agent working under this mission

- **Verify, don't assume.** Every bug found this session (dropped Events
  tab, broken `explore_posts` RPC, recursive RLS policy, realtime never
  enabled, silent photo upload failure) was invisible from reading code
  alone — each required actually running the app (browser automation,
  a live iOS Simulator build, or a direct Supabase Management API call)
  to catch. "It compiles" and "it typechecks" are necessary, not sufficient.
- **Real data only.** Never fabricate user counts, revenue, traction, or
  financial projections in any document. If a number is needed and isn't
  known, write `TODO(founder): ...` — do not estimate or round up.
- **Small, verifiable diffs.** Prefer fixing the root cause over adding a
  fallback/try-catch that hides it. This codebase already has a pattern of
  silent fallbacks (e.g. `getUnswipedPosts` silently falling back from
  `ranked_feed_posts` to `feed_posts` on RPC failure) that let real bugs
  hide in production for weeks. Don't add more of those; if you must keep
  a fallback for resilience, make the failure loud (log it, surface it)
  instead of silent.
- **Backend changes go through `scripts/apply_migration.mjs` against the
  live Supabase project**, and should also be added to the relevant
  `supabase_schema_v*.sql` file so a fresh install reproduces the fix —
  see how the `explore_posts`/`collab_reviews`/realtime-publication fixes
  were done in `supabase_schema_v5.sql` for the pattern (numbered,
  commented sections explaining *why*, not just *what*).
- **This is a two-app monorepo** (`/app` Next.js web, `/mobile` Expo/RN)
  sharing one Supabase backend. A fix to shared backend logic (RPCs, RLS)
  fixes both clients. A fix to client code (e.g. the photo upload
  `fetch().blob()` bug) needs to be checked in both `app/` and `mobile/`
  independently — they are separate implementations, not shared code.

## Known state as of 2026-07-12

- Supabase org is on the **Free plan** — auto-pauses after inactivity,
  500MB DB cap. This is a real blocker for any real launch, flagged to
  the founder, not yet resolved (requires a business decision + payment).
- No CI, no automated tests, no error monitoring (Sentry etc.) anywhere
  in the repo. Every bug this session was caught by a human/agent manually
  driving the app, not by tooling.
- Real usage is near-zero (single-digit rows in every table) — this is
  pre-launch, not post-launch. Don't let doc-writing agents imply otherwise.
