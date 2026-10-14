import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";

import { ProjectForm } from "@/components/ProjectForm";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { createPost, getProfile, profileGate, type Profile } from "@/lib/db";

export default function NewProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false);
  /* The gate lives on this screen rather than on the buttons that reach it,
     so every way in is covered by one check. */
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then(({ data }) => {
      setProfile(data);
      setChecking(false);
    });
  }, [userId]);

  if (!userId) return null;

  const gate = profileGate(profile, "post");

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Post a project</Text>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Close">
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      {checking ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : !gate.ok ? (
        <View style={styles.centre}>
          <Text style={styles.gateLine}>{gate.line}</Text>
          <Button
            title="Edit profile"
            variant="primary"
            onPress={() => router.replace("/account/edit-profile")}
          />
        </View>
      ) : (
      <ProjectForm
        userId={userId}
        submitLabel="Post project"
        busy={busy}
        onSubmit={async (v) => {
          setBusy(true);
          const { error } = await createPost(userId, v.title, v.description, {
            roles: v.roles,
            looking_for: v.roles,
            project_start: v.projectStart ?? undefined,
            project_end: v.projectEnd ?? undefined,
            location: v.location || undefined,
            pay_type: v.payType ?? undefined,
            compensation: v.compensation || undefined,
            media_urls: v.mediaUrls.length ? v.mediaUrls : undefined,
          });
          setBusy(false);
          if (!error) {
            trackEvent("post_created", {
              roles: v.roles.length,
              photos: v.mediaUrls.length,
              pay_type: v.payType ?? null,
            });
            router.back();
          }
          return { error };
        }}
      />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  gateLine: { ...typography.title, color: colors.text, textAlign: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { ...typography.headline, flex: 1, textAlign: "center" },
});
