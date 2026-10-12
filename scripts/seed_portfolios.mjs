// Give the seeded creatives a portfolio.
//
// Two reasons this matters beyond looks. The public profile grid had no data
// to render, so it shipped unverified. And the quality floor (three photos and
// a role before you can post or like) would have locked out the App Store
// reviewer account, which had none — Apple would have hit a wall and failed
// the review.
//
// Images are the portrait crops already seeded on posts and stories, so they
// are known to load and are composed on their subject.
//
// Usage: node scripts/seed_portfolios.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
const api = async (p, init = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${p}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${p}: ${t}`);
  return t ? JSON.parse(t) : null;
};

// Every portrait-composed image already in the database, de-duplicated.
const pool = [];
for (const row of [...(await api("collab_posts?select=media_urls")), ...(await api("collab_stories?select=media_urls"))]) {
  for (const u of row.media_urls || []) if (u && !pool.includes(u)) pool.push(u);
}
if (pool.length < 6) throw new Error(`only ${pool.length} images available`);

const MIN = 3;
let n = 0;
const profiles = await api("profiles?select=user_id,name,role,portfolio_urls");
for (const [i, p] of profiles.entries()) {
  if ((p.portfolio_urls || []).length >= MIN) { console.log(`skip ${p.name} (${p.portfolio_urls.length} already)`); continue; }
  // Deterministic, different per person, no randomness so re-runs are stable.
  const take = 4;
  const picks = Array.from({ length: take }, (_, k) => pool[(i * 3 + k) % pool.length]);
  await api(`profiles?user_id=eq.${p.user_id}`, { method: "PATCH", body: JSON.stringify({ portfolio_urls: picks }) });
  console.log(`${(p.name || "?").padEnd(16)} <- ${take} images`);
  n++;
}
console.log(`done, ${n} profiles given a portfolio`);
