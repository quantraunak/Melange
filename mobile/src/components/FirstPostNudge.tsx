import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus, X } from "lucide-react-native";

import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { getMyPosts } from "@/lib/db";

/**
 * Whether this person has posted a project yet. Re-checked every time the
 * screen comes into focus, so the nudge goes away the moment they post.
 * `null` until known: nobody gets nudged on a guess.
 */
export function useHasPosted(userId: string | null): boolean | null {
  const [posted, setPosted] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let alive = true;
      getMyPosts(userId)
        .then(({ data }) => {
          if (alive && data) setPosted(data.length > 0);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [userId])
  );
  return posted;
}

/**
 * Getting the first people on: until you have posted a project, Discover asks
 * you to — a big card at the top, and a popup every time you open Discover.
 * Both stop for good once you have a post.
 */
export function FirstPostNudge({ posted, top }: { posted: boolean | null; top: number }) {
  const router = useRouter();
  const [cardHidden, setCardHidden] = useState(false);
  const [popup, setPopup] = useState(false);

  // Every time Discover comes into focus without a post: pop up again.
  useFocusEffect(
    useCallback(() => {
      setCardHidden(false);
      setPopup(true);
    }, [])
  );

  if (posted !== false) return null;

  const post = () => {
    setPopup(false);
    router.push("/post/new");
  };

  return (
    <>
      {!cardHidden ? (
        <View style={[styles.slot, { top }]} pointerEvents="box-none">
          <View style={styles.card}>
            <Pressable
              onPress={() => setCardHidden(true)}
              hitSlop={10}
              style={styles.close}
              accessibilityLabel="Hide for now"
            >
              <X size={16} color={colors.onBrandMuted} />
            </Pressable>
            <Text style={styles.title}>Post your first project</Text>
            <Text style={styles.body}>
              Tap the + at the top right. Say what you&apos;re making and who you need.
            </Text>
            <Pressable
              onPress={post}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
            >
              <Plus size={18} color={colors.brand} />
              <Text style={styles.btnText}>Post a project</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal visible={popup} transparent animationType="fade" onRequestClose={() => setPopup(false)}>
        <View style={styles.scrim}>
          <View style={styles.modal} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>Help us get Melange going</Text>
            <Text style={styles.modalBody}>
              Post a project so people can find you. It takes a minute: a title, a photo or two, and
              who you&apos;re looking for.
            </Text>
            <Pressable
              onPress={post}
              style={({ pressed }) => [styles.modalBtn, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
            >
              <Plus size={18} color={colors.onBrand} />
              <Text style={styles.modalBtnText}>Post a project</Text>
            </Pressable>
            <Pressable onPress={() => setPopup(false)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.later}>Later</Text>
            </Pressable>
            <Text style={styles.sign}>Jolea &amp; Raunak xx</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  slot: { position: "absolute", left: GUTTER, right: GUTTER },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  close: { position: "absolute", top: spacing.md, right: spacing.md, zIndex: 1 },
  title: { ...typography.title, color: colors.onBrand, paddingRight: spacing.xl },
  body: { ...typography.body, color: colors.onBrandMuted },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    marginTop: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
  },
  btnText: { ...typography.bodyStrong, fontFamily: fonts.bold, color: colors.brand },
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
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  modalTitle: { ...typography.title, color: colors.text, textAlign: "center" },
  modalBody: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  modalBtn: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  modalBtnText: { ...typography.bodyStrong, fontFamily: fonts.bold, color: colors.onBrand },
  later: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.xs },
  sign: { ...typography.caption, color: colors.textTertiary },
});
