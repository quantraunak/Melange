// The seeded photos are landscape. Shown in a full-screen portrait card they
// crop to whatever sits in the geometric middle, which on a shallow-depth-of-
// field frame is usually the bokeh rather than the subject. Re-request every
// seeded image as a portrait crop composed on the subject, and clean up a role
// chip that is not in the roles vocabulary.
//
// Usage: node scripts/fix_seed_media_crops.mjs
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

/** Portrait crop composed on the subject. 3:4 is tall enough for a phone card
 *  without the extreme letterboxing of 9:16 on an already-cropped frame. */
const portrait = (url) => {
  const base = url.split("?")[0];
  if (!base.includes("images.unsplash.com")) return url;
  return `${base}?w=1200&h=1600&q=80&auto=format&fit=crop&crop=faces,entropy`;
};
/** Avatars want a square face crop, not a portrait card. */
const avatar = (url) => {
  const base = url.split("?")[0];
  if (!base.includes("images.unsplash.com")) return url;
  return `${base}?w=400&h=400&q=80&auto=format&fit=crop&crop=faces`;
};

let n = 0;
for (const p of await api("collab_posts?select=id,title,media_urls,looking_for,roles")) {
  const media = (p.media_urls || []).map(portrait);
  // "Creatives" is not a role. Drop it; if that empties the list, say Model.
  const clean = (arr) => {
    if (!arr) return arr;
    const out = arr.filter((r) => r && r.toLowerCase() !== "creatives");
    return out.length ? out : ["Model"];
  };
  const body = { media_urls: media };
  const lf = clean(p.looking_for), rl = clean(p.roles);
  if (JSON.stringify(lf) !== JSON.stringify(p.looking_for)) body.looking_for = lf;
  if (JSON.stringify(rl) !== JSON.stringify(p.roles)) body.roles = rl;
  await api(`collab_posts?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify(body) });
  console.log(`post  ${p.title.slice(0, 42).padEnd(42)} ${media.length} img${body.looking_for || body.roles ? "  [role fixed]" : ""}`);
  n++;
}
for (const s of await api("collab_stories?select=id,title,media_urls")) {
  await api(`collab_stories?id=eq.${s.id}`, { method: "PATCH", body: JSON.stringify({ media_urls: (s.media_urls || []).map(portrait) }) });
  console.log(`story ${s.title.slice(0, 42).padEnd(42)} ${(s.media_urls || []).length} img`);
  n++;
}
for (const pr of await api("profiles?select=user_id,name,avatar_url")) {
  if (!pr.avatar_url?.includes("images.unsplash.com")) continue;
  await api(`profiles?user_id=eq.${pr.user_id}`, { method: "PATCH", body: JSON.stringify({ avatar_url: avatar(pr.avatar_url) }) });
  console.log(`avatar ${pr.name}`);
  n++;
}
console.log(`done, ${n} rows`);
