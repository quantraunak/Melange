import { supabase } from "./supabaseClient";

export type AnalyticsEvent =
  | "signup_completed"
  | "login"
  | "profile_saved"
  | "post_created"
  | "swipe_left"
  | "swipe_right"
  | "match_created"
  | "message_sent"
  | "review_submitted"
  | "event_rsvp"
  | "event_created";

/**
 * Server-side product analytics (Supabase `track_event` RPC).
 * Fire-and-forget — never blocks UX on failure.
 */
export function trackEvent(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean | null> = {}
): void {
  void supabase.rpc("track_event", {
    p_event_name: event,
    p_properties: properties,
  });
}
