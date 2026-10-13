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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Eye,
  MessageCircle,
  Sparkles,
  Flag,
  MapPin,
  Pencil,
  Wallet,
  X,
} from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { MatchCelebration } from "@/components/MatchCelebration";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Glass } from "@/components/ui/Glass";
import { colors, fonts, radii, shadows, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import {
  checkAndCreateMatch,
  getMySwipes,
  getProfile,
  payLabel,
  recordSwipe,
  projectDates,
  projectRoles,
  type CollabPost,
  type CreatorInfo,
} from "@/lib/db";

const { width } = Dimensions.get("window");
const HERO_H = 400;

type Loaded = {
  post: CollabPost;
  creator: CreatorInfo | null;
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { refresh: refreshMatches } = useMatches();

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swiped, setSwiped] = useState<"left" | "right" | null>(null);
  const [applying, setApplying] = useState(false);
  const [celebration, setCelebration] = useState<{ matchId: string } | null>(null);
  const [me, setMe] = useState<Pick<CreatorInfo, "name" | "avatar_url">>({ name: "You", avatar_url: null });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: post, error: pErr } = await supabase
      .from("collab_posts")
      .select("*")
      .eq("id", id)
      .single();
    if (pErr || !post) {
      setError(pErr?.message || "Project not found");
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("user_id,name,role,avatar_url,verification_status")
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
            verification_status: prof.verification_status ?? "none",
          }
        : null,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId || !id) return;
    getMySwipes(userId).then(({ data: map }) => setSwiped(map.get(id) ?? null));
    getProfile(userId).then(({ data: p }) => {
      if (p) setMe({ name: p.name, avatar_url: p.avatar_url ?? null });
    });
  }, [userId, id]);

  const apply = async () => {
    if (!userId || !data || applying) return;
    setApplying(true);
    setError(null);
    const { error: swErr } = await recordSwipe(userId, data.post.id, "right");
    if (swErr && !/duplicate|unique/i.test(swErr)) {
      setError(swErr);
      setApplying(false);
      return;
    }
    trackEvent("swipe_right", { post_id: data.post.id, owner_id: data.post.owner_id, from: "detail" });
    setSwiped("right");
    const { match, error: mErr } = await checkAndCreateMatch(userId, data.post.id);
    if (mErr) setError(mErr);
    if (match) {
      trackEvent("match_created", { match_id: match.id, post_id: data.post.id });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshMatches();
      setCelebration({ matchId: match.id });
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setApplying(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loading}>
          <ErrorBanner message={error || "Not found"} />
          <Pressable onPress={() => router.back()} style={styles.closeInline}>
            <Text style={styles.closeInlineText}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { post, creator } = data;
  const isMine = !!userId && post.owner_id === userId;
  const roles = projectRoles(post);
  const dates = projectDates(post);
  const pay = payLabel(post);
  const detail = post.pay_type && post.compensation ? post.compensation : null;

  return (
    <View style={styles.safe}>
      <MatchCelebration
        visible={!!celebration}
        me={me}
        them={creator}
        projectTitle={post.title}
        onMessage={() => {
          const matchId = celebration?.matchId;
          setCelebration(null);
          if (matchId) router.replace({ pathname: "/chat/[matchId]", params: { matchId } });
        }}
        onKeepSwiping={() => {
          setCelebration(null);
          router.back();
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          {post.media_urls?.length ? (
            <FlatList
              data={post.media_urls}
              keyExtractor={(u, i) => `${i}-${u}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.heroImg} contentFit="cover" />
              )}
            />
          ) : (
            <View style={[styles.heroImg, styles.placeholder]}>
              <Sparkles size={64} color={colors.iconFaint} strokeWidth={1.2} />
            </View>
          )}
          <View pointerEvents="none" style={styles.heroFade} />
        </View>

        <View style={styles.body}>
          {roles.length ? (
            <ChipRow>
              {roles.map((r) => (
                <Chip key={r} label={r} tone="accent" />
              ))}
            </ChipRow>
          ) : null}
          <Text style={styles.title}>{post.title}</Text>
          {post.description ? <Text style={styles.logline}>{post.description}</Text> : null}

          <Glass radius={radii.md} style={styles.facts}>
            {dates ? <Fact icon={<CalendarDays size={16} color={colors.iconFaint} />} label="When" value={dates} /> : null}
            {post.location ? <Fact icon={<MapPin size={16} color={colors.iconFaint} />} label="Where" value={post.location} /> : null}
            {pay ? (
              <Fact
                icon={<Wallet size={16} color={colors.iconFaint} />}
                label="Pay"
                value={detail ? `${pay} · ${detail}` : pay}
              />
            ) : null}
            {!dates && !post.location && !pay ? (
              <Text style={styles.factsEmpty}>No dates or pay listed yet. Ask in chat.</Text>
            ) : null}
          </Glass>

          {isMine ? (
            <View style={styles.previewNote}>
              <Eye size={16} color={colors.brandText} />
              <Text style={styles.previewNoteText}>
                Preview: this is how your project looks to everyone else.
                {post.is_active ? "" : " It's inactive, so nobody else sees it right now."}
              </Text>
            </View>
          ) : null}

          {creator ? (
            <Pressable
              onPress={
                isMine
                  ? undefined
                  : () => router.push({ pathname: "/profile/[userId]", params: { userId: post.owner_id } })
              }
              disabled={isMine}
              accessibilityRole={isMine ? undefined : "button"}
              accessibilityLabel={isMine ? undefined : `${creator.name}'s profile`}
              style={({ pressed }) => [pressed && !isMine && { opacity: 0.7 }]}
            >
              <Glass radius={radii.md} style={styles.byCard}>
                <Avatar creator={creator} size="lg" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Posted by</Text>
                  <Text style={styles.byName}>
                    {creator.name}
                    {creator.verification_status === "verified" ? " ✓" : ""}
                  </Text>
                  {creator.role ? <Text style={styles.byRole}>{creator.role}</Text> : null}
                </View>
                {!isMine ? (
                  <Pressable
                    hitSlop={10}
                    accessibilityLabel="Report this project"
                    onPress={() =>
                      router.push({ pathname: "/report/[kind]/[id]", params: { kind: "post", id: post.id } })
                    }
                  >
                    <Flag size={18} color={colors.iconFaint} />
                  </Pressable>
                ) : null}
                {!isMine ? <ChevronRight size={18} color={colors.iconFaint} /> : null}
              </Glass>
            </Pressable>
          ) : null}

          <Text style={styles.posted}>Posted {new Date(post.created_at).toLocaleDateString()}</Text>
          <ErrorBanner message={error} />
        </View>

        {/* Action bar: flows after the content, and sits at the bottom when the
            content is short, so there is never a dead gap above it. */}
        {!isMine ? (
          <View style={[styles.applyBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/message/[userId]",
                  params: { userId: post.owner_id, origin: "project", originId: post.id, about: post.title },
                })
              }
              style={({ pressed }) => [styles.messageBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <MessageCircle size={18} color={colors.accentInk} />
              <Text style={styles.messageText}>
                Message {creator?.name.split(" ")[0] ?? "them"} about this
              </Text>
            </Pressable>
            {swiped === "right" ? (
              <View style={styles.applied}>
                <Check size={18} color={colors.accent} strokeWidth={2.75} />
                <Text style={styles.appliedText}>Liked. If they like you back, a chat opens.</Text>
              </View>
            ) : (
              <Pressable
                onPress={apply}
                disabled={applying}
                style={({ pressed }) => [styles.applyBtn, pressed && { transform: [{ scale: 0.97 }] }]}
                accessibilityRole="button"
              >
                {applying ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Check size={20} color={colors.white} strokeWidth={2.75} />
                    <Text style={styles.applyText}>Like this project</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        ) : (
          <View style={[styles.applyBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              onPress={() => router.push({ pathname: "/post/edit/[id]", params: { id: post.id } })}
              style={({ pressed }) => [styles.messageBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Pencil size={16} color={colors.accentInk} />
              <Text style={styles.messageText}>Edit project</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Top bar over the poster */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.glassBtn} accessibilityLabel="Close">
          <X size={20} color={colors.text} />
        </Pressable>
        {isMine ? (
          <Pressable
            onPress={() => router.push({ pathname: "/post/edit/[id]", params: { id: post.id } })}
            style={styles.glassBtn}
            accessibilityLabel="Edit project"
          >
            <Pencil size={18} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

    </View>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      {icon}
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  closeInline: { paddingVertical: 8 },
  closeInlineText: { color: colors.textSecondary, fontFamily: fonts.semibold },
  hero: { height: HERO_H, width, backgroundColor: colors.surfaceSunken },
  heroImg: { width, height: HERO_H },
  placeholder: { alignItems: "center", justifyContent: "center" },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 24,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  body: { paddingHorizontal: 20, gap: 14, marginTop: 16 },
  title: { ...typography.display2, marginTop: 2 },
  logline: { ...typography.body, color: colors.textSecondary },
  facts: { padding: 14, gap: 12 },
  fact: { flexDirection: "row", alignItems: "center", gap: 10 },
  factLabel: { ...typography.caption, width: 64 },
  factValue: { ...typography.body, flex: 1, fontFamily: fonts.semibold },
  factsEmpty: typography.caption,
  byCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  eyebrow: typography.eyebrow,
  byName: { ...typography.headline, marginTop: 2 },
  byRole: typography.caption,
  posted: { ...typography.micro, marginTop: 4 },
  scrollContent: { flexGrow: 1 },
  applyBar: {
    marginTop: "auto",
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 10,
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  messageText: { ...typography.bodyStrong, color: colors.accentInk },
  previewNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  previewNoteText: { ...typography.caption, flex: 1, color: colors.brandText },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    ...shadows.card,
  },
  applyText: { ...typography.headline, color: colors.white },
  applied: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 56 },
  appliedText: { ...typography.caption, color: colors.text, fontFamily: fonts.semibold },
});
