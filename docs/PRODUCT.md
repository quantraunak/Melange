# Melange — what it is, and what every screen is for

## The story (say it the same way everywhere)

> **Where young creatives find their crew — the people, the nights, the ideas.**

Melange is invite-only. It starts in scenes: **USC**, **UCSD**, **LA**
(Silver Lake / Echo Park), then **NYC**. It is not a dating app and not a
networking app: it's for finding your people — friends, crews, who you go
out with and make things with.

Why someone joins on day one, in order:
1. **A friend sends a code.** Being invited is the status.
2. **A night.** Melange Nights (and members' events) are where the scene
   meets. Before the night you see who's going and talk in the night chat.
3. **After the night.** You can quietly heart people you met; only a
   mutual heart is revealed, and it opens a conversation.
4. **Between nights.** Explore is the scene's moodboard: shoots and ideas,
   featured by editors. Discover is how you find more people.

**The rule:** a feature that doesn't help someone meet their people, go to
a night, or explore the scene's taste doesn't go in the UI.

## Navigation (iOS) — five tabs, in this order

| Tab | Purpose |
|---|---|
| **Discover** (first) | Today's swipe deck. When projects run out, it continues with **people from your scene** (members with at least one photo) — heart = existing profile heart. It never says "all caught up" while there are people left. |
| **Explore** | The scene's moodboard: a two-column Pinterest-style grid of shoots (collab_stories), featured first (`featured_at`), then newest. Scene filter chips. |
| **Nights** | Upcoming events in your scene (toggle: All). Each night: RSVP, who's going, the night chat, and Afterglow after it starts. |
| **Messages** | Unchanged: likes list + one-on-one conversations. |
| **You** | Profile: ✦ Founding mark, scene, @handle, photos, shoots; **Your invites** (5 codes, share each). Settings. |

## Screens

### Invite gate (new — shown after sign-in when `is_member()` is false)
- Title "Melange is invite-only". Code field → `redeem_invite(code)` (case
  insensitive). On success: if the profile has no scene, a one-tap scene
  picker (USC · UCSD · LA · NYC) → `set_scene`. Then into the app.
- Secondary: **Join the waitlist** → insert into `waitlist` (email from the
  account, scene, instagram, what you make). Then a calm "You're on the
  list" state with "Have a code?" to come back.
- Existing members never see this (they were grandfathered).
- App Review signs in with review@ which is a member.

### Nights tab (new) and night detail (extend `mobile/app/event/[id].tsx`)
- List: `events` where scene = my scene (or all), upcoming first; card with
  cover, title, date, place, avatars of who's going.
- Detail: RSVP (existing), **Who's going** (`event_people(p_event)`), **Night
  chat** (table `event_messages`, realtime, members only — host or RSVP
  'going'; show "RSVP to join the chat" otherwise), long-press a message to
  report (`reports.target_kind = 'event_message'`).
- **Afterglow** section, visible from the night's start until 3 days after
  it ends: grid of people from the night with a heart toggle
  (`toggle_event_heart(p_event, p_user)` → `{hearted, mutual, match_id}`).
  Copy: "Heart anyone you'd like to see again. They'll only know if they
  hearted you too." On mutual: the existing MatchCelebration, then chat.
  Below: "Mutual" list from `my_event_mutuals(p_event)`.
- Hosts pick the night's scene when creating an event (default: their scene).

### Explore (rework `mobile/app/(tabs)/stories.tsx`)
- Two-column masonry of shoot covers; tap → existing story detail.
- Order: featured (`featured_at` desc), then newest public. Scene chips
  filter by the author's scene. Remove the Events sub-tab (Nights owns it).
- Admins (`is_admin()`) see "Feature" / "Unfeature" on story detail →
  `set_featured(p_story, on)`.

### You (profile tab)
- Header: avatar, name, ✦ Founding (if `founding`), scene chip, @handle.
- **Your invites**: `my_invite_codes()` → 5 rows, each with Share →
  `Share.share({ message: "Come join me on Melange — invite code MEL-XXXXX https://melange-psi.vercel.app/join?code=MEL-XXXXX" })`. Used codes greyed.
- Edit profile gains **Handle** (`set_handle`) and **Scene** (`set_scene`).

### Discover
- Cards show ✦ for founding members.
- After the project deck is exhausted, continue with people from my scene
  I haven't hearted, have ≥1 photo, not blocked; heart via the existing
  `toggle_heart('profile', user_id)`.

## Web (no login needed)
- `/` landing — the story above; invite-only; scenes (USC, UCSD, LA live; NYC soon); Nights; Explore; a waitlist form (insert into `waitlist`). Keep the existing screenshots section, safety, footer, light theme.
- `/join?code=…` — "You're invited to Melange", the code big and copyable, App Store button, three steps (download → sign up → enter code). No code → waitlist form.
- `/@handle` — public profile (rewrite `/@:handle` → `/u/:handle`): photos, name, role, scene, ✦ Founding, confirmed credits, shoots grid; CTA "Melange is invite-only — join the waitlist". Data: `get_public_profile(p_handle)` (anon). OG image = avatar or first photo.
- `/s/[id]` — public shoot page via `get_shared_story(p_story)` (anon), as before.

## Database contract (live in production)
From `23_scenes_invites_nights.sql`:
- `is_member(p_user default me) → bool`, `redeem_invite(p_code) → {ok, scene, founding, already_member?}`, `my_invite_codes() → (code, used)`, `set_scene(p_scene)`, `set_handle(p_handle) → handle`.
- Table `waitlist(email, name, scene, instagram, what_you_make)` — insert-only for anon/authenticated.
- `events.scene`; `is_event_member(p_event)`; table `event_messages(id, event_id, sender_id, content, created_at)` (RLS: members read/write, sender deletes; in realtime publication); `event_people(p_event) → (user_id, name, avatar_url, role, handle, is_host, i_hearted)`.
- `toggle_event_heart(p_event, p_user) → {hearted, mutual, match_id?}`; `my_event_mutuals(p_event) → (user_id, name, avatar_url, match_id)`. Mutual creates a `matches` row with origin 'event'; push says "It's mutual ✦".
- `get_public_profile(p_handle) → jsonb` (anon).
- `collab_stories.featured_at`; `set_featured(p_story, p_on)` (admins); `is_admin()`.
- `profiles.scene, handle, founding, invited_by, member_since` (founding/invited_by/member_since are server-set only).
From `22_crew_and_credits.sql` (available, not in the main UI yet): `get_shared_story`, `confirmed_credit_counts`, credit claims.

## Design rules
Light only — white/off-white, indigo brand, purple accent used rarely (docs/DESIGN.md). Editorial, a little zine-like in copy; never corporate. One large left-aligned title per tab, same style everywhere; 16/24 spacing; one primary action per screen; empty states that say what to do next ("No nights in UCSD yet — host one"). The ✦ is the only ornament. Never dark-first surfaces.
