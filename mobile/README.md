# Melange — iOS App

The native iOS version of [Melange](../README.md), built with Expo (React Native).

Same backend (Supabase), same idea, same brand — now a real native app:

- Native swipe gestures via Reanimated + Gesture Handler
- Push notifications for matches and new messages
- Server-side unread tracking that syncs across devices
- Multi-image posts, post editing, post deletion
- Block & report flows (App Store UGC compliance)
- In-app account deletion (App Store 5.1.1(v) compliance)

## Quick start (iOS Simulator)

Requirements:

- macOS with Xcode 16+ installed (open Xcode at least once to accept the license)
- Node.js 20+
- The Supabase project from the web app (or any Supabase project with the same schema)

```bash
cd mobile
cp .env.example .env       # fill in EXPO_PUBLIC_SUPABASE_URL + ANON_KEY
npm install
npm run ios                # builds and launches the iOS Simulator
```

The first build takes ~5 minutes because Expo prebuilds the native `ios/` project on the fly. Subsequent runs are fast.

If you want to use Expo Go for a quick smoke test, run `npm start` and scan the QR code — note that push notifications and a few native modules won't work in Expo Go, only in a real dev client / device build.

## Configuration

Set in `mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

The mobile app shares the **same** Supabase project as the web app — same schema, same RLS, same auth. A user who signs up on iOS can sign in on the web and vice versa.

## Database setup

Two scripts, run in order in the Supabase SQL Editor:

1. `../supabase_schema.sql` — base schema (already in the web README; idempotent)
2. `../supabase_schema_v2.sql` — additions for the mobile app: `blocks`, `reports`, `push_tokens`, `match_reads`, `feed_posts` RPC, `delete_account` RPC, `touch_updated_at` trigger

Then in the Supabase Dashboard:

- **Database → Replication** — enable Realtime for `messages` and `matches`.
- **Storage** — verify the `media` bucket exists (the v1 schema creates it).
- **Authentication → Providers → Email** — disable "Confirm email" if you want frictionless dev signups (the app handles both flows).

### Push notifications (server side)

Push tokens are stored in `push_tokens` (RLS-protected per user). Outbound pushes go through an Edge Function that listens to Database Webhooks:

```bash
supabase login
supabase functions deploy send-push --no-verify-jwt
```

Then in the Supabase Dashboard → Database → Webhooks, create **two** webhooks:

| Name                 | Table    | Event  | URL                                              | Headers                                              |
|----------------------|----------|--------|--------------------------------------------------|------------------------------------------------------|
| `push-on-message`    | messages | INSERT | `https://<ref>.functions.supabase.co/send-push`  | `Content-Type: application/json`                     |
| `push-on-match`      | matches  | INSERT | `https://<ref>.functions.supabase.co/send-push`  | `Content-Type: application/json`                     |

For each webhook, set the **HTTP Payload** to:

```json
{ "type": "message", "record": $RECORD }
```

(For the matches webhook use `"type": "match"`.)

The edge function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from its env automatically.

> Until you wire this up, push notifications won't be delivered, but the rest of the app works fine.

## Project layout

