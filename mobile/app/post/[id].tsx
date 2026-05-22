import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DollarSign, Flag, MapPin, Users, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { CollabPost, CreatorInfo } from "@/lib/db";

const { width } = Dimensions.get("window");

type Loaded = {
  post: CollabPost;
  creator: CreatorInfo | null;
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: post, error: pErr } = await supabase
      .from("collab_posts")
      .select("*")
      .eq("id", id)
      .single();
    if (pErr || !post) {
      setError(pErr?.message || "Post not found");
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("user_id,name,role,avatar_url")
      .eq("user_id", (post as CollabPost).owner_id)
      .maybeSingle();
    setData({
      post: post as CollabPost,
      creator: prof
        ? {
            user_id: prof.user_id,
            name: prof.name,
            role: prof.role,
            avatar_url: prof.avatar_url,
          }
        : null,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Header onClose={() => router.back()} />
        <View style={styles.loading}>
          <ErrorBanner message={error || "Not found"} />
        </View>
      </SafeAreaView>
    );
  }

  const { post, creator } = data;
  const isMine = userId && post.owner_id === userId;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Header
        title={post.title}
        onClose={() => router.back()}
        right={
          !isMine ? (
            <Pressable
              hitSlop={10}
              onPress={() =>
                router.push({
                  pathname: "/report/[kind]/[id]",
                  params: { kind: "post", id: post.id },
                })
              }
            >
              <Flag size={18} color={colors.dangerText} />
            </Pressable>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {post.media_urls?.length ? (
          <FlatList
            data={post.media_urls}
            keyExtractor={(u, i) => `${i}-${u}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.galleryImg} contentFit="cover" />
            )}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={{ fontSize: 56, opacity: 0.25 }}>🎨</Text>
          </View>
        )}

        <View style={styles.body}>
          {creator ? (
            <View style={styles.creatorRow}>
              <Avatar creator={creator} size="lg" />
              <View style={{ flex: 1 }}>
                <Text style={styles.creatorName}>{creator.name}</Text>
                {creator.role ? <Text style={styles.creatorRole}>{creator.role}</Text> : null}
              </View>
            </View>
          ) : null}

          <Text style={styles.title}>{post.title}</Text>
          {post.description ? <Text style={styles.description}>{post.description}</Text> : null}

          {post.location ? <MetaRow icon={<MapPin size={14} color={colors.textMuted} />} text={post.location} /> : null}
          {post.looking_for?.length ? (
            <MetaRow
              icon={<Users size={14} color={colors.textMuted} />}
              text={`Looking for: ${post.looking_for.join(", ")}`}
            />
          ) : null}
          {post.compensation ? (
            <MetaRow icon={<DollarSign size={14} color={colors.textMuted} />} text={post.compensation} />
          ) : null}

          <Text style={styles.posted}>
            Posted {new Date(post.created_at).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  title,
  onClose,
  right,
}: {
  title?: string;
  onClose: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable hitSlop={12} onPress={onClose}>
        <X size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title ?? "Post"}
      </Text>
      <View style={{ width: 22 }}>{right}</View>
    </View>
  );
}

function MetaRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.metaRow}>
      {icon}
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  scroll: { paddingBottom: 24 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  gallery: { width },
  galleryImg: { width, height: 280, backgroundColor: "#dbeafe" },
  placeholder: {
    width,
    height: 280,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 20, gap: 12 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  creatorName: { fontSize: 16, fontWeight: "700", color: colors.text },
  creatorRole: { fontSize: 13, color: colors.textMuted },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 4 },
  description: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  metaText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  posted: { color: colors.textSubtle, fontSize: 11, marginTop: 8 },
});
