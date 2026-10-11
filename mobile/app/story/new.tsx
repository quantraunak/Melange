import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";

import { StoryForm } from "@/components/StoryForm";
import { colors, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { createStory } from "@/lib/stories";

export default function NewStoryScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!userId) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Post a story</Text>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Close">
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <StoryForm
        userId={userId}
        submitLabel="Post story"
        busy={busy}
        onSubmit={async (v) => {
          setBusy(true);
          const res = await createStory(userId, {
            title: v.title,
            story: v.story,
            mediaUrls: v.mediaUrls,
            credits: v.credits,
            contactLink: v.contactLink,
            happenedOn: v.happenedOn,
          });
          setBusy(false);
          if (res.unavailable) {
            return { error: "Stories are not enabled on this database yet (09_stories.sql)." };
          }
          if (!res.error) router.back();
          return { error: res.error };
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgElevated },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { ...typography.h3, flex: 1, textAlign: "center" },
});
