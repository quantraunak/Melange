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
