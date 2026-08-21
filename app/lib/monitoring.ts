/**
 * Error reporting.
 *
 * Melange shipped for months with no alerting: when something broke, the only
 * signal was a user complaining — and with ~zero users, that meant no signal at
 * all. A security hole in the push service sat live until someone happened to
 * re-test the flow by hand.
 *
 * Sentry is disabled automatically when NEXT_PUBLIC_SENTRY_DSN is unset, so
 * local dev and CI stay quiet and no build depends on the account existing.
 * Set the DSN in Vercel to turn real alerting on.
 */

import * as Sentry from "@sentry/nextjs";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
export const isMonitoringEnabled = Boolean(SENTRY_DSN);

/**
 * Report a caught error. Use this anywhere a `catch` block would otherwise
 * swallow a failure and leave the user staring at a spinner.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (isMonitoringEnabled) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
    return;
  }

  // Without a DSN, still make the failure loud and structured rather than
  // letting it vanish into a rejected promise.
  console.error("[melange]", error, context ?? "");
}

/** Attach a user to subsequent events, so an error is traceable to an account. */
export function identifyUser(userId: string | null): void {
  if (!isMonitoringEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
