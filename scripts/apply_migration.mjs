/**
 * Apply a SQL migration via the Supabase Management API.
 *
 * Usage:
 *   SUPABASE_PROJECT_REF=<project-ref> \
 *   SUPABASE_ACCESS_TOKEN=<personal-access-token> \
 *   MIGRATION_FILE=<path-to-sql> \
 *   node scripts/apply_migration.mjs
 *
 * The personal access token (PAT) is a secret. Pass it via env only.
 */

import fs from "node:fs";
import path from "node:path";

/** Load SUPABASE_* from .env.local when not passed on the command line. */
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

const ref =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const file = process.env.MIGRATION_FILE;

if (!ref || !token || !file) {
  console.error("Missing env vars.");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");
console.log(`Loaded ${sql.length} chars of SQL from ${file}`);
console.log(`Posting to project ${ref}...\n`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text);

if (!res.ok) {
  process.exit(2);
}
