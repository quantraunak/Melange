import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Saying yes to a night from its share page, without the app.
 * rsvp_by_link (25_web_rsvp_and_night_photos.sql) is granted to anon and
 * raises plain-English exceptions ("This night is full.", "That email
 * doesn't look right.", ...), so on failure we show the server's message.
 * Success is only ever reported when the RPC says `ok: true`.
 */

export type WebRsvpResult = { ok: true; hasAccount: boolean } | { ok: false; error: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FALLBACK = "That didn't go through. Please try again.";

type RpcClient = Pick<SupabaseClient, "rpc">;

export async function rsvpByLink(
  client: RpcClient,
  eventId: string,
  firstName: string,
  lastName: string,
  email: string,
): Promise<WebRsvpResult> {
  const first = firstName.trim();
  const name = [first, lastName.trim()].filter(Boolean).join(" ");
  const cleanEmail = email.trim();
  // Same checks the server makes, so the common mistakes don't need a round trip.
  if (!first) return { ok: false, error: "Add your first name." };
  if (!EMAIL_RE.test(cleanEmail)) return { ok: false, error: "That email doesn't look right." };

  let data: unknown;
  try {
    const res = await client.rpc("rsvp_by_link", { p_event: eventId, p_name: name, p_email: cleanEmail });
    if (res.error) return { ok: false, error: res.error.message || FALLBACK };
    data = res.data;
  } catch {
    return { ok: false, error: "Couldn't reach Melange. Check your connection and try again." };
  }

  const d = data as { ok?: unknown; has_account?: unknown } | null;
  if (!d || d.ok !== true) return { ok: false, error: FALLBACK };
  return { ok: true, hasAccount: d.has_account === true };
}

/**
 * Has the night ended? Mirrors the server's rule in rsvp_by_link: end_at,
 * or six hours after the start when there's no end time.
 */
export function nightHasEnded(startAt: string, endAt: string | null, now: Date = new Date()): boolean {
  const end = endAt ? new Date(endAt) : new Date(new Date(startAt).getTime() + 6 * 60 * 60 * 1000);
  const t = end.getTime();
  if (Number.isNaN(t)) return false;
  return t < now.getTime();
}
