#!/usr/bin/env bash
# Apply one supabase/schema/*.sql file to the Melange Supabase project via the
# management API. Idempotent files only.
# Usage: bash scripts/apply-schema.sh supabase/schema/08_projects.sql
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?usage: apply-schema.sh <path/to/file.sql>}"
set -a; . ./.env.local; set +a
REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#https://([^.]+)\.supabase\.co.*#\1#')
BODY=$(python3 -c 'import json,sys;print(json.dumps({"query":open(sys.argv[1]).read()}))' "$FILE")
curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d "$BODY"
echo
