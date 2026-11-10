import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { claimIntroNudge, getMyIntros, introMakes, lookingForText, type Intro } from "@/lib/intros";

/**
 * Your matches: people the Melange team paired you with by hand, newest first.
 *
 * Only matches the team has marked sent ever reach this screen. From a match
 * you can open their profile and message them through the normal composer
 * (which goes straight to the chat if you already have one). After you've
 * looked at your first match, a one-time prompt invites you to explore
 * everyone else.
 */
export default function YourMatchesScreen() {
  const router = useRouter();
  const [intros, setIntros] = useState<Intro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  // Set when they open a match (profile or message). Coming back to this
  // screen afterwards is when the one-time "meet more people" prompt shows.
  const openedOne = useRef(false);

  const load = useCallback(async () => {
    const { data, error: err } = await getMyIntros();
    setIntros(data);
    setError(err);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      if (openedOne.current) {
        openedOne.current = false;
        claimIntroNudge().then((first) => {
          if (first) setNudge(true);
        });
      }
    }, [load])
  );

  const open = (path: () => void) => {
    openedOne.current = true;
    path();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Your matches</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
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
        <ErrorBanner message={error} />

        {loading ? (
          <ActivityIndicator color={colors.textSecondary} style={{ marginTop: spacing.xl }} />
        ) : intros.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>We&apos;re finding your match.</Text>
            <Text style={styles.emptyBody}>
              You&apos;ll hear from us within 2 weeks. In the meantime, explore other creatives.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
              onPress={() => router.push("/(tabs)/stories")}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Explore</Text>
            </Pressable>
          </View>
        ) : (
          intros.map((m) => {
            const makes = introMakes(m);
            return (
              <View key={m.intro_id} style={styles.card}>
                <View style={styles.who}>
                  <Avatar creator={{ name: m.other_name, avatar_url: m.other_avatar }} size="lg" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.other_name}</Text>
                    {makes ? <Text style={styles.makes}>Makes {makes}</Text> : null}
                  </View>
                </View>

                {m.note ? (
                  <View style={styles.block}>
                    <Text style={styles.label}>Why you two</Text>
                    <Text style={styles.body}>{m.note}</Text>
                  </View>
                ) : null}

                {lookingForText(m.other_looking_for) || m.other_looking_for_note ? (
                  <View style={styles.block}>
                    <Text style={styles.label}>Looking for</Text>
                    {lookingForText(m.other_looking_for) ? (
                      <Text style={styles.body}>{lookingForText(m.other_looking_for)}</Text>
                    ) : null}
                    {m.other_looking_for_note ? (
                      <Text style={styles.makes}>{m.other_looking_for_note}</Text>
                    ) : null}
                  </View>
                ) : null}

                {m.other_idea ? (
                  <View style={styles.block}>
                    <Text style={styles.label}>Their idea</Text>
                    <Text style={styles.body}>{m.other_idea}</Text>
                  </View>
                ) : null}

                {m.other_user_id ? (
                  <View style={styles.actions}>
                    <Pressable
                      style={({ pressed }) => [styles.primary, styles.flex, pressed && { opacity: 0.85 }]}
                      onPress={() =>
                        open(() =>
                          router.push({
                            pathname: "/message/[userId]",
                            params: { userId: m.other_user_id as string, origin: "profile", about: "Your match on Melange" },
                          })
                        )
                      }
                      accessibilityRole="button"
                    >
                      <Text style={styles.primaryText}>Message</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.secondary, styles.flex, pressed && { opacity: 0.7 }]}
                      onPress={() =>
                        open(() =>
                          router.push({ pathname: "/profile/[userId]", params: { userId: m.other_user_id as string } })
                        )
                      }
                      accessibilityRole="button"
                    >
                      <Text style={styles.secondaryText}>View profile</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.waiting}>
                    {m.other_name.split(" ")[0]} isn&apos;t on Melange yet. Once they join, you can message them here.
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={nudge} transparent animationType="fade" onRequestClose={() => setNudge(false)}>
        <View style={styles.scrim}>
          <View style={styles.modal} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>Want to meet more people?</Text>
            <Text style={styles.modalBody}>Make your portfolio and explore.</Text>
            <Pressable
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setNudge(false);
                router.push("/account/edit-profile");
              }}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Edit my profile</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
              onPress={() => {
                setNudge(false);
                router.push("/(tabs)/stories");
              }}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Explore</Text>
            </Pressable>
            <Pressable onPress={() => setNudge(false)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.later}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
  },
  title: { ...typography.headline, color: colors.text },
  scroll: { paddingHorizontal: GUTTER, paddingBottom: spacing.xxxl, gap: spacing.lg },
  empty: { gap: spacing.md, paddingTop: spacing.xl },
  emptyTitle: { ...typography.title, color: colors.text },
  emptyBody: { ...typography.body, color: colors.textSecondary },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  who: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { ...typography.title, color: colors.text },
  makes: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  block: { gap: 2 },
  label: { ...typography.eyebrow, color: colors.textSecondary },
  body: { ...typography.body, color: colors.text },
  actions: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  primary: {
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
  },
  primaryText: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.onBrand },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  secondaryText: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.text },
  waiting: { ...typography.caption, color: colors.textSecondary },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: GUTTER * 2,
  },
  modal: {
    width: "100%",
    maxWidth: 380,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  modalTitle: { ...typography.title, color: colors.text },
  modalBody: { ...typography.body, color: colors.textSecondary },
  later: { ...typography.caption, color: colors.textSecondary, alignSelf: "center", paddingVertical: spacing.xs },
});
