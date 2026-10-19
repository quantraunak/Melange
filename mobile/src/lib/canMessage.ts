import { useCallback, useEffect, useState } from "react";

import { supabase } from "./supabase";

/**
 * Whether this person can actually be messaged, asked of the database.
 *
 * `can_message()` has existed since 17_audit_fixes.sql and nothing in the app
 * ever called it, so every Message button everywhere was a button that might
 * fail. Raunak hit this on an event page: he and John blocked each other back
 * in August while testing, the button rendered anyway, and pressing it
 * produced "You can't message this person." after he had already written
 * something.
 *
 * The server applies three rules we cannot see from here: a block in either
 * direction, whether a thread or a heart already exists, and the cold-approach
 * floor. Guessing at them in the client is how the two drift apart, so we ask.
 *
 * `null` means we do not know yet. Callers should keep the button out of the
 * way rather than render it as available.
 */
export function useCanMessage(otherUserId: string | null | undefined): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);

  const check = useCallback(() => {
    if (!otherUserId) {
      setOk(null);
      return;
    }
    let alive = true;
    supabase
      .rpc("can_message", { p_other: otherUserId })
      .then(({ data, error }) => {
        if (!alive) return;
        // A database without the function is not a reason to hide the button;
        // the old behaviour (try, and surface the server's refusal) is better
        // than silently removing the only way to reach someone.
        if (error) {
          setOk(/does not exist|schema cache/i.test(error.message) ? true : null);
          return;
        }
        setOk(data === true);
      });
    return () => {
      alive = false;
    };
  }, [otherUserId]);

  useEffect(check, [check]);

  return ok;
}
