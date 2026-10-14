import { supabase } from "./supabase";

export type AnalyticsEvent =
  | "signup_completed"
  | "login"
  | "profile_saved"
  | "post_created"
  | "swipe_left"
  | "swipe_right"
  | "swipe_undo"
  | "match_created"
  | "message_sent"
  | "review_submitted"
  | "event_rsvp"
  | "event_created"
  | "conversation_started";

/**
 * Record one product event.
 *
 * This wrote nothing for the entire life of the app. The whole table held a
 * single row, from 2026-05-25, with no user on it.
 *
 * The cause was the `void` in front of the call. supabase-js returns a lazy
 * builder, not a promise: the HTTP request is only issued when something
 * subscribes to it with `.then()`. Writing `void supabase.rpc(...)` constructs
 * the builder and throws it away, so the request was never sent. It looked
 * like deliberate fire-and-forget and it was in fact fire-and-nothing.
 * Confirmed against production both ways: discarded with `void`, zero rows;
 * with `.then()`, one row.
 *
 * It is still fire-and-forget by design, because no screen should wait on
 * analytics or fail because of it. But the request now actually goes out, and
 * a failure is logged in development rather than vanishing.
 */
export function trackEvent(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean | null> = {}
): void {
  supabase
    .rpc("track_event", { p_event_name: event, p_properties: properties })
    .then(({ error }) => {
      if (error && __DEV__) {
        console.warn(`analytics: ${event} failed — ${error.message}`);
      }
    });
}
