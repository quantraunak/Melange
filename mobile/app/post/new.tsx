import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";

import { ProjectForm } from "@/components/ProjectForm";
import { colors, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { createPost } from "@/lib/db";

export default function NewProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!userId) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Post a project</Text>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Close">
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

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
          if (!error) router.back();
          return { error };
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { ...typography.headline, flex: 1, textAlign: "center" },
});
