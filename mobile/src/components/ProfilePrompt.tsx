import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

import { getProfile, profileGate, PROFILE_MIN_IMAGES } from "@/lib/db";

export type ProfileFloorGap = {
  /** One line saying exactly what is missing. */
  line: string;
  photosNeeded: number;
  needsRole: boolean;
};

/**
 * Tells someone their profile is below the floor BEFORE they hit it.
 *
 * The quality floor — three photos and a role before you can post or like —
 * was enforced only at the moment of action. You swiped, and a single line
 * appeared telling you to add three photos. The only way to find out was to
 * be refused, and the refusal arrived exactly when you were trying to do
 * something else.
 *
 * Every real person on Melange except the owner started below it, and none of
 * them saw an onboarding step that asked for photos. So this is checked on
 * every screen focus and every time the app comes back to the foreground: the
 * warning goes away the moment the profile is fixed, and not before.
 */
export function useProfileFloor(userId: string | null): ProfileFloorGap | null {
  const [gap, setGap] = useState<ProfileFloorGap | null>(null);

  const check = useCallback(() => {
    if (!userId) {
      setGap(null);
      return;
    }
    let alive = true;
    getProfile(userId)
      .then(({ data }) => {
        if (!alive || !data) return;
        if (profileGate(data, "like").ok) {
          setGap(null);
          return;
        }
        const photos = data.portfolio_urls?.length ?? 0;
        const photosNeeded = Math.max(0, PROFILE_MIN_IMAGES - photos);
        const needsRole = !data.role?.trim();
        const parts = [
          photosNeeded > 0 ? `add ${photosNeeded} more photo${photosNeeded === 1 ? "" : "s"}` : null,
          needsRole ? "pick a role" : null,
        ].filter(Boolean);
        const what = parts.join(" and ");
        setGap({
          line: `You can't post or like anything until you ${what}.`,
          photosNeeded,
          needsRole,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(check, [check]);
  // Re-check on focus so the warning disappears as soon as they come back from
  // adding photos, instead of lingering and implying it did not work.
  useFocusEffect(check);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, [check]);

  return gap;
}

/** Just the line, for screens that only need to say it. */
export function useProfileGap(userId: string | null): string | null {
  return useProfileFloor(userId)?.line ?? null;
}
