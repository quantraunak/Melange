# Melange — Product Strategy

> The thesis, the customer, the problem, and the bets we are making.

Last updated: 2026-05-22

---

## 1. The one-line pitch

**Melange is where creative people find their next collaboration.**
A photographer finds a model. A model finds a stylist. A director finds a DP.
Discovery happens through **events you can actually show up to**, **portfolios that show taste**, and **a swipe layer for asynchronous matching**.

We are not a dating app. We are not LinkedIn. We are not Behance.
We are the place where creative work *starts*.

---

## 2. Who is the customer?

We are building for the **early-to-mid-career independent creative** in a major city. Three concrete personas:

### Maya, 24, model in Brooklyn
- 8k Instagram followers, no agency
- Books ~1 paid shoot/month, wants 3–4
- Trades TFP for portfolio variety
- Pain: finds photographers via DM cold outreach; 90% of messages are creeps or ghosts
- Wants: vetted creative collaborators who match her aesthetic

### Jordan, 27, portrait photographer in LA
- Works full-time at a tech company, shoots evenings/weekends
- Has a portfolio on his Squarespace site, doesn't know how to "network"
- Pain: needs models for personal projects, doesn't want to slide into IG DMs
- Wants: low-friction way to find subjects who share his visual taste

### Sam, 31, indie filmmaker in Austin
- Working on a short film, needs DP, sound, gaffer, two actors
- Pain: every project requires assembling a team from scratch
- Wants: a place to post a project brief and see relevant creatives come to him

These three are the **wedge**. We solve their problem before we expand to musicians, illustrators, dancers, or stylists.

---

## 3. What problem are we actually solving?

The matching market for creative collaboration is **structurally thin**:

| Problem | Why existing tools fail |
|---|---|
| **Role complementarity** — a photographer needs a model, not another photographer | Instagram, Behance optimize for follower-fan dynamics, not collaboration |
| **Aesthetic fit** — a moody portrait shooter doesn't want bright commercial work | Job boards treat "photographer" as fungible; the taste-match is what matters |
| **Geographic + temporal overlap** — both parties need to be in the same city this weekend | Static profiles don't surface who's available *now* or *passing through* |
| **Trust** — meeting strangers for a shoot is high-stakes, especially for models | Generic platforms have no creative-specific reputation system |
| **Cold start** — "I don't even know how to ask" is the #1 reason collabs don't happen | No structured prompt to introduce yourself to a stranger about a specific project |

The market has Instagram on one end (no structured collab signal) and LinkedIn on the other (no creative taste signal). The middle — where most collaborations actually happen — is currently held together with DMs, group chats, and luck.

---

## 4. The unique insight

> **Creative collaboration is a low-frequency, high-stakes match — so you have to make the market thicker before you can ask people to match in it.**

A user collaborates 2–6 times per year, not 2–6 times per week. If we only offered swipe-based matching, the market is too thin for the algorithm to ever feel magical. The user opens the app, sees five posts, swipes through them, and leaves. Retention dies.

The fix is to **bundle low-frequency matching with high-frequency activity**. Specifically, three layers stacked together:

1. **EVENTS** — photo walks, open calls, gallery openings, golden-hour meetups. *Real-world activity that creates organic match supply and lets people meet in low-risk group settings before committing to a 1:1 shoot.*
2. **AESTHETIC SIGNAL** — vibe tags, portfolio galleries, mood references. *So matching is about taste compatibility, not just role.*
3. **MATCHING** — the current swipe + chat layer, but now informed by events attended together and aesthetic fingerprints.

No competitor stacks all three. This is our wedge.

---

## 5. Positioning

Where we sit, explicitly:

```
                       transactional
                            │
                  Upwork    │   Mandy.com
                            │
   broad market ────────────┼──────────── creative-specific
                            │
                  Tinder    │   ✦ Melange
                  Bumble    │   (Events + Aesthetic + Matching)
                            │
                       relational
```

We are **relational + creative-specific**. The two competitors closest to us are:

- **Instagram**: relational, broad. Built for fans, not collaborators. Search is terrible. No structured intent ("I want to shoot you") signal.
- **Mandy.com / StarNow**: transactional, creative-specific. Job-board energy. Feels like Craigslist. Aesthetic match is absent.

Both leave the relational + creative-specific quadrant open. That's us.

---

## 6. The moat (what makes this hard to copy)

A single-player feature can be cloned in two weeks. A market cannot. Our moat compounds through three loops:

