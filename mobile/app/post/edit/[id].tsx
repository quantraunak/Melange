import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Trash2, X } from "lucide-react-native";

import { PostForm } from "@/components/PostForm";
import { Button } from "@/components/ui/Button";
import { colors } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { deletePost, updatePost, type CollabPost } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();

  const [post, setPost] = useState<CollabPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [externalErr, setExternalErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("collab_posts")
      .select("*")
      .eq("id", id)
      .single();
    if (error) setExternalErr(error.message);
    setPost(data as CollabPost);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = () => {
    Alert.alert(
      "Delete this post?",
      "Any matches created from this post will keep working, but the post will no longer be visible in the swipe feed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            setBusy(true);
            const { error } = await deletePost(id);
            setBusy(false);
            if (error) {
              setExternalErr(error);
              return;
            }
            router.back();
          },
        },
      ]
    );
  };

  if (loading || !userId) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Text style={styles.headerTitle}>Post not found</Text>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <X size={22} color={colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Edit post</Text>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <PostForm
        userId={userId}
        submitLabel="Save changes"
        busy={busy}
        externalError={externalErr}
        initial={{
          title: post.title,
          description: post.description ?? "",
          lookingFor: post.looking_for?.join(", ") ?? "",
          location: post.location ?? "",
          compensation: post.compensation ?? "",
          mediaUrls: post.media_urls ?? [],
        }}
        onSubmit={async (values) => {
          setBusy(true);
          const lookingFor = values.lookingFor
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const { error } = await updatePost(post.id, {
            title: values.title,
            description: values.description,
            looking_for: lookingFor.length ? lookingFor : null,
            location: values.location || null,
            compensation: values.compensation || null,
            media_urls: values.mediaUrls.length ? values.mediaUrls : null,
          });
          setBusy(false);
          if (!error) router.back();
          return { error };
        }}
      />

      <View style={styles.deleteBar}>
        <Button
          title="Delete post"
          variant="danger"
          leadingIcon={<Trash2 size={16} color={colors.white} />}
          onPress={onDelete}
        />
      </View>
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  deleteBar: { padding: 16, borderTopColor: colors.border, borderTopWidth: 1, backgroundColor: colors.card },
});
