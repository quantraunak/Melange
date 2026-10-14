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
 * Record one product event.
 *
 * This wrote nothing for the entire life of the web app, for the same reason
 * the iPhone app did not: the `void` in front of the call. supabase-js returns
 * a lazy builder, not a promise, and the HTTP request is only issued when
 * something subscribes to it with `.then()`. `void supabase.rpc(...)`
 * constructed the builder and threw it away, so nothing was ever sent. It read
 * as deliberate fire-and-forget and was in fact fire-and-nothing. The iPhone
 * copy of this function was fixed; this one was missed.
 *
 * Still fire-and-forget by design — no screen should wait on analytics or fail
 * because of it — but the request now actually goes out.
 */
export function trackEvent(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean | null> = {}
): void {
  supabase
    .rpc("track_event", { p_event_name: event, p_properties: properties })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn(`analytics: ${event} failed — ${error.message}`);
      }
    });
}
