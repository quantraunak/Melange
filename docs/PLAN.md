# Melange — Operating Plan

> Written 2026-10-06. Supersedes the beachhead sections of STRATEGY.md and ROADMAP.md
> where they disagree. Everything else in those docs still applies.

## 1. The honest starting point

Nine accounts, one real stranger, one match (STATUS.md). The product works. Nobody uses it.
Nothing about the UI, the ranker or the events tab changes that until there are real people
in one place who need each other this week. So the plan is ordered: users first, design
system in parallel, marketing at volume only once there is a story.

## 2. The product: a fun app for any creative person (decided 2026-10-06)

Raunak's call: Melange stays broad. It is where creative people of any kind find
their next collaboration: photographers, models, stylists, MUAs, filmmakers, actors,
musicians, dancers, designers. It should feel fun to open, not like a job board. The
earlier idea of narrowing the whole product to film crew calls is dropped.

What survives from that idea is the mechanics, because they help every creative:

- A post is a **project** with optional roles wanted, dates and pay type (paid, trade,
  credit). The roles vocabulary is broad, not film-only. Nothing is required beyond a
  title and a photo, so posting stays light.
- **Credits**: when two people worked together, both profiles show it. Over time a
  profile becomes a verified record of who made what with whom, which is the asset an
  acquirer would value.
- **Mutual consent** stays the core: a chat opens only when both people said yes.

"Fun" is a product requirement: swipe motion that feels good, a match moment worth
screenshotting, playful copy, a browse grid that looks like a magazine, events people
actually go to. Light palette, original brand (see docs/DESIGN.md).

## 3. Growth tactic: one dense community first (Chapman, then USC)

This is about where the first users come from, not what the product is. **Chapman
University, Orange, CA**: Dodge film students, plus the art, dance, music and theatre
programs, all within walking distance of each other and all constantly needing
collaborators (films need actors and crew; photographers need models; musicians need
video; dancers need both). Raunak has a Chapman affiliation (warm
contacts) and Orange County is far less saturated with tools and recruiters than LA.
Theatre and acting students at Chapman, Cal State Fullerton and OC community colleges are
the supply side and live within 20 minutes.

**USC School of Cinematic Arts** is the second campus, four weeks later, because Raunak is
physically there and it is three times the size. Doing Chapman first makes USC the test of
whether the playbook repeats. Campus-by-campus is how Tinder and Facebook grew, and a
repeatable campus playbook is the scalable story.

The "artsy areas" (Laguna, Santa Ana arts district, Costa Mesa, DTLA Arts District) come
after: they are where the photo/model scene lives, and that scene is the second wedge.

## 4. The 30-day test (starts when the schema is live)

Target by day 30, all real people, no seeded accounts:

| metric | target |
|---|---|
| projects posted by real people | 20 |
| real sign-ups | 80 |
| posts with at least one match within 48h | 10 |
| collaborations that actually happened through Melange | 5 |
| people who post a second project | 3 |

The last row is the PMF signal. If it is 0 at day 30 the wedge is wrong and we switch
to one of the fallbacks in section 7. If it is 3 or more, we go to USC.

How to get there:

1. **Seed the feed by hand.** Find the twenty most active creatives at Chapman across
   film, photo, music and dance with a project this semester. Onboard them personally;
   post for them if they let us. Twenty real projects is the whole feed on day one.
2. **Reach their counterparts where they already look.** Share each project where
   actors, models, crew and musicians already browse (Chapman and OC Facebook groups,
   Dodge Discord, Instagram), with the Melange link as the fun version: swipe, match,
   chat, no DM pile.
3. **Close the loop manually.** When a match happens, ask both sides if the collab
   happened. Record it. That number is the pitch.
4. **Weekly:** a status note in STATUS.md with the real numbers, read live from the database.

## 5. Product changes this implies

In order, each as a PR:

1. Projects: optional roles (broad vocabulary across photo, film, music, dance, design),
   optional dates and pay type on a post. Schema change: nullable dates, `roles TEXT[]`,
   `pay_type`. UI copy stays "project" and "collab", never film-specific.
2. Credits: when a match is marked "worked together", both profiles get a credit line
   (title, role, date). Reuse the existing reviews table as the confirmation.
3. Craft pass on the original light design: swipe motion, match moment, card and grid
   polish, consistent components. No dark theme (owner's call, 2026-10-06).
4. Landing page: fun, broad, light. "Find your next collaboration" with the swipe demo
   front and centre.
5. iOS 1.1 with the above.

## 6. What runs autonomously and what does not

**Autonomous (weekly cloud routine, plus local loops when Raunak is at the machine):**
one product PR per week from this list, tests and build green, screenshots in the PR,
STATUS.md updated, outreach drafts refreshed in `docs/outreach/`.

**Gated on Raunak, every time:** sending any email or DM to a real person, applying
schema to production, App Store submissions, spending money, and changing the wedge.
The agent prepares; Raunak presses.

## 7. Fallbacks if the 30-day test fails

In order of cheapness to test:

1. **Crew booking as a one-sided tool.** Producers manage their own crew list and call
   sheets; no marketplace, no cold start, charge per production. Learn from who pays.
2. **Casting for small agencies and student theatre.** Sell the posting and matching
   workflow to the office that runs auditions. B2B, fewer users, real money.
3. **Back to photo/model in one dense scene** (DTLA Arts District), with events as the
   bundle STRATEGY.md describes, now that the seeding playbook exists.

## 8. What an acquirer would be buying

Not the app. A dense, verified graph of who has worked with whom on real productions,
starting with the people who become the industry in five years, plus a campus playbook
that repeats. That is worth something to LinkedIn (career graph for a field it does not
cover), to Backstage or Mandy (the tier beneath them), and to a dating company only if the
social layer is real. Which is why every metric above is about real shoots, not accounts.
