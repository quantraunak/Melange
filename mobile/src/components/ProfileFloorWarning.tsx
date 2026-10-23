import { useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { AlertTriangle, Camera } from "lucide-react-native";

import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useProfileFloor } from "@/components/ProfilePrompt";

/**
 * The profile floor, said loudly.
 *
 * Below three photos and a role you cannot post a project or like anyone, and
 * the people you would want to work with have nothing to judge you by. That
 * was a grey line on one screen, which is how most of the real users missed
 * it. Now it is:
 *
 *   - a red bar above the tab bar on every tab, for as long as it is true;
 *   - a red popup that comes back when the app opens, when it returns to the
 *     foreground and every time you switch tabs, until the profile is fixed.
 *
 * Both lead straight to Edit profile, and both disappear on their own the
 * moment the profile meets the floor (useProfileFloor re-checks on focus).
 */
/**
 * The tab screens. This component lives in the tabs layout, which stays
 * mounted under any screen pushed on top of it; outside these paths (Edit
 * profile itself, a chat, a project) it must not pop up over what you're doing.
 */
const TAB_PATHS = new Set(["/", "/connect", "/stories", "/nights", "/messages", "/profile"]);

export function ProfileFloorWarning({ bottom }: { bottom: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { userId } = useAuth();
  const gap = useProfileFloor(userId);
  const [open, setOpen] = useState(false);
  const lastPath = useRef<string | null>(null);
  const onTab = TAB_PATHS.has(pathname);

  // Pop up when the gap is first known, and again on every tab switch.
  useEffect(() => {
    if (!gap) {
      setOpen(false);
      return;
    }
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      if (onTab) setOpen(true);
    }
  }, [gap, pathname, onTab]);

  // And every time the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && gap && onTab) setOpen(true);
    });
    return () => sub.remove();
  }, [gap, onTab]);

  if (!gap) return null;

  const fix = () => {
    setOpen(false);
    router.push("/account/edit-profile");
  };

  const title =
    gap.photosNeeded > 0
      ? `Add ${gap.photosNeeded} more photo${gap.photosNeeded === 1 ? "" : "s"}`
      : "Pick your role";

  return (
    <>
      <Pressable
        onPress={fix}
        style={({ pressed }) => [styles.bar, { bottom }, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
        accessibilityLabel={`${gap.line} Fix your profile`}
      >
        <AlertTriangle size={18} color={colors.white} />
        <Text style={styles.barText} numberOfLines={2}>
          {gap.line}
        </Text>
        <Text style={styles.barAction}>Fix</Text>
      </Pressable>

      <Modal visible={open && onTab} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.scrim}>
          <View style={styles.card} accessibilityViewIsModal>
            <View style={styles.icon}>
              <AlertTriangle size={28} color={colors.white} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>
              {gap.line} Profiles need {gap.photosNeeded > 0 ? "3 photos" : "a role"} so people can see who
              they&apos;d be working with.
            </Text>
            <Pressable
              onPress={fix}
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
            >
              <Camera size={18} color={colors.white} />
              <Text style={styles.primaryText}>
                {gap.photosNeeded > 0 ? "Add photos now" : "Fix my profile"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.later}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: GUTTER,
    right: GUTTER,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  barText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.white, flex: 1 },
  barAction: {
    ...typography.caption,
    fontFamily: fonts.bold,
    color: colors.danger,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(127,29,29,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: GUTTER * 2,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.danger,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.title, color: colors.dangerText, textAlign: "center" },
  body: { ...typography.body, color: colors.text, textAlign: "center" },
  primary: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
    marginTop: spacing.xs,
  },
  primaryText: { ...typography.bodyStrong, fontFamily: fonts.bold, color: colors.white },
  later: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.xs },
});
