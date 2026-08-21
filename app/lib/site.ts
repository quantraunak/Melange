/**
 * Single source of truth for marketing-site facts.
 *
 * IOS_LIVE is the one to flip: it is `false` while the app sits in App Store
 * review, which turns every download button into an honest "coming soon"
 * instead of a link to a 404. Flip it to `true` the moment Apple approves.
 */

export const IOS_LIVE = false;

/** App Store Connect ascAppId 6774481477, bundle com.melange.app */
export const APP_STORE_URL = "https://apps.apple.com/app/id6774481477";

export const WEB_APP_PATH = "/app";

export const SUPPORT_EMAIL = "support@melange.app";

export const SITE = {
  name: "Melange",
  tagline: "Where creative people find their next collaboration.",
  description:
    "Photographers, models, makeup artists, stylists and filmmakers post what they're working on, match with each other, and plan the shoot.",
  url: "https://melange-psi.vercel.app",
} as const;