### 6.1 Local liquidity loop
Events generate localized density. The 50 photographers and models who attend a Brooklyn photo walk in June all create accounts to RSVP. That density makes the swipe feed valuable for *them* (everyone's local!), which makes matching work, which generates collabs, which generates content, which markets the next event.

### 6.2 Content / social proof loop
After a successful collab, both parties want to share the work. We give them a "Shoot Diary" surface that publicly credits both creators and links back to their profiles. Each shared piece is an organic ad for Melange. (Future, Phase 2.)

### 6.3 Reputation loop
Two-sided reviews after every collab become the real moat. Once a model has 12 collab reviews on Melange, she will never trust a competitor's blank profile again. (Future, Phase 3.)

Single-player features (Tinder-style swipes) have **no moat**. Marketplaces with reputation and local density do.

---

## 7. Why now?

- **Creator economy boom** — more independent creatives than ever before, but the matching tools haven't caught up.
- **Instagram fatigue** — IG DMs are an inbox of cold outreach noise; users are looking for structured alternatives.
- **AI-driven aesthetic matching is finally feasible** — vector embeddings of images make "find me people whose work feels like this" a tractable feature today, not a 5-year R&D effort.
- **Hyperlocal social is having a moment** — Partiful, Lu.ma, Posh prove there's appetite for event-first social.

---

## 8. North star metric

> **Number of completed collaborations per week.**

Not signups. Not matches. Not messages sent. A **completed collaboration** — defined as a match where at least one party uploads a portfolio piece tagged with their match partner. This is the only number that proves we are solving the actual problem.

Leading indicators (we will measure all of these in Phase 2):
- Match → first message rate (target: 60%+)
- First message → planned meeting rate (target: 25%+)
- Event RSVP → event attendance rate (target: 70%+)
- Event attendance → cross-match within 7 days (target: 30%+)

Vanity metrics we will explicitly not optimize for:
- DAU
- Time-in-app
- Total swipes

---

## 9. Growth strategy

**Year 1: one city, deep.** New York or Los Angeles. We hand-curate the first 20 events. We DM 100 photographers and 100 models personally to seed the community. We do not advertise. We get to 5,000 active users in one city before we open a second.

**Year 2: 5 cities.** Each new city gets a hand-curated event in week 1 and seeded by a local "city lead" we recruit (a well-known creative who gets equity for ambassador work).

**Year 3: nationwide + international.** Once the playbook is proven, we scale via city leads + paid IG/TikTok creator ads.

The most expensive growth mistake we can make is **going broad too early**. Density per city is everything. A user in Boise with no events nearby is a churned user.

---

## 10. What we are NOT building (saying no)

To stay focused, we will *not* build any of the following until we hit clear PMF signals:

- ❌ Payments / Stripe escrow (until we hear "I need to pay through the app" from 20+ users)
- ❌ AI-generated mood boards (cool, but premature)
- ❌ Video calls / in-app shoots (we want to drive *in-person* collabs, not replace them)
- ❌ Job board for paid commercial work (different customer, dilutes brand)
- ❌ Group chats with 5+ people (chat scope creep)
- ❌ Stories / 24-hour content (we are not Instagram)

If any of these turns out to be the wedge, we'll know because users will scream for it. Until then, no.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Cold-start: empty events feed in your city | Hand-curate first 20 events per city before public launch |
| Safety incidents at events | Verified accounts, in-app block/report, IRL hosts vetted |
| Two-sided market — chicken and egg | Lead with photographers (one-sided supply), they bring models |
| User confuses Melange with a dating app | Strong visual branding around creative work, not selfies |
| Apple ATT / privacy regulations | Ship with minimal tracking, no third-party SDKs in Phase 1 |

---

## 12. What we believe that the world doesn't

1. **Aesthetic compatibility is more important than role compatibility.** Two photographers with the same vision will collaborate; a "perfect role match" with no taste overlap will not.
2. **Events are the unlock, not the matching algorithm.** Get bodies in a room first, swipes second.
3. **Creative work is local.** A "global" app with no city density is dead on arrival.
4. **The 9-grid is the resume.** A working portfolio gallery beats any written bio.
5. **Friction is a feature.** A signup that takes 90 seconds with a portfolio prompt will produce 10x better users than a 10-second one.

If we're right about these four, Melange becomes the default starting point for creative collaboration in the cities we serve. If we're wrong about any one, we adjust and ship the new bet within a month.

---

## 13. Decision log

- **2026-05-22** — Chose Expo/React Native for native iOS over Capacitor wrap. Reason: real native gestures, push notifications, app-quality feel.
- **2026-05-22** — Web + iOS parity rather than mobile-only. Reason: web is the free distribution channel before Apple membership is set up.
- **2026-05-22** — Events feature chosen as Phase 1 differentiator over reviews / portfolios / verification. Reason: events solve the cold-start problem and unlock the local liquidity loop, which everything else depends on.
