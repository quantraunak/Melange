import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * Signed-out reads for the public pages (/@handle, /s/[id], /n/[id], and the
 * landing page's weekly theme), called from
 * server components with the anon key and no session, so these pages see
 * exactly what a stranger would — the RPCs are SECURITY DEFINER and decide
 * what's public.
 *
 * Each fetcher returns null when the thing doesn't exist (the RPC returns
 * NULL for unknown handles, members without a handle, and private shoots),
 * and throws on a real error, so an outage shows the error page instead of
 * pretending the profile isn't there.
 */

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set; public pages can't read the database.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type PublicShoot = { id: string; title: string | null; cover_url: string | null };

export type PublicProfile = {
  user_id: string;
  handle: string;
  name: string | null;
  role: string | null;
  bio: string | null;
  avatar_url: string | null;
  portfolio_urls: string[];
  scene: string | null;
  founding: boolean;
  instagram_url: string | null;
  confirmed_credits: number;
  shoots: PublicShoot[];
};

export type SharedCredit = {
  name: string | null;
  role: string | null;
  user_id: string | null;
  avatar_url: string | null;
  confirmed: boolean;
};

export type SharedStory = {
  id: string;
  title: string | null;
  story: string | null;
  media_urls: string[] | null;
  happened_on: string | null;
  author: { user_id: string; name: string | null; role: string | null; avatar_url: string | null };
  credits: SharedCredit[];
};

const HANDLE_RE = /^[a-z0-9._]{3,30}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "@Jane.Doe" / "%40jane.doe" → "jane.doe", or null if it can't be a handle. */
export function normalizeHandle(raw: string): string | null {
  let h = raw;
  try {
    h = decodeURIComponent(raw);
  } catch {
    return null;
  }
  h = h.trim().replace(/^@+/, "").toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
}

export const getPublicProfile = cache(async (rawHandle: string): Promise<PublicProfile | null> => {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return null;
  const { data, error } = await anonClient().rpc("get_public_profile", { p_handle: handle });
  if (error) throw new Error(`get_public_profile failed: ${error.message}`);
  if (!data) return null;
  const p = data as PublicProfile;
  return {
    ...p,
    portfolio_urls: (p.portfolio_urls ?? []).filter(Boolean),
    shoots: p.shoots ?? [],
    confirmed_credits: Number(p.confirmed_credits ?? 0),
    founding: Boolean(p.founding),
  };
});

export const getSharedStory = cache(async (id: string): Promise<SharedStory | null> => {
  // The RPC takes a UUID; anything else would come back as a cast error,
  // which is "not found", not an outage.
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await anonClient().rpc("get_shared_story", { p_story: id });
  if (error) throw new Error(`get_shared_story failed: ${error.message}`);
  if (!data) return null;
  const s = data as SharedStory;
  return { ...s, media_urls: (s.media_urls ?? []).filter(Boolean), credits: s.credits ?? [] };
});

export type SharedEventPerson = { name: string | null; avatar_url: string | null };

export type SharedEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location_name: string | null;
  cover_url: string | null;
  scene: string | null;
  capacity: number | null;
  host: SharedEventPerson | null;
  going_count: number;
  /** The first 12 going, in RSVP order: first name and photo only. */
  going: SharedEventPerson[];
};

/** Shape what get_shared_event returns. Exported for the tests. */
export function normalizeSharedEvent(raw: SharedEvent): SharedEvent {
  const going = (raw.going ?? []).slice(0, 12);
  const count = Number(raw.going_count ?? 0);
  return {
    ...raw,
    title: raw.title?.trim() || "An event on Melange",
    description: raw.description?.trim() || null,
    location_name: raw.location_name?.trim() || null,
    cover_url: raw.cover_url || null,
    host: raw.host?.name ? raw.host : null,
    // Never claim fewer going than the faces on the page.
    going_count: Number.isFinite(count) ? Math.max(count, going.length) : going.length,
    going,
  };
}

/** Nights happen in the California scenes; show their local time to everyone. */
export const NIGHT_TIME_ZONE = "America/Los_Angeles";

/** "Fri, Oct 24 · 8:00 PM" (Pacific), with " – 11:00 PM" when it ends the same day. */
export function formatNightWhen(startAt: string, endAt?: string | null): string | null {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return null;
  const day = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: NIGHT_TIME_ZONE,
  });
  const time = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: NIGHT_TIME_ZONE });
  const end = endAt ? new Date(endAt) : null;
  const ymd = (d: Date) => d.toLocaleDateString("en-US", { timeZone: NIGHT_TIME_ZONE });
  if (end && !Number.isNaN(end.getTime()) && end > start && ymd(end) === ymd(start)) {
    return `${day} · ${time(start)} – ${time(end)}`;
  }
  return `${day} · ${time(start)}`;
}

/** "N going · <date> · <place>", for link previews. */
export function sharedEventSummary(e: SharedEvent): string {
  const start = new Date(e.start_at);
  const day = Number.isNaN(start.getTime())
    ? null
    : start.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: NIGHT_TIME_ZONE,
      });
  return [`${e.going_count} going`, day, e.location_name].filter(Boolean).join(" · ");
}

export const getSharedEvent = cache(async (id: string): Promise<SharedEvent | null> => {
  // Same as getSharedStory: a non-UUID is "not found", not an outage.
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await anonClient().rpc("get_shared_event", { p_event: id });
  if (error) throw new Error(`get_shared_event failed: ${error.message}`);
  if (!data) return null;
  return normalizeSharedEvent(data as SharedEvent);
});

export type WeeklyTheme = {
  id: string;
  title: string;
  prompt: string | null;
  starts_on: string;
  posts: number;
};

/** This week's theme (current_theme()), or null before the first one exists. */
export const getCurrentTheme = cache(async (): Promise<WeeklyTheme | null> => {
  const { data, error } = await anonClient().rpc("current_theme");
  if (error) throw new Error(`current_theme failed: ${error.message}`);
  if (!data) return null;
  const t = data as WeeklyTheme;
  return { ...t, posts: Number(t.posts ?? 0) };
});
