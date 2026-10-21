import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { useAuth } from "./auth";
import { isMember } from "./scenes";

type MembershipState = {
  /**
   * true: in. false: signed in without a code, so the invite gate shows.
   * null: not known yet.
   */
  member: boolean | null;
  refresh: () => Promise<void>;
  /** Set straight after a redeem, so the gate opens without another round trip. */
  markMember: () => void;
};

const MembershipCtx = createContext<MembershipState>({
  member: null,
  refresh: async () => {},
  markMember: () => {},
});

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [member, setMember] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMember(null);
      return;
    }
    const res = await isMember();
    // A failed check opens the door rather than shutting it. The server
    // doesn't gate data on membership, so a network blip locking every
    // grandfathered member behind the invite screen (or leaving someone who
    // just signed in stuck on the login form) is the worse error. An answer
    // we already have is kept; the next foreground asks again.
    if (res.error) {
      console.warn("is_member failed", res.error);
      setMember((m) => m ?? true);
      return;
    }
    setMember(res.member);
  }, [userId]);

  useEffect(() => {
    setMember(null);
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const markMember = useCallback(() => setMember(true), []);

  return (
    <MembershipCtx.Provider value={{ member, refresh, markMember }}>{children}</MembershipCtx.Provider>
  );
}

export function useMembership() {
  return useContext(MembershipCtx);
}
