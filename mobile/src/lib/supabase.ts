import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra?.EXPO_PUBLIC_SUPABASE_URL;
const anon =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // We throw early so a misconfigured build is obvious in the simulator.
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy mobile/.env.example to mobile/.env and fill them in."
  );
}

/**
 * Exported because uploads do not go through supabase-js. The storage client
 * reads the whole file into memory as base64 before sending it, which stalls
 * the JS thread on a full-resolution phone photo; `uploadFile` in db.ts streams
 * the file natively against the storage REST endpoint instead, and needs the
 * project URL and anon key to address it.
 */
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anon;

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the auth session whenever the app returns to foreground.
// Recommended by Supabase for React Native.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
