#!/usr/bin/env node
/**
 * One-shot local setup: sync env → install deps → build web → seed demo users.
 * Run: node scripts/setup_all.mjs
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");

function loadEnvFile(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

function run(cmd, cwd = root) {
  console.log(`\n→ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

const localPath = path.join(root, ".env.local");
const mobileEnvPath = path.join(root, "mobile", ".env");

if (!fs.existsSync(localPath)) {
  console.error("Missing .env.local at repo root. Add Supabase URL + keys first.");
  process.exit(1);
}

const env = loadEnvFile(localPath);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error(".env.local must include NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const mobileEnv = `# Auto-synced from .env.local — do not commit
EXPO_PUBLIC_SUPABASE_URL=${url}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${anon}
`;
fs.writeFileSync(mobileEnvPath, mobileEnv);
console.log("✓ Synced mobile/.env from .env.local");

run("npm install");
run("npm install", path.join(root, "mobile"));
run("npm run build");
run("node scripts/seed_demo_accounts.mjs");

console.log("\n✅ Local setup complete.\n");
console.log("Web:  npm run dev     → http://localhost:3000");
console.log("iOS:  cd mobile && npm run ios");
console.log("\nProduction website (Vercel): add these env vars if not already set:");
console.log("  NEXT_PUBLIC_SUPABASE_URL");
console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY");
console.log("  SUPABASE_SERVICE_ROLE_KEY");
console.log("  ADMIN_REPORTS_KEY");
console.log("\nModeration: /internal/reports?key=<ADMIN_REPORTS_KEY>");
