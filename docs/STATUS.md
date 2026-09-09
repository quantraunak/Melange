# Where Melange actually stands

Last checked: 2026-08-05. Every number here was read live from the database, not estimated.

This file replaces the old `DUE_DILIGENCE.md` and `INVESTOR_OVERVIEW.md`, both of which had drifted out of date.

---

## The short version

The product is built and it works. Almost nobody has used it. Those two facts are the whole picture, and the second one is the important one.

---

## Usage

| | Count |
|---|---|
| Accounts | 9 |
| Posts | 10 |
| Swipes | 12 |
| Matches | 1 |
| Messages | 1 |
| Events | 0 |
| Reviews | 0 |
| Reports | 0 |

Of the 9 accounts: 1 is the founder, 1 is an App Store reviewer account, 1 is a demo account, 1 is a real outside person who signed up once in July and never came back, and 5 are fake accounts seeded on 2026-08-04 to make the feed look populated. None of the 5 has ever signed in.

So: **zero real usage.** This is test data from building the thing. There is no traction, and nothing in this repo should be read as implying otherwise.

The events tab, the reviews system, and the reporting system have never been used by anyone. They are built and tested, but unproven in the sense that matters.

---

## What works

Verified by actually using the app, not by reading the code:

- Sign up, sign in, sessions that persist across restarts
- Profile editing, avatars, portfolio galleries
- Creating, editing, and deleting posts with photos
- The swipe feed, including search and block filtering
- Matching, and live chat with unread counts that sync across devices
- Events — create, browse by city, RSVP
- Reviews after a collaboration
- Blocking and reporting
- Deleting your account, which properly wipes your data
- Push notifications for new matches and messages

Both the website and the iPhone app do all of this.

---

## What's weak

Honest list. Nothing here is hidden or softened.

**No tests at all.** 14,000 lines of code, zero automated tests. Every bug found so far was found by a human clicking through the app. Several real bugs — including a security hole in the push notification service — shipped and sat live until someone manually re-tested the flow. That's the actual quality bar right now.

**No error monitoring.** If the app breaks for a real user tomorrow, there is no alert. The only way anyone finds out is if that user complains.

**The database is on the free plan.** It sleeps after a stretch of inactivity and caps out at 500MB. If an App Store reviewer opens the app while it's asleep, they'll see a broken app and reject the submission. This needs a paid plan before launch. It is a business decision, not a code change.

**Two separate codebases.** The website and the iPhone app share a database and nothing else. Every feature has to be built twice, and a bug can exist on one and not the other — which has already happened more than once. At one developer, this permanently halves the pace.

**Verification is self-reported.** A user gets a "Verified" badge for pasting an Instagram URL, uploading 3 portfolio photos, and collecting 2 reviews rated 4 or better. Nobody checks that the Instagram account is actually theirs, and no human is involved. For a product where models are meeting strangers for shoots, that badge promises more than it delivers.

**One big file.** `app/components/MelangeApp.tsx` is 1,652 lines. Fine today, painful later.

---

## Security

The last review found and fixed real problems. Current state:

- Every table in the database has access rules, so users can only read and write their own data
- The push notification service now rejects unauthenticated requests (it previously accepted anything, meaning anyone who found the URL could send a fake notification to any user)
- The moderation page now uses a password form and a secure session cookie, not a key in the URL
- The database's own security scanner reports **no errors**

Open warnings, none urgent:

- 8 database functions don't pin their search path. Most are simple timestamp triggers, but it's a known hardening pattern and worth closing.
- Supabase's leaked-password check is turned off. Turning it on is one toggle in the dashboard and stops people signing up with passwords from known breaches.

---

## App Store: what is actually left

The build pipeline works and the app record exists (`ascAppId 6774481477`, bundle `com.melange.app`, build 8). It has **not been submitted**.

**Blocking:**

1. ~~**Screenshots.**~~ Done on 2026-09-08. Five framed 6.9" (1320x2868) screenshots were captured from the simulator and composited; they live in `mobile/store/screenshots/`.
2. **Upgrade the database off the free plan.** See above — a sleeping database during review means rejection.

**Should do first:**

3. Turn on the leaked-password check.
4. Decide whether the 5 fake seeded accounts stay. A populated feed helps a reviewer understand the app; it also means real early users are swiping on people who don't exist. Recommendation: keep them for review, delete them the day you have real signups.

**Already done:** reporting, blocking, privacy policy, terms, in-app account deletion, 18+ age gate, moderation contact email, reviewer demo account (`review@melange.app`), and screenshots.

**Note on the reviewer account (2026-09-08):** `review@melange.app` had swiped every post, so a reviewer opening the app saw an empty feed. Its swipes were cleared and the test posts ("testing match", "Model", and three others with no images) were deleted. It now opens on a five-post deck and has one real conversation.

**Realistic timeline:** a focused day of work, then 1–3 days in Apple's review queue.

---

## What a check would fund

Nothing yet, and that's the honest answer.

There is no fundraising case here today, because there is no evidence anyone wants this. The gap between "the product is built" and "the product is used" is the entire remaining risk, and it is not a gap that money closes — it's closed by getting the first hundred people to use it and seeing whether they come back.

The open strategic question is bigger than the product: the current design targets unpaid creative collaborations, where no money changes hands, which leaves no transaction to build a business on. The version of this that could be a real company points at paid work — brands and agencies booking creatives, with payments running through the platform. That is a different customer and a different sales motion, and it hasn't been tested.

Test that before writing another line of code.
