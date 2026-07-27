import fs from "fs";
import path from "path";
import type { ConfigContext, ExpoConfig } from "expo/config";

/** Load mobile/.env so EXPO_PUBLIC_* are set for dev and EAS local builds. */
function loadDotEnv(filename: string) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv(".env");

const appJson = require("./app.json") as { expo: ExpoConfig };

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    // Baked in at build time so native runs always see Supabase (not just Metro).
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
