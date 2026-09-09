# What's missing, measured against the apps people compare us to

Written 2026-09-08, against Tinder, Hinge and Bumble as the bar — not because
Melange is a dating app, but because they define what people expect a
swipe-match-message product to do, and every one of those expectations is one
we inherit whether we like it or not.

Ordered by what it costs us, not by effort. Items marked **done** shipped in
this pass; the rest is the honest remainder.

---

## Sign-in and accounts

| | |
|---|---|
| **Password reset** | **Done.** There wasn't one. Anyone who forgot their password had no route back into their account except emailing support — and support is an address on a web page nobody had opened. On both the app and the website now. |
| **Sign in with Apple** | Missing. The largest single drop-off in this funnel is typing an email and a password on a phone keyboard. Apple only *requires* Sign in with Apple when you already offer other third-party logins, so this is not a review blocker — it's a conversion one. |
| **Email verification** | Not enforced. You can sign up with an address you don't own, which also means the password reset above can't be relied on as proof of identity. |
| **Change password in-app** | Missing. Settings has no security section at all; the only way to change a password is to trigger a reset email. |

## First run

| | |
|---|---|
| **Permission priming** | Missing, and this one is costly. The push permission dialog fires on first tab load with no explanation, which is the worst possible moment to ask — a "no" there is permanent and takes match notifications with it. Same for the photo library prompt. Every app in this category asks for the permission *after* showing why it matters. |
| **Guided first post** | Missing. Signup ends on an empty deck. Someone who never posts is invisible to everyone else, so the first post is the activation event, and nothing currently pushes toward it. |
| **Intro carousel** | Exists — four slides. It uses generic icons rather than real work, which undersells a product whose entire subject is photography. |

## Finding people

| | |
|---|---|
| **Undo a swipe** | **Done.** A mis-swipe used to be permanent — the post never came back. There's now a rewind button, and it refuses on swipes that already became matches rather than silently deleting the other person's match. |
| **The match moment** | **Done.** A match — the best thing that happens in this app — was a green toast that appeared for 2.8 seconds and left you on the deck with no route to the conversation. It's now a full screen with both faces and the message one tap away. |
| **Browse vs. swipe** | **Done.** The Explore tab's "Ideas" list served the same posts as the deck in a thinner layout, which is why it read as the feed shown twice. It's now a filterable grid — pay, location, hide-what-I've-seen — that labels what you've already swiped, so it does the thing a deck can't: let you compare and act out of order. |
| **Distance** | Missing, and this is the biggest structural hole. Tinder is fundamentally a distance product; ours has no coordinates on profiles or posts at all, only a free-text location field. You cannot filter to "people I could actually shoot with this month", which for a product about meeting up to make work is close to the whole point. |
| **Filters on the deck** | Missing. The deck has free-text search and nothing else — no role, pay, or distance filter, which is what the Browse grid now has and the deck still doesn't. |
| **"Who liked you"** | Missing. Seeing that someone liked your post before you swipe is the strongest re-engagement hook in this category, and the basis of every paid tier in it. |
| **Running out of deck** | Missing. Hitting the end of the feed is a dead end with a line of text. With 10 posts in the database, most sessions end there. |

## Messages

| | |
|---|---|
| **The list itself** | **Done.** New matches now sit in a row at the top where they read as an invitation, conversations sort newest-first below with timestamps and unread counts, and there's a search once the list is long enough to need one. |
| **Read receipts** | **Done.** "Seen" on your own last message. Needed a database function — `match_reads` is locked to your own rows by design, so the other person's read time can't be selected directly. |
| **Unmatch** | **Done.** There was no way to leave a match. Blocking was the only exit, which is a heavy answer to a conversation that just went nowhere — and it permanently hid a person who'd done nothing wrong. |
| **Sending photos** | Missing, and for this product that's a strange omission. Two photographers planning a shoot want to send references and moodboards, and right now they have to leave for Instagram DMs to do it — which is precisely the behaviour Melange exists to replace. |
| **Typing indicator** | Missing. Cheap to add on the realtime channel that's already open. |
| **Notification preferences** | Missing. Push is all-or-nothing at the OS level; there's no way to keep match notifications and mute message ones. |

## Profiles

| | |
|---|---|
| **Photo ordering** | Missing. Portfolio images upload in whatever order they were picked and can't be rearranged, so nobody can lead with their best work. |
| **Profile preview** | Missing. No way to see your profile as others see it before you go live with it. |
| **Prompts** | Missing. Free-text bio only, which reliably produces empty bios. |

## Trust and safety

Reporting, blocking, the 18+ gate, in-app deletion and the moderation contact
are all in place — that's the App Store requirement met.

The gap is **verification**. A "Verified" badge currently comes from pasting an
Instagram URL, uploading three photos and collecting two decent reviews. Nobody
checks the Instagram account is yours. For a product where models meet
strangers at a location to be photographed, that badge promises considerably
more than it delivers. Selfie-based photo verification is the standard bar in
this category, and Melange is asking for more trust than Tinder while doing
less to earn it.

## Infrastructure

- **The database is on the free plan and sleeps.** Still the most likely cause
  of an App Store rejection: a reviewer opening a sleeping app sees a broken
  one. This is a billing decision, not a code change. See `STATUS.md`.
- **The website trails the app.** Password reset landed on both, but this pass's
  messages, browse, rewind and match-moment work is iPhone-only. Every feature
  gets built twice, and this is the drift that produces.
