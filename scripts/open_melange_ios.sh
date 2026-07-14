#!/usr/bin/env bash
# Open Melange directly on the iOS Simulator (no Xcode navigation).
set -euo pipefail
cd "$(dirname "$0")/../mobile"

SIM_NAME="${1:-iPhone 17 Pro}"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

open -a Simulator
UDID=$(xcrun simctl list devices available | grep "$SIM_NAME (" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')
if [[ -z "$UDID" ]]; then
  echo "No simulator named: $SIM_NAME"
  exit 1
fi
xcrun simctl boot "$UDID" 2>/dev/null || true

APP="ios/build/Build/Products/Debug-iphonesimulator/Melange.app"
if [[ ! -f "$APP/Info.plist" ]]; then
  echo "Building Melange (first time may take 10+ min)..."
  cd ios
  pod install
  arch -arm64 xcodebuild \
    -workspace Melange.xcworkspace \
    -scheme Melange \
    -configuration Debug \
    -destination "platform=iOS Simulator,name=$SIM_NAME" \
    -derivedDataPath build \
    build
  cd ..
fi

# Metro for JS bundle
if ! lsof -ti:8081 >/dev/null 2>&1; then
  npx expo start --dev-client --port 8081 >/tmp/melange-metro.log 2>&1 &
  sleep 4
fi

xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" com.melange.app
echo "Melange launched on $SIM_NAME"
