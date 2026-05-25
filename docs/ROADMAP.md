# Melange — Product Roadmap

> Built top-down from the strategy. Every feature must trace back to a north-star-moving bet.

Last updated: 2026-05-22

---

## Phase 0.5 — Brand UI (current)

The product keeps the **classic Melange look**: blue header, purple/indigo logo,
pill tab bar, white card on gray background. Polished for App Store review without
changing that identity.

- [x] Web: classic layout restored (logo + blue/purple palette)
- [x] iOS: matches web brand (`mobile/src/lib/theme.ts`)
- [x] `/support` page for App Store Connect URL requirement
- [x] iOS Events tab + RSVP (host on web for now)
- [x] iOS portfolio gallery on Profile

---

## Phase 0 — MVP (shipped)

The matching layer. Done.

- [x] Email signup with profile (name, role, skills, bio, current project, avatar)
- [x] Collaboration posts (title, description, looking_for, location, compensation, multi-image)
- [x] Swipe feed (left/right)
- [x] Mutual-match → chat room
- [x] Realtime messaging with unread tracking
- [x] Edit / delete your own posts
- [x] Block users (post + chat)
- [x] Report users / posts / messages
- [x] Account deletion (Apple compliance)
- [x] Terms / Privacy / 18+ acceptance
- [x] iOS app (Expo / React Native, parity with web)
- [x] Push notifications via Supabase Edge Function

---

## Phase 1 — Events + Aesthetic + Portfolio (in progress)

The thesis from `STRATEGY.md` says we need three layers to escape "swipe app" gravity. Phase 1 ships all three.

### 1.1 Events (CURRENT — shipping now)

**The bet:** events solve cold-start. Get 50 creatives in a room and the swipe feed instantly becomes worth opening.

- [ ] DB: `events`, `event_rsvps` with categories (photo walk, open call, gallery, meetup, workshop, exhibition)
- [ ] Web: Events tab — list, detail, RSVP, host
- [ ] iOS: Events tab (after web)
- [ ] Event cover image upload
- [ ] Geographic filter (city string match v1; lat/lng + radius v2)
- [ ] "Going" attendee list with avatars (social proof)
- [ ] Push notification 24h before an event you've RSVP'd to
- [ ] Event reminder in app on day-of

Success criteria: 1 event seeded → 10+ RSVPs → 5+ attendees → ≥ 2 cross-matches within a week of the event.

### 1.2 Vibe tags (next, ~3 days)

**The bet:** aesthetic compatibility beats role compatibility. Tag posts and profiles with style descriptors and use them to filter the feed.

- [ ] Curated vibe taxonomy (~24 tags): moody, editorial, street, golden hour, b&w film, neon, candid, fashion, lifestyle, documentary, etc.
- [ ] Multi-select vibe picker on post create / profile edit
- [ ] Feed filter chip row: tap a vibe to filter
- [ ] Match score: boost posts that share vibes with your profile

### 1.3 Portfolio gallery (SHIPPED — web)

**The bet:** the 9-grid is the resume. Profiles should *show*, not tell.

- [x] DB: `portfolio_urls TEXT[]` on profiles (v3 schema)
- [x] Profile edit: 3-column grid with add / remove / move-left / move-right per tile, capped at 9 images
- [x] Profile view: tap any tile for fullscreen lightbox with keyboard ← → navigation and pagination dots
- [x] On a swipe card: "More from {creator}" horizontal portfolio strip below the post body
- [x] In post detail dialog: full 3x3 portfolio grid below the post details
- [ ] iOS parity (next ship)

Why this is the killer move: you're no longer swiping on a single post — you're swiping on the whole person's body of work. That alone changes the math of who you choose to message.

---

## Phase 2 — Trust + Loops (~4 weeks after Phase 1)

Now we make the marketplace re-engage itself.

### 2.1 Two-sided reviews

After a match has been active for 14 days, both parties get a single prompt: "Did you collaborate? Leave a review." Reviews are short-form (1-5 stars + 2 tags + optional text). Both reviews must be submitted before either is visible (avoids retaliation).

### 2.2 Shoot Diary

After a collab, either party can post 1-3 images crediting their match partner. This becomes a public scroll on each profile (and a separate "Diary" feed for inspiration). Each post links to both creators' profiles. This is the **content loop** from `STRATEGY.md §6.2`.

### 2.3 Travel mode

A user sets "I'll be in Paris May 28 – June 3" and appears in the Paris feed for that window. Captures creatives passing through cities — currently invisible to local users.

### 2.4 Instagram verification

OAuth or one-time "post this code on your story" verification. Verified creators get a badge and rank higher in the feed. Solves the impersonation / catfishing problem.

---

## Phase 3 — Reputation + Monetization (~3 months after Phase 2)

We have a working community. Now we capture some of the value.

### 3.1 Pro accounts (subscription, $9.99/mo)

Pro creators get:
- Unlimited swipes per day (free tier capped at 30/day after Phase 3 launch)
- See who liked you before swiping
- Filter feed by aesthetic vibe (free tier sees curated mix)
- Travel mode
- Premium event hosting (unlimited capacity, custom cover image)

### 3.2 Sponsored events (B2B)

Local brands sponsor open calls: "Aesop wants to shoot a campaign — apply by June 10." Brands pay $500-$2000 per event. Melange takes a cut.

### 3.3 In-app payments / TFP contracts

Stripe Connect integration for paid bookings. Both parties sign a one-page usage-rights agreement in-app. Melange takes 8% on paid bookings, free for TFP.

### 3.4 Recommendation engine

CLIP embeddings on portfolio images → "creatives with similar aesthetics to you" carousel on the home tab. This is the AI moat.

---

## Phase 4 — Geographic expansion (~6 months after Phase 3)

Scale to 10 cities. Hire 2 community managers per city. Open the international door (London, Berlin, Paris first).

---

## Out of scope (deliberately not on the roadmap)

These come up regularly in scope creep discussions. We are saying no, for now:

- ❌ Stories / 24-hour content
- ❌ Group chats with > 2 people
- ❌ Video calls
- ❌ Wholesale job board (Mandy.com territory)
- ❌ Music / sound creators (different customer; revisit Year 3)
- ❌ Web3 / NFT integration
- ❌ Push notifications for matches you didn't make
- ❌ AI bio writer
- ❌ Generic "trending" feed

If a user reports any of these as a top-3 unmet need, we revisit. Until then, we focus.

---

## How we will work

1. Every feature commits to a metric it will move.
2. Anything not on this roadmap requires a written justification and an explicit "yes, replace something else" call.
3. Each phase ends with a public retrospective: did we hit the metric? If not, why? Adjust the next phase based on findings, not opinions.
4. We ship in 2-week cycles. If a feature isn't shippable in 2 weeks, it's broken into smaller chunks until it is.
