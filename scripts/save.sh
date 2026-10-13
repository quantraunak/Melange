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

# Show what is about to be saved before saving it.
#
# This script saves EVERYTHING that changed, including files you may have
# forgotten about, which is usually what you want and is occasionally a
# surprise. I made exactly that mistake testing this script and committed two
# unrelated files, so it now prints the list first.
echo
echo "About to save:"
git -c color.ui=never status --short | sed 's/^/  /'
echo

if [ -t 0 ]; then
  printf "Looks right? [Y/n] "
  read -r REPLY
  case "$REPLY" in
    [nN]*) echo "Stopped. Nothing was saved."; exit 0 ;;
  esac
fi

git add -A
git commit -q -m "$MSG"

# Run the same lint the checks will run, on whichever part changed.
#
# Lint failures are the usual reason a first pull request goes red, and they
# are almost always formatting or an unused import rather than anything real.
# Far better to hear it here, where it is one command to fix, than as a red X
# on GitHub ten minutes later. This warns and keeps going: saving unfinished
# work is allowed, and a pull request with a failing check is easy to fix.
CHANGED="$(git diff --name-only HEAD~1 HEAD || true)"
lint_area() {
  local dir="$1" label="$2"
  ( cd "$dir" && npm run --silent lint >/dev/null 2>&1 ) || {
    echo
    echo "Heads up: the $label code has lint problems, so the checks will fail."
    echo "Most of them fix themselves. Try:"
    echo "    (cd $dir && npm run lint -- --fix)"
    echo "then run this script again to save the fixes."
  }
}
if printf '%s' "$CHANGED" | grep -q '^mobile/'; then lint_area mobile "app"; fi
if printf '%s' "$CHANGED" | grep -qv '^mobile/'; then lint_area . "website"; fi

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
