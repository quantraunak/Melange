# Melange — Metrics

> What we measure, why we measure it, and what we explicitly ignore.

Last updated: 2026-05-22

---

## North star

> **Weekly completed collaborations.**

A collaboration is *completed* when at least one of the two matched users uploads a portfolio post tagged with the other's profile. Until they do that, the match is a hypothesis, not a result.

We do not optimize for swipes, matches, messages, signups, or DAU directly. We optimize for **the thing the user actually came here to do**.

---

## Funnel we track

```
Signup
   │
   ▼
Profile complete   ─── we want > 80% of signups to finish profile
   │
   ▼
First swipe          ─── 1st-session activation
   │
   ▼
First match          ─── thin-market test (this is where most products die)
   │
   ▼
First message sent   ─── target: ≥ 60% of matches reach this stage
   │
   ▼
First meeting agreed ─── target: ≥ 25% of conversations reach this stage
   │
   ▼
Collaboration completed (north star)
```

Each arrow has a target conversion rate. We measure cohort-wise (signup cohorts by week). When a conversion stage drops below target for 3 consecutive weeks, we open a triage ticket.

---

## Leading indicators

These will tell us if Phase 1 is working before the north star moves:

| Metric | Target | Why it matters |
|---|---|---|
| Events created per week per city | ≥ 4 | Supply side of the events layer |
| Event RSVPs / event view | ≥ 15% | Demand side; tells us cards are doing their job |
| Event RSVP → attendance rate | ≥ 70% | RSVPs are vanity if people don't show |
| Cross-matches within 7 days of attending the same event | ≥ 30% | The local liquidity loop in action |
| Portfolio gallery completion rate | ≥ 60% | Without portfolios, matching is blind |
| Vibe tags set on first post | ≥ 70% | Aesthetic filtering only works if data is there |

---

## Engagement metrics (secondary)

We track these but do not optimize for them. They are diagnostic, not strategic.

- DAU, WAU, MAU
- Sessions per day per user
- Median time-in-app per session
- 7-day, 30-day, 90-day retention
- Push notification open rate
- Match notification → app open rate

Time-in-app intentionally is *not* a target. Healthy product behavior for Melange is "open, scan events + feed, message someone, close." We want users to spend their time *with each other*, not in our app.

---

## Quality & safety metrics

Non-negotiable. If any of these regress, we stop work on new features.

| Metric | Threshold |
|---|---|
| Reports per 1000 active users per week | < 5 |
| Time-to-action on a report | < 24 hours |
| User-initiated blocks per 1000 active users | < 15 |
| Account deletion requests honored within | 24 hours (Apple requirement) |
| P95 web app first-paint time | < 2 seconds |
| API error rate | < 0.5% |

---

## How we instrument

Right now: no analytics. We measure what we can read from the Supabase database directly.

Phase 1 add: Supabase analytics events on the seven funnel stages above. Server-side (not browser), so ad blockers can't disable them.

Phase 2 add: PostHog or Plausible for product analytics. No third-party analytics that track users across sites. Privacy budget is sacred.

Phase 3: Looker / Metabase dashboard for the team. Pulled directly from Supabase Postgres read replica.

---

## Cohort analysis

Every user is bucketed by:
- Signup week
- Signup channel (organic / event / referral)
- Signup city
- Primary role (photographer / model / stylist / other)

We will compare 7-day, 30-day, 90-day completed-collab rates by cohort. If users who signed up at an event have 5x the completion rate of users who signed up cold (which is our hypothesis), that proves the events bet.

---

## Targets for Year 1

By end of month 12:

- 5,000 active users in NYC
- 12 events per month in NYC
- 200 completed collaborations per week (aggregated)
- ≥ 4.5/5 average review score
- < 1% account deletion rate (excluding inactive cleanup)

If we hit these, we open city #2 (LA). If we miss, we triage and adjust before expanding.
