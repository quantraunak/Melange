/**
 * "This session began with a signup on this phone", so the root gate sends
 * the new account to the optional photos step instead of straight to
 * Discover.
 *
 * In memory on purpose. Someone who kills the app on the photos step gets
 * Discover next launch, which is right: the step is an offer, not a gate,
 * and a flag on disk could bring it back weeks later after a sign-out.
 */
let freshSignup = false;

export function markFreshSignup(): void {
  freshSignup = true;
}

export function isFreshSignup(): boolean {
  return freshSignup;
}

/** Called once the photos step is on screen, so nothing routes there twice. */
export function clearFreshSignup(): void {
  freshSignup = false;
}
