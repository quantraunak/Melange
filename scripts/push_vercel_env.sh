#!/usr/bin/env bash
# Push .env.local server vars to Vercel (requires: vercel login && vercel link)
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v vercel >/dev/null; then
  echo "Install Vercel CLI: npm i -g vercel"
  exit 1
fi

source_env() {
  export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
}

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local"
  exit 1
fi

source_env

for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ADMIN_REPORTS_KEY; do
  val="${!key:-}"
  if [[ -z "$val" ]]; then
    echo "Skip $key (not set in .env.local)"
    continue
  fi
  echo "Setting $key on Vercel (production)..."
  printf '%s' "$val" | vercel env add "$key" production --force
done

echo "Done. Redeploy from Vercel dashboard or: vercel --prod"
