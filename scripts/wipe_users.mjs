/**
 * Wipes ALL users + public-schema data + storage media from Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/wipe_users.mjs
 *
 * Notes:
 *   - The service role key is a god-mode secret. Do not commit it.
 *     This script reads it from env vars at runtime only.
 *   - Deleting auth.users cascades to all public tables (profiles,
 *     posts, swipes, matches, messages, blocks, reports, push_tokens,
 *     match_reads), since every FK uses ON DELETE CASCADE.
 *   - We separately list-and-remove all files from the 'media' bucket
 *     because storage objects don't cascade with auth.users.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supa = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function deleteAllUsers() {
  let totalDeleted = 0;
  let page = 1;
  while (true) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("listUsers error:", error.message);
      break;
    }
    if (!data?.users?.length) break;

    for (const u of data.users) {
      const { error: delErr } = await supa.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.error(`  failed to delete ${u.email}:`, delErr.message);
      } else {
        totalDeleted += 1;
        console.log(`  deleted user: ${u.email || u.id}`);
      }
    }

    if (data.users.length < 200) break;
    page += 1;
  }
  console.log(`\nTotal users deleted: ${totalDeleted}`);
  return totalDeleted;
}

async function listStorageRecursive(bucket, prefix = "") {
  const all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supa.storage.from(bucket).list(prefix, {
      limit,
      offset,
    });
    if (error) {
      console.error(`storage list error at "${prefix}":`, error.message);
      break;
    }
    if (!data?.length) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders have a null id in Supabase storage listings.
      if (item.id === null || item.id === undefined) {
        const sub = await listStorageRecursive(bucket, path);
        all.push(...sub);
      } else {
        all.push(path);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

async function clearStorage() {
  const files = await listStorageRecursive("media");
  console.log(`Found ${files.length} files in 'media' bucket.`);
  if (files.length === 0) return 0;
  // Supabase storage.remove handles batches well; chunk to be safe.
  const chunkSize = 100;
  let removed = 0;
  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);
    const { error } = await supa.storage.from("media").remove(chunk);
    if (error) {
      console.error(`  storage remove error on chunk ${i}:`, error.message);
    } else {
      removed += chunk.length;
    }
  }
  console.log(`Removed ${removed} storage files.`);
  return removed;
}

async function verify() {
  // Use the REST/PostgREST surface with the service-role key for a quick
  // sanity check on a couple of public tables.
  const tables = ["profiles", "collab_posts", "matches", "messages"];
  console.log("\nLeftover row counts (should all be 0):");
  for (const t of tables) {
    const { count, error } = await supa
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ${t}: <error: ${error.message}>`);
    } else {
      console.log(`  ${t}: ${count}`);
    }
  }
}

(async () => {
  console.log(`Project: ${url}`);
  console.log("Step 1: deleting all auth users (cascades to public tables)...\n");
  await deleteAllUsers();
  console.log("\nStep 2: clearing 'media' storage bucket...");
  await clearStorage();
  console.log("\nStep 3: verifying...");
  await verify();
  console.log("\nDone.");
})().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
