import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import {
  getMatches,
  isMatchUnread,
  markMatchRead,
  type MatchWithPost,
  type Message,
} from "./db";

type Ctx = {
  matches: MatchWithPost[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (matchId: string) => Promise<void>;
};

const MatchesCtx = createContext<Ctx>({
  matches: [],
  unreadCount: 0,
  loading: true,
  error: null,
  refresh: async () => {},
  markRead: async () => {},
});

export function MatchesProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [matches, setMatches] = useState<MatchWithPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const { data, error: err } = await getMatches(userId);
    if (err) setError(err);
    else if (data) setMatches(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    refresh();
  }, [userId, refresh]);

  // Realtime: new matches involving me + new messages in my matches.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`matches-feed-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches", filter: `user1_id=eq.${userId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches", filter: `user2_id=eq.${userId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          setMatches((prev) => {
            const idx = prev.findIndex((m) => m.id === msg.match_id);
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], last_message: msg };
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const markRead = useCallback(
    async (matchId: string) => {
      if (!userId) return;
      const nowIso = new Date().toISOString();
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, last_read_at: nowIso } : m))
      );
      await markMatchRead(matchId, userId);
    },
    [userId]
  );

  const unreadCount = useMemo(() => {
    if (!userId) return 0;
    return matches.filter((m) => isMatchUnread(m, userId)).length;
  }, [matches, userId]);

  const value: Ctx = { matches, unreadCount, loading, error, refresh, markRead };
  return <MatchesCtx.Provider value={value}>{children}</MatchesCtx.Provider>;
}

export function useMatches() {
  return useContext(MatchesCtx);
}
