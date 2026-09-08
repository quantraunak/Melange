# App Review Information — Notes

Reply text for Guideline 2.1 "Information Needed" (received 2026-08-13) and the
source-of-truth for the **App Review Information → Notes** field on every future
submission. Apple explicitly asked that this live in Notes going forward.

> ⚠️ **Section 2 has placeholders you must fill in yourself.** Those are factual
> claims to Apple about hardware you actually tested on. Do not guess.

---

## 1. Screen recording

*(Attach in the Resolution Center reply. Must be captured on a **physical
iPhone**, not the simulator — Apple asks for this explicitly.)*

Shot list, in order. Keep it one continuous take if you can, roughly 3–5 minutes:

1. **Launch from the home screen** — start recording before tapping the icon so
   the splash and intro carousel are visible.
2. **Account registration** — create a brand-new account. Show the 18+ age gate
   and the Terms / Privacy acceptance.
3. **Profile setup** — name, role, skills, bio. Add an avatar, which triggers the
   **photo library permission prompt** — make sure that dialog is on camera.
4. **Portfolio** — add two or three images to the 9-grid.
5. **Create a post** — title, description, looking-for, location, compensation,
   tags, and attach photos.
6. **Swipe feed** — swipe left on one post, right on another.
7. **Match and chat** — open a match, send a message, show it delivering.
8. **Reporting** — open the menu on a post or message and report it. Show the
   full flow through to confirmation.
9. **Blocking** — block a user and show that their content disappears from the
   feed.
10. **Events** — browse the events tab and RSVP to one.
11. **Sign out, then sign back in** with the demo account below.
12. **Account deletion** — Profile → Account & safety → Delete account → type
    DELETE → confirm. Show it completing.

Steps 2, 3, 8, 9 and 12 are the ones Apple named specifically (registration,
login, deletion, UGC, reporting/blocking, permission prompts). Do not skip them.

There are no paid features, purchases or subscriptions to record — the app is
free with no in-app purchases.

---

## 2. Devices and operating systems tested

> **FILL THIS IN.** Replace the bracketed lines with what you genuinely tested
> on. At minimum, list the physical iPhone you record the video on.

- [iPhone model] running iOS [version] — physical device
- [iPhone model] running iOS [version] — physical device
- iPhone [model] Simulator, iOS [version] — Xcode [version]

Build under review: **1.0.0 (8)**, bundle ID `com.melange.app`.

---

## 3. What the app does, and who it is for

**Melange is where creative people find their next collaboration.**

The users are early-to-mid-career independent creatives in a city —
photographers, models, makeup artists, stylists, filmmakers, art directors.

**The problem:** creative collaborations currently get arranged through
Instagram DMs and group chats. That fails in specific ways. There is no
structured way to signal "I want to work with you" as distinct from a fan
message, so real requests land in a request folder beside cold outreach. There
is no way to search for a stylist available in your city this weekend. And there
is no reputation signal, which matters because these collaborations mean meeting
a stranger in person for a shoot.

**How Melange solves it:** a creative posts a specific project — the concept, the
location, the date, whether it pays, and which roles they still need. Other
creatives swipe through those posts. When both people like each other's work it
becomes a match, which opens a realtime chat to plan the shoot. Profiles carry a
nine-image portfolio, so the decision is made on the work rather than a bio.
After a collaboration, both parties review each other.

**The value:** it replaces cold DMs with mutual, intentional matching, and gives
creatives a track record that follows them.

The app is free. There are no ads, no in-app purchases, and no subscriptions.
Age rating is 17+ because all content is user-generated.

---

## 4. Setup and access instructions

No setup, configuration, or sample files are required. The app works immediately
on launch.

**Demo account (already in the Sign-In Information fields):**

- Email: `review@melange.app`
- Password: `ReviewMelange2026!`

There is only one account type — every user has identical capabilities. There is
no admin tier, no paid tier, and no role-gated functionality.

**To reach each core feature:**

| Feature | How to get there |
|---|---|
| Create a post | Home tab → "New Post" |
| Swipe feed | Home tab → swipe cards left/right |
| Matches and chat | Matches tab → tap any match |
| Profile and portfolio | Profile tab → Edit profile |
| Events | Events tab → browse or RSVP |
| Report content | Post detail → flag icon; or chat menu → Report |
| Block a user | Chat menu → Block user |
| Delete account | Profile → Account & safety → Delete account |

The demo account has an existing match with message history, so matching and
chat can be reviewed immediately without creating a second account.

---

## 5. External services used

| Service | What it does |
|---|---|
| **Supabase** | Postgres database, email/password authentication, image storage, realtime message delivery, and one Edge Function that sends push notifications |
| **Expo / EAS** | React Native framework and the build pipeline that produced this binary |
| **Expo Push Notification Service** | Relays match and message notifications to Apple's APNs |
| **Vercel** | Hosts the marketing site and the privacy policy, terms, and support pages linked from the listing |

That is the complete list. The app does **not** use any AI or machine-learning
service, payment processor, advertising network, third-party analytics or
attribution SDK, social login provider, or data broker. Product analytics are
first-party, written to our own Supabase database.

The app requests one permission: **photo library access**, so users can pick
images for their avatar, portfolio, posts, and event covers. It does not use the
camera, location services, contacts, the microphone, or App Tracking
Transparency.

---

## 6. Regional differences

There are none. The app behaves identically in every region and territory. There
is no geographic gating, no region-specific content, no regional pricing (it is
free everywhere), and no feature that is enabled or disabled by country.

The only location-related behavior is that users type a free-text city on their
posts and can filter the feed by that text. This is user-entered data, not device
location, and it works the same way everywhere.

The app is currently localized in English (U.S.) only.

---

## 7. Regulated industries and third-party material

Melange does not operate in a regulated industry. It is not a financial,
medical, health, gambling, dating, lending, or licensed-professional service, and
it does not require any license or credential to operate.

It contains no protected third-party material. All photographs, text, and profile
content are created and uploaded by the users themselves, who retain ownership.
Our Terms of Use require users to confirm they hold the rights to anything they
upload.

Content safety, per Guideline 1.2:

- Users can report any user, post, or message from inside the app
- Users can block any other user, which removes that person's content from their
  feed and prevents contact
- Reports are queued for human review and offending content is removed
- All users must confirm they are 18 or older at signup
- A published moderation contact is available at `support@melange.app`
- Users can delete their account, and all associated data, from inside the app
