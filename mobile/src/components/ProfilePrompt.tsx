import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getProfile, profileGate, PROFILE_MIN_IMAGES } from "@/lib/db";

/**
 * Tells someone their profile is below the floor BEFORE they hit it.
 *
 * The quality floor — three photos and a role before you can post or like —
 * was enforced only at the moment of action. You swiped, and a single line
 * appeared telling you to add three photos. The only way to find out was to
 * be refused, and the refusal arrived exactly when you were trying to do
 * something else.
 *
 * That was survivable while the floor was new and applied only to new
 * accounts. It is not survivable now: every real person on Melange except the
 * owner is below it. Two have no photos at all and one has a single photo, and
 * none of them ever saw an onboarding step that asked for any. Shipping a
 * consistent gate without this would have quietly locked out the whole user
 * base and mentioned it only when they next tried to use the app.
 *
 * This is a hook rather than a component so the screen can decide where it
 * sits relative to the other things competing for the same slot.
 */
export function useProfileGap(userId: string | null): string | null {
  const [line, setLine] = useState<string | null>(null);

  const check = useCallback(() => {
    if (!userId) {
      setLine(null);
      return;
    }
    let alive = true;
    getProfile(userId)
      .then(({ data }) => {
        if (!alive || !data) return;
        if (profileGate(data, "like").ok) {
          setLine(null);
          return;
        }
        const photos = data.portfolio_urls?.length ?? 0;
        const need = PROFILE_MIN_IMAGES - photos;
        setLine(
          need > 0
            ? `Add ${need} more photo${need === 1 ? "" : "s"} so people can see your work.`
            : "Pick a role so people know what you do."
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(check, [check]);
  // Re-check on focus so the prompt disappears as soon as they come back from
  // adding photos, instead of lingering and implying it did not work.
  useFocusEffect(check);

  return line;
}
