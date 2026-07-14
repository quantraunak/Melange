# iOS tonight — if EAS “won’t connect”

`eas login` often hangs in IDE terminals. Use **your Mac Terminal app** instead.

## Option A — Skip EAS (fastest): build on your Mac

Uses your Apple Developer account via Xcode. No Expo cloud login required.

```bash
cd ~/Projects/melange/mobile
npm install
npx expo run:ios
```

- First run: 5–15 min.
- Sign in: `review@melange.app` / `ReviewMelange2026!`

If you see **Missing EXPO_PUBLIC_…**: ensure `mobile/.env` exists (run `npm run setup` from repo root).

## Option B — EAS / TestFlight (Expo cloud)

Run in **Terminal.app** (not Cursor):

```bash
cd ~/Projects/melange/mobile
npx eas login
```

If browser doesn’t open:

```bash
npx eas login -s
```

Or create a token at https://expo.dev/settings/access-tokens then:

```bash
export EXPO_TOKEN=your_token_here
npx eas whoami
npx eas build:configure
npx eas build --platform ios --profile production
```

## “Could not connect to development server”

- Simulator: run `npx expo start` in one terminal, press `i` in another — or use `expo run:ios` only (no separate Metro).
- Physical phone + Expo Go: phone and Mac must be on the **same Wi‑Fi**; avoid VPN.

## App loads but login fails

- Confirm `mobile/.env` has the **anon** JWT (starts with `eyJ`), not `sb_secret_`.
- Supabase → Authentication → Providers → Email: turn off “Confirm email” for testing.
