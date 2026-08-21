import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True only when both env vars are actually present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// `next build` prerenders client components, which constructs this client at
// build time. With empty strings createClient throws "supabaseUrl is required"
// and the build dies — that was every red Web CI run. Placeholders keep the
// build honest; real values still come from the environment at runtime.
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local and fill them in — the app cannot reach the database."
  );
}

export const supabase = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseAnonKey || PLACEHOLDER_KEY
);
