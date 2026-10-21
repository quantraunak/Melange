/**
 * Single source of truth for marketing-site facts.
 *
 * IOS_LIVE is the one to flip: it is `false` while the app sits in App Store
 * review, which turns every download button into an honest "coming soon"
 * instead of a link to a 404. Flip it to `true` the moment Apple approves.
 *
 * It stayed `false` through 1.1, 1.2, 1.3 and 1.4 shipping. The landing page is
 * the marketingUrl on the App Store listing itself, and it contained no link to
 * the App Store at all: "iPhone app on the App Store" was rendered as plain
 * text. Verified 2026-10-14 — App Store Connect reports the app
 * READY_FOR_SALE with 1.4 live, and apps.apple.com/app/id6774481477 returns
 * 200. A version sitting in review (1.5) is not a reason to hide the live one.
 */

export const IOS_LIVE = true;

/** App Store Connect ascAppId 6774481477, bundle com.melange.app */
export const APP_STORE_URL = "https://apps.apple.com/app/id6774481477";

export const WEB_APP_PATH = "/app";

/**
 * Support is a form, not an address. It used to be support@melange.app, but
 * melange.app is a parked domain someone else owns, with a null MX record, so
 * nothing sent there was ever delivered. The form writes to support_requests
 * (21_trust_and_support.sql), which pushes to the admins.
 */
export const SUPPORT_PATH = "/support";

export const SITE = {
  name: "Melange",
  tagline: "Where young creatives find their crew — the people, the nights, the ideas.",
  description:
    "Melange is an invite-only app for young creatives in USC, UCSD and LA (NYC soon). Go to a night, find your people, and explore what your scene is making.",
  url: "https://melange-psi.vercel.app",
} as const;
