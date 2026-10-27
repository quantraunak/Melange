import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import type { Profile } from "@/lib/db";

/**
 * What a profile still needs before people can tell who you are: a photo, what
 * you do, and a line about you. Empty when it's done. This is the nudge, not a
 * gate — nothing is blocked while these are missing (PROFILE_FLOOR_ON).
 */
export function profileMissing(profile: Pick<Profile, "portfolio_urls" | "role" | "bio">): string[] {
  const out: string[] = [];
  // A profile photo (avatar) doesn't count: messaging someone you haven't
  // matched with needs one photo of your work (meets_message_floor in
  // 20_message_floor.sql), and "done" here has to mean that works.
  const hasPhoto = (profile.portfolio_urls?.length ?? 0) > 0;
  const role = profile.role?.trim();
  if (!hasPhoto) out.push("a photo of your work");
  if (!role || role === "other") out.push("what you do");
  if (!profile.bio?.trim()) out.push("a short bio");
  return out;
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * On the You tab, until the profile is done: a line at the top saying what's
 * missing, and a popup every time you open the tab. Both go away by themselves
 * once it's done — the tab reloads the profile on focus, so coming back from
 * Edit profile is enough.
 */
export function ProfileNudge({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [popup, setPopup] = useState(false);
  const missing = profileMissing(profile);

  // A beat after focus, not on it: coming back from Edit profile, the tab is
  // still showing the old profile until its reload lands, and popping up then
  // would nag someone who has just finished.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => setPopup(true), 900);
      return () => {
        clearTimeout(t);
        setPopup(false);
      };
    }, [])
  );

  if (!missing.length) return null;

  const edit = () => {
    setPopup(false);
    router.push("/account/edit-profile");
  };

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>Finish your profile</Text>
        <Text style={styles.body}>
          Add {list(missing)} so people know who they&apos;d be making something with.
        </Text>
        <Pressable
          onPress={edit}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>Edit profile</Text>
        </Pressable>
      </View>

      <Modal visible={popup} transparent animationType="fade" onRequestClose={() => setPopup(false)}>
        <View style={styles.scrim}>
          <View style={styles.modal} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>Finish your profile ☆</Text>
            <Text style={styles.modalBody}>
              It still needs {list(missing)}. It takes a minute, and it&apos;s what people look at
              before they message you.
            </Text>
            <Pressable
              onPress={edit}
              style={({ pressed }) => [styles.modalBtn, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
            >
              <Text style={styles.modalBtnText}>Edit profile</Text>
            </Pressable>
            <Pressable onPress={() => setPopup(false)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.later}>Later</Text>
            </Pressable>
            <Text style={styles.sign}>Jolea &amp; Raunak xx ☆</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
  btn: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    marginTop: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
  },
  btnText: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.onBrand },
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
  modalBtn: {
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
  },
  modalBtnText: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.onBrand },
  later: { ...typography.caption, color: colors.textSecondary, alignSelf: "center", paddingVertical: spacing.xs },
  sign: { ...typography.caption, color: colors.textTertiary, alignSelf: "center" },
});
