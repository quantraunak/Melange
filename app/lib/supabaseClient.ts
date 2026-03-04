import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// TODO: remove after signup is working
const keyLooksLikeJwt = supabaseAnonKey.startsWith("eyJ");
console.log(
  "[supabase] url:", supabaseUrl,
  "| key defined:", !!supabaseAnonKey,
  "| key is JWT:", keyLooksLikeJwt
);
if (!keyLooksLikeJwt && supabaseAnonKey) {
  console.warn(
    "[supabase] Anon key does NOT look like a JWT (expected eyJ…).",
    "Go to Supabase Dashboard → Settings → API → Project API keys and copy the 'anon / public' JWT key."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
