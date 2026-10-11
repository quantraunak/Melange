#!/usr/bin/env bash
# Fix the password-reset flow.
#
# The project's site_url was http://localhost:3000 with an EMPTY redirect
# allowlist, so Supabase refused the app's redirectTo and sent every reset
# link to localhost — a dead page on anyone else's device. The email rate
# limit was also 2/hour project-wide, so a second attempt sent nothing.
#
# Usage: bash scripts/fix-auth-redirects.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#https://([^.]+)\.supabase\.co.*#\1#')
curl -s -X PATCH "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://melange-psi.vercel.app",
    "uri_allow_list": "https://melange-psi.vercel.app,https://melange-psi.vercel.app/*,https://melange-psi.vercel.app/reset-password,melange://*,http://localhost:3000,http://localhost:3000/*",
    "rate_limit_email_sent": 30
  }' | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'message' in d: print('ERROR:', d['message']); sys.exit(1)
for k in ('site_url','uri_allow_list','rate_limit_email_sent'): print(f'{k}: {d.get(k)}')
"
