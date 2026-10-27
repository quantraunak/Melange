import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";

import { NightCard } from "@/components/NightCard";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth";
import { getProfile } from "@/lib/db";
import type { EventWithDetails } from "@/lib/events";
import { getAfterglowNights, getNights, type NightWithFaces } from "@/lib/nights";
import { sceneLabel } from "@/lib/scenes";
import { colors, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { useBarTop } from "./_layout";

/**
 * Nights: where the scene meets. Upcoming nights in your scene, or
 * everywhere; and, for three days after a night you went to, a way back to
 * it for Afterglow.
 */
export default function NightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const barTop = useBarTop();
  const { userId } = useAuth();

  const [myScene, setMyScene] = useState<string | null>(null);
  /** null until the profile answers, so the first load asks for the right scope. */
  const [scope, setScope] = useState<"scene" | "all" | null>(null);
  const [nights, setNights] = useState<NightWithFaces[]>([]);
  const [afterglow, setAfterglow] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef(0);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    (async () => {
      const { data, error: err } = await getProfile(userId);
      if (!live) return;
      // Without the profile we don't know the scene; every scene is a list
      // that still works, where waiting on a failed read would spin forever.
      if (err) console.warn("nights: getProfile failed", err);
      const scene = data?.scene ?? null;
      setMyScene(scene);
      setScope(scene ? "scene" : "all");
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId || !scope) return;
    // A slow "All" must not land on top of a faster "USC" the reader switched to.
    const run = ++runRef.current;
    setError(null);
    const [n, a] = await Promise.all([
      getNights(userId, scope === "scene" ? myScene : null),
      getAfterglowNights(userId),
    ]);
    if (run !== runRef.current) return;
    setNights(n.data);
    setAfterglow(a.data);
    setError(n.error ?? a.error);
    setLoading(false);
    setRefreshing(false);
  }, [userId, scope, myScene]);

  useEffect(() => {
    load();
  }, [load]);

  // Hosting a night pushes a modal and comes back here; reload so it shows.
  // Read through a ref: this callback is memoized on [load], so a plain
  // `loading` here is the value from the first render (true) forever, and the
  // reload on focus never ran.
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useFocusEffect(
    useCallback(() => {
      if (!loadingRef.current) load();
    }, [load])
  );

  const label = sceneLabel(myScene);
  const open = (id: string) => router.push({ pathname: "/event/[id]", params: { id } });

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.sm, paddingBottom: barTop + spacing.xl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.textSecondary}
          />
        }
      >
        <ScreenTitle title="Events" action={{ label: "Host", onPress: () => router.push("/event/new"), accessibilityLabel: "Host an event" }} />

        {label ? (
          <ChipRow>
            <Chip label={label} selected={scope === "scene"} onPress={() => setScope("scene")} />
            <Chip label="All" selected={scope === "all"} onPress={() => setScope("all")} />
          </ChipRow>
        ) : null}

        <ErrorBanner message={error} />

        {afterglow.length ? (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>Afterglow</Text>
            {afterglow.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => open(e.id)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.glowRow, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.glowTitle} numberOfLines={1}>
                    {e.title}
                  </Text>
                  <Text style={styles.glowMeta}>Heart anyone you&apos;d like to see again</Text>
                </View>
                <ChevronRight size={16} color={colors.iconFaint} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {loading ? (
          <View style={{ gap: spacing.lg }}>
            <Skeleton height={260} radius={radii.lg} />
            <Skeleton height={260} radius={radii.lg} />
          </View>
        ) : nights.length === 0 ? (
          <View style={styles.empty}>
            {/* One action. "See every scene" was a second one, and the All
                chip right above already does it. */}
            <Text style={styles.emptyTitle}>
              {scope === "scene" && label ? `No events in ${label} yet` : "No events coming up"}
            </Text>
            <Text style={styles.emptyBody}>
              Host one: pick a time and a place, say what to bring. Everyone who says they&apos;re going
              gets a group chat.
            </Text>
            <Button title="Host an event" variant="primary" onPress={() => router.push("/event/new")} />
          </View>
        ) : (
          <View style={{ gap: spacing.lg }}>
            {nights.map((n) => (
              <NightCard key={n.id} night={n} showScene={scope === "all"} onPress={() => open(n.id)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: GUTTER, gap: spacing.lg },
  section: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow },
  glowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  glowTitle: { ...typography.bodyStrong },
  glowMeta: { ...typography.caption },
  empty: { alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.display2 },
  emptyBody: { ...typography.body, color: colors.textSecondary },
});
