#!/usr/bin/env bash
#
# One command to get your work onto GitHub safely.
#
#   ./scripts/save.sh "what you changed"
#
# Pushing straight to main is blocked on purpose: main is what ships to the
# App Store, and GitHub refuses any commit there that has not passed the
# checks first. That rejection is the "push blocked" message, and it is the
# protection working, not something broken on your machine.
#
# This script does the part that gets around it properly: it puts your work on
# its own branch, pushes that, and opens a pull request. The checks then run on
# the branch, and it merges into main once they are green.
set -euo pipefail

cd "$(dirname "$0")/.."

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "Say what you changed, in quotes. For example:"
  echo "  ./scripts/save.sh \"made the buttons bigger on the profile page\""
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing has changed, so there is nothing to save."
  exit 0
fi

WHO="$(git config user.name 2>/dev/null | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
WHO="${WHO:-work}"
SLUG="$(printf '%s' "$MSG" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-' | cut -c1-40)"
BRANCH="$WHO/$(date +%m%d)-${SLUG:-change}"

CURRENT="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT" = "main" ]; then
  echo "Moving your work onto a branch: $BRANCH"
  git checkout -b "$BRANCH"
else
  BRANCH="$CURRENT"
  echo "Already on a branch: $BRANCH"
fi

git add -A
git commit -q -m "$MSG"
git push -q -u origin "$BRANCH"

if command -v gh >/dev/null 2>&1; then
  gh pr create --fill --head "$BRANCH" 2>/dev/null \
    || gh pr view --web 2>/dev/null \
    || true
  echo
  echo "Saved and opened for review. The checks take about two minutes."
else
  echo
  echo "Saved. Open the pull request here:"
  echo "  https://github.com/quantraunak/Melange/compare/$BRANCH?expand=1"
fi
