#!/usr/bin/env bash
# Build the iPhone app on EAS with the production profile and submit it to
# App Store Connect. Build number auto-increments (eas.json). Returns immediately.
set -euo pipefail
cd "$(dirname "$0")/../mobile"
npx eas build --platform ios --profile production --auto-submit --non-interactive --no-wait "$@"
