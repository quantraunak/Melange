/**
 * Cohort retention and activation funnel, read live from the database.
 *
 * Usage:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/metrics.mjs [--weeks 8] [--include-seeded]
 *
 * Why this exists: product-market fit is a claim about whether people come
 * back, and until now the only way to say anything about usage was a manual
 * query that counted totals. Totals cannot distinguish a hundred signups who
 * each opened the app once from twenty who use it weekly, and only the second
 * is evidence of anything.
 *
 * No new client instrumentation is required. Signups, posts, swipes, matches
 * and messages all carry created_at, so "came back on day N" is derivable from
 * activity timestamps that already exist. The analytics_events table is
 * deliberately not used: it exists in the schema and nothing writes to it.
 *
 * Seeded and internal accounts are excluded by default. Counting them is how a
 * launch looks successful to the person who ran the seed script.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const weeks = Number(args[args.indexOf("--weeks") + 1]) || 8;
const includeSeeded = args.includes("--include-seeded");

// Accounts created by seed_demo_accounts.mjs and internal testing. Excluded so
// the funnel describes people who found the app rather than people who built it.
const SEED_MARKERS = [/^demo/i, /^test/i, /example\.com$/i, /\+seed@/i];

const day = 86_400_000;
const iso = (d) => new Date(d).toISOString();
const weekOf = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  x.setUTCDate(x.getUTCDate() - x.getUTCDay());
  return x.toISOString().slice(0, 10);
};

async function all(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const since = iso(Date.now() - weeks * 7 * day);

const { data: users, error: userErr } = await db.auth.admin.listUsers({ perPage: 1000 });
if (userErr) throw new Error(`auth: ${userErr.message}`);

const seeded = new Set(
  users.users
    .filter((u) => SEED_MARKERS.some((m) => m.test(u.email ?? "")))
    .map((u) => u.id)
);
const cohort = new Map(); // user_id -> signup timestamp
for (const u of users.users) {
  if (!includeSeeded && seeded.has(u.id)) continue;
  cohort.set(u.id, u.created_at);
}

const [profiles, posts, swipes, matches, messages] = await Promise.all([
  all("profiles", "user_id,created_at,bio,avatar_url"),
  all("collab_posts", "author_id,created_at"),
  all("swipes", "swiper_id,created_at"),
  all("matches", "id,created_at"),
  all("messages", "sender_id,match_id,created_at"),
]);

// Every action a user took, so "still active on day N" is one lookup.
const activity = new Map();
const note = (id, at) => {
  if (!id || !cohort.has(id)) return;
  (activity.get(id) ?? activity.set(id, []).get(id)).push(new Date(at).getTime());
};
posts.forEach((r) => note(r.author_id, r.created_at));
swipes.forEach((r) => note(r.swiper_id, r.created_at));
messages.forEach((r) => note(r.sender_id, r.created_at));

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(0)}%` : "—");
const recent = [...cohort.entries()].filter(([, at]) => at >= since);

console.log(`\nMelange · last ${weeks} weeks · ${includeSeeded ? "including" : "excluding"} seeded accounts`);
console.log(`signups: ${recent.length} of ${cohort.size} all-time` +
            (seeded.size ? `   (${seeded.size} seeded accounts hidden)` : ""));

// ------------------------------------------------------------------ funnel
const has = (rows, field) => new Set(rows.map((r) => r[field]).filter((id) => cohort.has(id)));
const withProfile = new Set(
  profiles.filter((p) => cohort.has(p.user_id) && p.bio && p.avatar_url).map((p) => p.user_id)
);
const stages = [
  ["signed up", cohort.size],
  ["completed a profile", withProfile.size],
  ["posted a collab", has(posts, "author_id").size],
  ["swiped", has(swipes, "swiper_id").size],
  ["sent a message", has(messages, "sender_id").size],
];
console.log("\nActivation funnel (all-time, real accounts)");
for (const [label, n] of stages) {
  const bar = "█".repeat(Math.round(20 * (n / Math.max(stages[0][1], 1))));
  console.log(`  ${label.padEnd(22)}${String(n).padStart(4)}  ${pct(n, stages[0][1]).padStart(4)}  ${bar}`);
}

// --------------------------------------------------------------- retention
console.log("\nWeekly cohorts — share still active N days after signing up");
console.log(`  ${"cohort".padEnd(12)}${"n".padStart(4)}${"D1".padStart(7)}${"D7".padStart(7)}${"D30".padStart(7)}`);
const byWeek = new Map();
for (const [id, at] of recent) {
  const w = weekOf(at);
  (byWeek.get(w) ?? byWeek.set(w, []).get(w)).push([id, new Date(at).getTime()]);
}
for (const w of [...byWeek.keys()].sort()) {
  const members = byWeek.get(w);
  const back = (lo, hi) =>
    members.filter(([id, t]) =>
      (activity.get(id) ?? []).some((a) => a >= t + lo * day && a < t + hi * day)
    ).length;
  const mature = (d) => (Date.now() - Math.min(...members.map(([, t]) => t)) > d * day);
  const cell = (lo, hi, d) => (mature(d) ? pct(back(lo, hi), members.length) : "·");
  console.log(`  ${w.padEnd(12)}${String(members.length).padStart(4)}` +
              `${cell(1, 2, 2).padStart(7)}${cell(7, 8, 8).padStart(7)}${cell(30, 31, 31).padStart(7)}`);
}
console.log("  · = cohort too young to have reached that day yet");

// ------------------------------------------------------------- core action
const matched = matches.filter((m) => new Date(m.created_at) >= new Date(since));
const messagedMatches = new Set(messages.map((m) => m.match_id));
console.log("\nDoes the core loop close?");
console.log(`  matches created        ${matched.length}`);
console.log(`  matches that talked    ${matched.filter((m) => messagedMatches.has(m.id)).length}` +
            `  (${pct(matched.filter((m) => messagedMatches.has(m.id)).length, matched.length)})`);
console.log("\nThe number that decides PMF is the D7 column. Everything else is volume.\n");
