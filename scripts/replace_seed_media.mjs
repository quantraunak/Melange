// Replace the seeded demo content's glossy stock portraits with candid photos of
// real creatives at work (Unsplash), and add one film project so the feed is not
// only photo/model. Reads scripts/seed_media.json. Needs the service role key.
// Usage: node scripts/replace_seed_media.mjs
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
const api = async (path, init = {}) => { const r = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${path}: ${t}`); return t ? JSON.parse(t) : null; };
const plan = JSON.parse(readFileSync("scripts/seed_media.json", "utf8"));

for (const [title, media] of Object.entries(plan.posts)) {
  const rows = await api(`collab_posts?title=eq.${encodeURIComponent(title)}`, { method: "PATCH", body: JSON.stringify({ media_urls: media }) });
  console.log(`post "${title}": ${rows.length} updated`);
}
for (const [name, avatar] of Object.entries(plan.avatars)) {
  const rows = await api(`profiles?name=eq.${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify({ avatar_url: avatar }) });
  console.log(`avatar ${name}: ${rows.length} updated`);
}
const np = plan.new_post;
const existing = await api(`collab_posts?title=eq.${encodeURIComponent(np.title)}&select=id`);
if (existing.length) { console.log("film post already exists, skipped"); }
else {
  const owner = await api(`profiles?name=eq.${encodeURIComponent(np.owner_name)}&select=user_id`);
  if (!owner.length) throw new Error(`no profile named ${np.owner_name}`);
  const { owner_name, ...fields } = np;
  const rows = await api("collab_posts", { method: "POST", body: JSON.stringify({ ...fields, owner_id: owner[0].user_id, is_active: true }) });
  console.log(`film post created: ${rows[0].id}`);
}
console.log("done");