```
mobile/
├── app/                          # Expo Router file-system routes
│   ├── _layout.tsx               # Root: auth gate, stack, providers
│   ├── index.tsx                 # Redirect to /(auth)/welcome or /(tabs)/connect
│   ├── (auth)/                   # Pre-auth screens
│   │   ├── welcome.tsx           # 4-slide onboarding intro
│   │   ├── login.tsx
│   │   └── signup.tsx            # Full profile + Terms acceptance
│   ├── (tabs)/                   # Tab navigator (Connect / Messages / Profile)
│   │   ├── _layout.tsx           # Custom pill tab bar + push registration
│   │   ├── connect.tsx           # Swipe feed
│   │   ├── messages.tsx          # Match list with unread badges
│   │   └── profile.tsx           # Edit profile, avatar upload, account links
│   ├── chat/[matchId].tsx        # Realtime chat + block/report action sheet
│   ├── post/
│   │   ├── new.tsx               # Create post
│   │   ├── [id].tsx              # Post detail (with report button)
│   │   └── edit/[id].tsx         # Edit / delete post
│   ├── report/[kind]/[id].tsx    # Report user / post / message
│   └── account/
│       ├── blocked.tsx           # Manage blocked users
│       └── delete.tsx            # Account deletion with confirmation
├── src/
│   ├── lib/
│   │   ├── supabase.ts           # Native Supabase client w/ AsyncStorage session
│   │   ├── db.ts                 # All queries + types (ported from web + extended)
│   │   ├── auth.tsx              # AuthProvider / useAuth
│   │   ├── matches.tsx           # MatchesProvider — shared matches + unread state
│   │   ├── push.ts               # Expo push token registration
│   │   ├── format.ts             # formatTimeAgo, formatClockTime
│   │   └── theme.ts              # Design tokens (mirrors web Tailwind palette)
│   └── components/
│       ├── BrandHeader.tsx
│       ├── Logo.tsx
│       ├── Avatar.tsx
│       ├── SwipeCard.tsx         # Native gesture-driven swipe card
│       ├── PostForm.tsx          # Shared between create + edit
│       └── ui/                   # Button, Input, TextArea, Field, ErrorBanner
├── assets/                       # icon.png, splash.png, etc.
├── store/                        # App Store submission metadata
├── app.json                      # Expo config
├── eas.json                      # EAS Build profiles
├── babel.config.js
├── metro.config.js
└── tsconfig.json
```

## Building for the App Store

### 1. Apple Developer account

You'll need an Apple Developer Program membership ($99/year). Sign up at https://developer.apple.com/programs/.

### 2. EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 3. Initialize EAS project

```bash
cd mobile
eas project:init    # creates the EAS projectId; will write it into app.json
```

### 4. Generate Apple credentials

EAS can manage the entire signing pipeline for you:

```bash
eas credentials                 # interactive — pick "iOS" → "Set up build credentials"
```

It will create:

- App ID `com.melange.app` on the Apple Developer portal
- Distribution certificate
- Provisioning profile
- Apple Push Notification key (APNs) — needed for push

### 5. Build

```bash
# Internal preview build (for TestFlight + your device):
eas build --platform ios --profile preview

# Production build (for App Store submission):
eas build --platform ios --profile production
```

Each build takes ~15 minutes on EAS's cloud infrastructure. You'll get a downloadable `.ipa`.

### 6. Submit to App Store Connect

```bash
eas submit --platform ios --latest
```

The first time, EAS will prompt for your Apple ID. After that it's one command.

### 7. App Store Connect

Fill in the listing using the content in [`store/metadata.md`](./store/metadata.md):

- App name, subtitle, keywords, description
- Screenshots (6.7" iPhone — take them in the simulator with `Cmd+S`)
- **Age rating**: 17+ (User-Generated Content)
- **Privacy policy URL** and **support URL** (host the markdown files somewhere — Vercel works fine)
- **Account deletion**: confirm in-app deletion is at Profile → Account & safety → Delete account
- **Demo account**: create `review@melange.app` so reviewers can sign in

## Useful commands

```bash
npm run ios                  # build + run on the iOS Simulator
npm run ios:device           # run on a connected physical iPhone (USB)
npm run prebuild             # regenerate the ios/ folder from app.json
npx expo-doctor              # health check the project
npx tsc --noEmit             # typecheck without building
```

## Known limitations that were fixed in the move to native

- ✅ Per-device unread tracking → now server-side (`match_reads` table)
- ✅ No push notifications → Expo Notifications + Supabase Edge Function
- ✅ No post editing or deletion → Profile tab lists your posts; tap to edit/delete
- ✅ Single image per post → up to 5 images per post with a swipeable gallery
- ✅ No blocking or reporting → both implemented (App Store compliant)
- ✅ No account deletion in-app → Profile → Account & safety → Delete account

## Troubleshooting

**"Unable to resolve module ..."** — run `npx expo install --check` and reinstall any drifting packages.

**Push notifications don't arrive in the simulator** — the iOS Simulator does not support push tokens. Test on a physical device with a development build (`eas build --profile development --platform ios`).

**"Module HMRClient is not a registered callable module"** — kill Metro and the simulator app, then `npm run ios` again.

**Images don't upload** — verify the `media` Storage bucket exists in Supabase and is set to public. RLS policies are in the v1 schema.
