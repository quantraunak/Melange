# Melange — what it is, and what every screen is for

## The story (say it the same way everywhere)

> **Tell us the shoot, we'll find your crew. Every credit confirmed.**

Melange is for people who make things: photographers, models, makeup
artists, stylists, hair, videographers, directors, designers, musicians.
Three verbs, in order:

1. **Find** — Discover people and projects. Swipe. Heart.
2. **Shoot** — describe a shoot; Melange suggests a crew for each role;
   invite them in one tap; plan it in Messages.
3. **Credit** — post the finished shoot and credit everyone. A credit only
   counts once the person confirms it. People not on Melange get a link to
   claim theirs — that link is how Melange grows.

**The rule:** a feature that does not help someone find people, plan a
shoot, or get credit does not go in the UI. Events and reviews stay in the
code but leave the navigation.

## Navigation (iOS) — four tabs, in this order

| Tab | Purpose |
|---|---|
| **Discover** (first) | Today's swipe deck, unchanged in behaviour. Cards show the owner's confirmed-credit count. |
| **Shoot** | Plan a shoot → suggested crew → invite. Lists shoots you're planning and shoots you're invited to. |
| **Messages** | Unchanged (likes list + conversations). Shoot invites arrive here as messages. |
| **You** | Profile, credits first: confirmed-credit count, then shoots you're credited on, then portfolio. |

The **Explore** tab is removed. Shoots (stories) are reached from profiles,
from Discover, and from their share links. Events leave the tab bar.

## Screens

### Shoot tab (`mobile/app/(tabs)/shoot.tsx`, new)
- Header: large title "Shoot", one line under it: "Tell us the shoot. We'll find your crew."
- Primary button: **Plan a shoot** → the composer.
- "Planning" list: each shoot with cover, title, date, and crew avatars with
  status (invited / yes / no). Tap → shoot detail.
- "Invited" list: shoots someone invited you to, with **Yes** / **No**.

### Composer (`mobile/app/shoot/new.tsx`, new — reuse ProjectForm pieces, do not fork it)
Fields, one screen, in this order: **What's the shoot?** (title, one line),
**Who do you need?** (role chips, multi-select), **Vibe** (vibe chips),
**When** (date), **Where** (text), **Pay** (TFP / paid + amount),
optional reference photos. Saving creates a `collab_posts` row (roles,
looking_for, vibes, project_start, location, pay_type, compensation,
media_urls) exactly as ProjectForm does today, then goes to Crew.

### Crew (`mobile/app/shoot/[id].tsx`, new)
- One section per needed role: up to 3 suggestion cards from
  `suggest_crew(p_post, 3)` — avatar or portfolio cover, name, their role,
  the `reason` line, **Invite** button → `invite_to_shoot(p_post, p_user, p_role)`.
- Already-invited crew at the top with status.
- When the shoot date has passed: **Post it and credit everyone** → StoryForm
  prefilled with title, and credits = owner + every accepted crew member
  (name, role, user_id).

### Shoot (story) detail (existing `mobile/app/story/[id].tsx`)
- Credits list shows a ✓ for confirmed credits.
- If I'm credited (user_id = me) and not confirmed: **Confirm my credit** /
  **That's not me** → `confirm_credit` / `decline_credit`.
- If I'm the author: each credit without a user_id has **Invite to claim** →
  `create_credit_invite(p_story, index)` → native share sheet with
  `https://melange-psi.vercel.app/c/<token>` and the text
  "I credited you as <role> on "<title>" — claim it on Melange".
- **Share** → `https://melange-psi.vercel.app/s/<story_id>`.

### Discover cards (existing SwipeCard)
- Small line under the owner's name: "✓ 4 confirmed credits" from
  `confirmed_credit_counts(user_ids[])` (fetch once per deck page). Hide when 0.

### You (existing profile tab + ProfileSections)
Order: header (avatar, name, role, ✓ N confirmed credits) → **Credits**
(shoots I'm credited on, grid of covers) → **Portfolio** → About → settings.
Remove anything that doesn't fit that order.

## Web (no login needed)
- `/s/[id]` — a shoot: photos, title, date, author, credits with ✓ for
  confirmed and "on Melange" for linked accounts. CTA: Get Melange. Data:
  `get_shared_story(p_story)` (anon). `generateMetadata` uses the first
  photo as og:image and "Credits: A, B, C" as the description.
- `/s/[id]/card` — 1080×1920 Instagram Story image (next/og): cover photo,
  title, credits list "Shot by …", Melange mark.
- `/c/[token]` — claim page: "<author> credited you as <role> on <title>",
  cover photo. Signed in → **Claim my credit** (`claim_credit`). Signed out
  → compact sign-up (name, email, password, role) with "I have an account"
  toggle, then claim. Success: "It's on your profile" + App Store button.
  Data: `get_credit_invite(p_token)` (anon).
- Landing page hero and steps tell the story above (Find, Shoot, Credit).

## Database contract (all in supabase/schema/22_crew_and_credits.sql, live)
- `suggest_crew(p_post uuid, p_per_role int)` → rows (role, user_id, name, avatar_url, their_role, portfolio_cover, confirmed_credits, shared_vibes, worked_with_yours, reason, score). Owner only.
- `invite_to_shoot(p_post uuid, p_user uuid, p_role text)` → match_id. Sends the opening message.
- `respond_to_shoot_invite(p_post uuid, p_accept bool)` → 'accepted' | 'declined'.
- `my_shoots()` → `{ planning: [{post_id,title,start,location,roles,cover_url,is_active,crew:[{user_id,name,avatar_url,role,status,match_id}]}], invited: [{post_id,title,start,location,cover_url,role,status,match_id,owner:{user_id,name,avatar_url}}] }`.
- `confirm_credit(p_story uuid)`, `decline_credit(p_story uuid)`.
- `confirmed_credit_counts(p_users uuid[])` → (user_id, credits).
- `create_credit_invite(p_story uuid, p_index int)` → token (author only).
- `get_shared_story(p_story uuid)` → jsonb, anon OK, public stories only.
- `get_credit_invite(p_token text)` → jsonb, anon OK.
- `claim_credit(p_token text)` → story_id.

## Design rules
Light only (white / off-white, indigo brand, purple accent used rarely) —
see docs/DESIGN.md. "Cleaner" means: one large left-aligned title per tab
in the same style; consistent 16/24 spacing; one primary button per
screen; no stacked banners; empty states that say what to do next.
Never a dark-first surface.
