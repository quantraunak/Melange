// Seed a few collaboration stories so the Stories tab is not empty for App
// Store review. Uses the existing demo profiles and the same candid Unsplash
// photos as the seeded projects. Idempotent: skips a story whose title is
// already there. Delete these the day real stories arrive.
//
// Usage: node scripts/seed_stories.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
const api = async (p, init = {}) => {
  const r = await fetch(`${URL}/rest/v1/${p}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${p}: ${t}`);
  return t ? JSON.parse(t) : null;
};

const people = Object.fromEntries(
  (await api("profiles?select=user_id,name,role")).map((p) => [p.name, p])
);
const need = (n) => { const p = people[n]; if (!p) throw new Error(`no profile "${n}"`); return p; };
const img = (id, w = 1200) => `${id}?w=${w}&q=80&auto=format&fit=crop`;
const U = "https://images.unsplash.com/";

const STORIES = [
  {
    author: "Maya Chen",
    title: "Rooftop editorial, shot in one golden hour",
    story:
      "We had about forty minutes of usable light and no permit, so we planned it like a heist. " +
      "Scouted the roof on a Tuesday, worked out exactly where the sun would sit at 6:40, and had " +
      "three looks steamed and ready before anyone went up. Sofia did makeup in the stairwell off " +
      "a phone flashlight. Everything you see is available light bounced off the white parapet, " +
      "one 85mm wide open. We were packed and out in under an hour.",
    credits: [
      { name: "Jordan Rivera", role: "Model" },
      { name: "Sofia Blake", role: "Makeup Artist" },
    ],
    media: [img(`${U}photo-1767390649099-90a5e594e35d`), img(`${U}photo-1693075252074-22912717acec`)],
    happened_on: "2026-09-20",
  },
  {
    author: "Devin Park",
    title: "A street-style series built from one afternoon of walking",
    story:
      "No studio, no plan, no shot list. We met at the station, walked for four hours and shot " +
      "whatever the light did. The rule was that nobody poses until the frame already works, which " +
      "meant a lot of waiting and a lot of walking past things. About six hundred frames, eleven " +
      "keepers. The best one happened because we got lost.",
    credits: [{ name: "Aria Nakamura", role: "Stylist" }],
    media: [img(`${U}photo-1761069234906-a7c77124f641`), img(`${U}photo-1771367546089-e691a462212b`)],
    happened_on: "2026-08-14",
  },
  {
    author: "Sofia Blake",
    title: "Backstage for a student showcase, eleven faces in two hours",
    story:
      "Two hours, eleven people, one mirror and a folding table. The trick is doing it in passes " +
      "rather than finishing one person at a time: base on everyone first, then eyes on everyone, " +
      "then lips last so nothing smudges while they dress. Nobody missed their call.",
    credits: [
      { name: "Maya Chen", role: "Photographer" },
      { name: "Priya R.", role: "Hair" },
    ],
    media: [img(`${U}photo-1636023730877-233b9237d4ec`), img(`${U}photo-1719613959577-434f93b266d7`)],
    happened_on: "2026-07-30",
  },
];

for (const s of STORIES) {
  const existing = await api(`collab_stories?title=eq.${encodeURIComponent(s.title)}&select=id`);
  if (existing.length) { console.log(`skip (exists): ${s.title.slice(0, 48)}`); continue; }
  const author = need(s.author);
  const credits = s.credits.map((c) => ({
    name: c.name, role: c.role,
    user_id: people[c.name]?.user_id ?? null,   // null = collaborator not on Melange
  }));
  const [row] = await api("collab_stories", { method: "POST", body: JSON.stringify({
    author_id: author.user_id, title: s.title, story: s.story,
    media_urls: s.media, credits, happened_on: s.happened_on, is_public: true,
  })});
  const linked = credits.filter((c) => c.user_id).length;
  console.log(`created: ${s.title.slice(0, 48)} (${credits.length} credits, ${linked} linked)`);
}
console.log("done");
