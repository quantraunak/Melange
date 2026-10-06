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

import { ShootForm } from "@/components/ShootForm";
import { Button } from "@/components/ui/Button";
import { colors, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { deletePost, shootRoles, updatePost, type CollabPost } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export default function EditShootScreen() {
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
      "Delete this shoot?",
      "Matches already made from it keep their chats, but nobody new can apply.",
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
          <ActivityIndicator color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Text style={styles.headerTitle}>Shoot not found</Text>
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
        <Text style={styles.headerTitle}>Edit shoot</Text>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Close">
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <ShootForm
        userId={userId}
        submitLabel="Save changes"
        busy={busy}
        externalError={externalErr}
        initial={{
          title: post.title,
          description: post.description ?? "",
          roles: shootRoles(post),
          shootStart: post.shoot_start ?? null,
          shootEnd: post.shoot_end ?? null,
          location: post.location ?? "",
          payType: post.pay_type ?? null,
          compensation: post.compensation ?? "",
          mediaUrls: post.media_urls ?? [],
        }}
        onSubmit={async (v) => {
          setBusy(true);
          const { error } = await updatePost(post.id, {
            title: v.title,
            description: v.description,
            roles: v.roles,
            looking_for: v.roles,
            shoot_start: v.shootStart,
            shoot_end: v.shootEnd,
            location: v.location || null,
            pay_type: v.payType,
            compensation: v.compensation || null,
            media_urls: v.mediaUrls.length ? v.mediaUrls : null,
          });
          setBusy(false);
          if (!error) router.back();
          return { error };
        }}
      />

      <View style={styles.deleteBar}>
        <Button
          title="Delete shoot"
          variant="danger"
          leadingIcon={<Trash2 size={16} color={colors.white} />}
          onPress={onDelete}
        />
      </View>
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  deleteBar: { paddingHorizontal: 16, paddingBottom: 8 },
});
