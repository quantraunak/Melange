#!/usr/bin/env bash
# Build Melange for your real iPhone (TestFlight / internal install).
# Run once in Terminal.app:  bash ~/Projects/melange/scripts/build_iphone.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/mobile"

if ! npx eas whoami >/dev/null 2>&1; then
  echo ""
  echo "First: log into Expo (free account, same email as GitHub is fine)"
  echo "  npx eas login"
  echo ""
  echo "Then run this script again."
  exit 1
fi

# Load Supabase keys from repo root .env.local
ENV_FILE="$ROOT/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
ANON=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d= -f2-)

echo "→ Setting EAS secrets..."
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "$URL" --force 2>/dev/null || \
  npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "$URL" --environment production --visibility plaintext --force 2>/dev/null || true
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$ANON" --force 2>/dev/null || \
  npx eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$ANON" --environment production --visibility plaintext --force 2>/dev/null || true

echo "→ Linking EAS project (if needed)..."
npx eas build:configure --platform ios 2>/dev/null || true

echo ""
echo "→ Starting cloud build for your iPhone (15–25 min)..."
echo "  You can close Terminal after it uploads — track at https://expo.dev"
echo ""
npx eas build --platform ios --profile production --non-interactive

echo ""
echo "When build finishes, run:"
echo "  cd ~/Projects/melange/mobile && npx eas submit --platform ios --latest"
echo ""
echo "Then install TestFlight on your iPhone and open the build from App Store Connect."
