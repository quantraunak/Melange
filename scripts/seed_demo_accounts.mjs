/**
 * Create App Store reviewer + second test user for match demos.
 *
 * Usage (reads .env.local for Supabase URL + anon key):
 *   node scripts/seed_demo_accounts.mjs
 *
 * Requires email confirmation OFF in Supabase Auth settings,
 * or accounts stay unconfirmed.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, anon);

const ACCOUNTS = [
  {
    email: "review@melange.app",
    password: "ReviewMelange2026!",
    profile: {
      name: "App Review",
      role: "Photographer",
      bio: "Demo account for App Store review.",
      skills: ["Portrait", "Editorial"],
      current_project: "City portrait series",
    },
    post: {
      title: "Looking for models — editorial portrait series",
      description: "Weekend shoots in the city. TFP, portfolio building.",
      looking_for: ["Model"],
      location: "New York",
    },
  },
  {
    email: "demo2@melange.app",
    password: "DemoMelange2026!",
    profile: {
      name: "Jordan Demo",
      role: "Model",
      bio: "Second test account for mutual match demos.",
      skills: ["Editorial", "Fashion"],
      current_project: "Building portfolio",
    },
    post: {
      title: "Model available for photographers",
      description: "Experienced with editorial and street style.",
      looking_for: ["Photographer"],
      location: "New York",
    },
  },
];

async function ensureUser(acc) {
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: acc.email,
    password: acc.password,
  });

  let userId = signIn?.user?.id;

  if (signInErr || !userId) {
    const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
      email: acc.email,
      password: acc.password,
    });
    if (signUpErr) {
      console.error(`Failed ${acc.email}:`, signUpErr.message);
      return null;
    }
    userId = signUp.user?.id;
    if (!userId) {
      console.error(`No user id for ${acc.email} — check email confirmation settings.`);
      return null;
    }
    console.log(`Created auth user: ${acc.email}`);
  } else {
    console.log(`Signed in existing: ${acc.email}`);
  }

  const { error: profErr } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      name: acc.profile.name,
      role: acc.profile.role,
      bio: acc.profile.bio,
      skills: acc.profile.skills,
      current_project: acc.profile.current_project,
      vibes: ["Portrait", "Editorial"],
    },
    { onConflict: "user_id" }
  );
  if (profErr) console.error(`Profile ${acc.email}:`, profErr.message);

  const { data: existing } = await supabase
    .from("collab_posts")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);

  if (!existing?.length) {
    const { error: postErr } = await supabase.from("collab_posts").insert({
      owner_id: userId,
      title: acc.post.title,
      description: acc.post.description,
      looking_for: acc.post.looking_for,
      location: acc.post.location,
      is_active: true,
    });
    if (postErr) console.error(`Post ${acc.email}:`, postErr.message);
    else console.log(`  + demo post for ${acc.email}`);
  }

  return userId;
}

console.log("Seeding demo accounts...\n");
for (const acc of ACCOUNTS) {
  await ensureUser(acc);
}
console.log("\nDone. Reviewer: review@melange.app / ReviewMelange2026!");
console.log("Match demo: sign in as review, swipe right on demo2's post (or vice versa).");
