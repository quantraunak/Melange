import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * Signed-out reads for the public pages (/@handle, /s/[id]), called from
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
