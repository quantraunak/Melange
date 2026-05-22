import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";

import { PostForm } from "@/components/PostForm";
import { colors } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { createPost } from "@/lib/db";

export default function NewPostScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!userId) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>New post</Text>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <PostForm
        userId={userId}
        submitLabel="Create post"
        busy={busy}
        onSubmit={async (values) => {
          setBusy(true);
          const lookingFor = values.lookingFor
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const { error } = await createPost(userId, values.title, values.description, {
            looking_for: lookingFor.length ? lookingFor : undefined,
            location: values.location || undefined,
            compensation: values.compensation || undefined,
            media_urls: values.mediaUrls.length ? values.mediaUrls : undefined,
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
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.text },
});
