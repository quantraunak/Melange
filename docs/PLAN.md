# Melange — Operating Plan

> Written 2026-10-06. Supersedes the beachhead sections of STRATEGY.md and ROADMAP.md
> where they disagree. Everything else in those docs still applies.

## 1. The honest starting point

Nine accounts, one real stranger, one match (STATUS.md). The product works. Nobody uses it.
Nothing about the UI, the ranker or the events tab changes that until there are real people
in one place who need each other this week. So the plan is ordered: users first, design
system in parallel, marketing at volume only once there is a story.

## 2. The wedge, sharpened

STRATEGY.md's wedge is "creative people in a major city": photographers, models,
filmmakers. That is three two-sided markets at once, spread over a metro. Too thin to
start, which is what the numbers say.

**Sharpened wedge: crew calls for student and indie film.** A producer or director posts
a shoot (title, roles needed, dates, location, pay or TFP). Actors and crew who want the
credit swipe on it. Both say yes, a chat opens. The existing data model already is this:
`collab_posts` has `looking_for`, `location`, `compensation`, media. We rename and
re-skin, we do not rebuild.

Why film rather than photo/model first:

- **Frequency.** A film student runs 3 to 8 productions a year and each one needs 5 to 20
  people. A model books 1 shoot a month. Film has the recurring need STRATEGY.md says the
  marketplace lacks.
- **Density.** A film school is a few hundred people who all need each other, on a
  schedule the school sets. That is a market you can seed by walking around.
- **Incumbents are weak at this tier.** Backstage and Mandy are paid and aimed at
  professionals. Students use Facebook groups, Discord, school boards and Instagram DMs:
  the exact "DM pile" Melange is built to replace. Mutual consent is the feature: an actor
  only talks to productions that picked them too.
- **The asset is the credit.** Every match that becomes a shoot becomes a credit on both
  profiles. Over time a profile is a verified reel of who worked with whom. That is the
  graph a LinkedIn or a Tinder would pay for, and it compounds; swipes do not.

Photographers, models and stylists stay in the product. They become the second scene
once the first one works.

## 3. Beachhead: Chapman, then USC

**Chapman University, Dodge College of Film and Media Arts, Orange, CA.** About 1,500
film and media students, production-heavy curriculum, hundreds of student films a year,
thesis shoots clustered in fall and spring. Raunak has a Chapman affiliation (warm
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
| productions posted (real shoots with dates) | 15 |
| actors/crew signed up | 60 |
| posts with at least one match within 48h | 10 |
| shoots that actually filled a role through Melange | 5 |
| producers who post a second shoot | 3 |

The last row is the PMF signal. If it is 0 at day 30 the wedge is wrong and we switch
to one of the fallbacks in section 7. If it is 3 or more, we go to USC.

How to get there:

1. **Demand first, by hand.** Find the ten most active Dodge producers and directors with
   shoots this semester. Onboard them personally; enter their crew calls for them if they
   let us. Ten real posts with dates is the whole feed on day one.
2. **Supply through the channels they already use.** Post each crew call where actors and
   crew already look (Chapman and OC casting Facebook groups, Dodge Discord, Instagram),
   with the Melange link as the better version: one tap, match, chat, no DM pile.
3. **Close the loop manually.** When a match happens, message both sides and ask if the
   shoot got filled. Record it. That number is the pitch.
4. **Weekly:** a status note in STATUS.md with the real numbers, read live from the database.

## 5. Product changes this implies

In order, each as a PR:

1. Language: "post" becomes "shoot" or "production" in the UI; `looking_for` becomes
   roles with a fixed vocabulary (DP, 1st AC, gaffer, sound, editor, actor, PA, ...);
   add shoot dates. Schema change: nullable `shoot_start`, `shoot_end`, `roles TEXT[]`.
2. Credits: when a match is marked "worked together", both profiles get a credit line
   (title, role, date). Reuse the existing reviews table as the confirmation.
3. Glass design system (in progress on `design/glass-ui`), applied to the shoot card,
   feed, matches, auth and landing.
4. Landing page rewritten for the wedge: "Crew your student film without the DM pile."
5. iOS 1.1 with the above, since actors live on their phones.

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
