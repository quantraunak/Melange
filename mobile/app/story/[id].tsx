import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CalendarRange, ExternalLink, MessageCircle, Trash2, Users } from "lucide-react-native";

import { HeartButton } from "@/components/HeartButton";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Glass } from "@/components/ui/Glass";
import { GlassButton } from "@/components/ui/GlassButton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, fonts, radii, shadows, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { sized } from "@/lib/imageUrl";
import {
  deleteStory,
  getStory,
  storyDate,
  type StoryWithAuthor,
} from "@/lib/stories";

const { width: SCREEN_W } = Dimensions.get("window");

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  const [story, setStory] = useState<StoryWithAuthor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await getStory(id);
    setStory(res.data);
    setError(res.unavailable ? "Stories are not enabled on this database yet." : res.error);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const mine = !!story && story.author_id === userId;
  const when = story ? storyDate(story) : null;

  /** Message the author about this work. No match needed (13_reach_out.sql). */
  const messageAuthor = () => {
    if (!story) return;
    router.push({
      pathname: "/message/[userId]",
      params: { userId: story.author_id, origin: "story", originId: story.id, about: story.title },
    });
  };

  const confirmDelete = () => {
    if (!story) return;
    Alert.alert("Delete this story?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          const { error: err } = await deleteStory(story.id);
          setBusy(false);
          if (err) return setError(err);
          router.back();
        },
      },
    ]);
  };

  const openLink = async () => {
    if (!story?.contact_link) return;
    const ok = await Linking.canOpenURL(story.contact_link);
    if (!ok) return setError("That link could not be opened.");
    Linking.openURL(story.contact_link);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={340} radius={0} />
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              <Skeleton height={28} />
              <Skeleton height={16} width="70%" />
            </View>
          </View>
        ) : !story ? (
          <View style={[styles.missing, { paddingTop: insets.top + 80 }]}>
            <Text style={styles.missingTitle}>Story not found</Text>
            <Text style={styles.missingBody}>It may have been deleted.</Text>
          </View>
        ) : (
          <>
            <View style={styles.gallery}>
              {story.media_urls.length ? (
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) =>
                      setImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
                    }
                  >
                    {story.media_urls.map((uri, i) => (
                      <Image
                        key={`${uri}-${i}`}
                        source={{ uri: sized(uri, SCREEN_W, 400) }}
                        style={styles.galleryImage}
                        contentFit="cover"
                        transition={160}
                      />
                    ))}
                  </ScrollView>
                  {story.media_urls.length > 1 ? (
                    <View style={styles.dots} pointerEvents="none">
                      {story.media_urls.map((_, i) => (
                        <View key={i} style={[styles.dot, i === imageIndex && styles.dotOn]} />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={[styles.galleryImage, styles.galleryEmpty]} />
              )}
            </View>

            <View style={styles.body}>
              <Text style={styles.title}>{story.title}</Text>

              <View style={styles.byRow}>
                <Pressable
                  onPress={
                    story.author.user_id
                      ? () =>
                          router.push({
                            pathname: "/profile/[userId]",
                            params: { userId: story.author.user_id as string },
                          })
                      : undefined
                  }
                  disabled={!story.author.user_id}
                  hitSlop={8}
                  accessibilityRole={story.author.user_id ? "button" : undefined}
                  accessibilityLabel={
                    story.author.user_id ? `${story.author.name}'s profile` : undefined
                  }
                  style={({ pressed }) => [
                    styles.byPerson,
                    pressed && story.author.user_id && { opacity: 0.6 },
                  ]}
                >
                  <Avatar creator={story.author} size="md" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.byName}>
                      {story.author.name}
                      {story.author.verification_status === "verified" ? " ✓" : ""}
                    </Text>
                    {story.author.role ? (
                      <Text style={styles.byRole}>{story.author.role}</Text>
                    ) : null}
                  </View>
                </Pressable>
                {when ? (
                  <View style={styles.when}>
                    <CalendarRange size={13} color={colors.iconFaint} />
                    <Text style={styles.whenText}>{when}</Text>
                  </View>
                ) : null}
              </View>

              <ErrorBanner message={error} />

              {story.credits.length ? (
                <Glass style={styles.creditsCard}>
                  <View style={styles.creditsHead}>
                    <Users size={15} color={colors.iconFaint} />
                    <Text style={styles.creditsTitle}>Made with</Text>
                  </View>
                  <View style={styles.creditsList}>
                    {story.credits.map((c, i) => (
                      <Pressable
                        key={`${c.name}-${i}`}
                        onPress={
                          c.user_id
                            ? () =>
                                router.push({
                                  pathname: "/profile/[userId]",
                                  params: { userId: c.user_id as string },
                                })
                            : undefined
                        }
                        disabled={!c.user_id}
                        accessibilityRole={c.user_id ? "button" : undefined}
                        accessibilityLabel={c.user_id ? `${c.name}'s profile` : undefined}
                        style={({ pressed }) => [
                          styles.creditRow,
                          pressed && c.user_id && { opacity: 0.6 },
                        ]}
                      >
                        <Text
                          style={[styles.creditName, c.user_id && styles.creditNameLink]}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                        {c.role ? <Chip label={c.role} size="sm" tone="neutral" /> : null}
                        {c.user_id ? <Chip label="on Melange" size="sm" tone="accent" /> : null}
                      </Pressable>
                    ))}
                  </View>
                </Glass>
              ) : null}

              {story.story ? (
                <View style={styles.howWrap}>
                  <Text style={styles.howTitle}>How we did it</Text>
                  <Text style={styles.howBody}>{story.story}</Text>
                </View>
              ) : null}

              <View style={styles.ctaRow}>
                {!mine ? (
                  <Button
                    title={`Message ${story.author.name.split(" ")[0]}`}
                    variant="primary"
                    size="lg"
                    onPress={messageAuthor}
                    leadingIcon={<MessageCircle size={17} color={colors.onBrand} />}
                    style={{ flex: 1 }}
                  />
                ) : null}
                {!mine ? <HeartButton kind="story" targetId={story.id} ownerId={story.author_id} label /> : null}
                {story.contact_link ? (
                  <Button
                    title={mine ? "Open link" : "Their work"}
                    variant="outline"
                    size="lg"
                    onPress={openLink}
                    leadingIcon={<ExternalLink size={16} color={colors.text} />}
                    style={mine ? { flex: 1 } : undefined}
                  />
                ) : null}
              </View>

              {mine ? (
                <Pressable onPress={confirmDelete} style={styles.deleteRow} disabled={busy}>
                  <Trash2 size={15} color={colors.dangerText} />
                  <Text style={styles.deleteText}>Delete this story</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.backWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
        <GlassButton accessibilityLabel="Back" onPress={() => router.back()} size={42}>
          <ArrowLeft size={19} color={colors.text} />
        </GlassButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 48 },

  gallery: { position: "relative" },
  galleryImage: { width: SCREEN_W, height: 400, backgroundColor: colors.bg },
  galleryEmpty: { backgroundColor: colors.bg },
  dots: {
    position: "absolute",
    // The body card below overlaps the gallery by 24 (body.marginTop: -24),
    // so dots sitting at the gallery's own bottom edge are covered by it.
    // Clear the overlap first, then the usual inset.
    bottom: 24 + 14,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  dotOn: { backgroundColor: colors.white, width: 18 },

  body: {
    padding: 20,
    gap: 16,
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.bg,
  },
  title: typography.display2,
  byRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  byName: { ...typography.headline },
  byRole: { ...typography.caption },
  when: { flexDirection: "row", alignItems: "center", gap: 4 },
  whenText: { ...typography.micro },

  creditsCard: { padding: 14, gap: 10 },
  creditsHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  creditsTitle: { ...typography.eyebrow, color: colors.textSecondary },
  creditsList: { gap: 9 },
  creditRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  creditName: { ...typography.body, fontFamily: fonts.semibold, maxWidth: "55%" },
  /* A name that leads somewhere says so; one that does not stays ink. */
  creditNameLink: { color: colors.brandText },
  byPerson: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

  howWrap: { gap: 7 },
  howTitle: { ...typography.eyebrow, color: colors.textSecondary },
  howBody: { ...typography.body, lineHeight: 23, color: colors.text },

  ctaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },

  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  deleteText: { ...typography.bodyStrong, color: colors.dangerText },

  backWrap: { position: "absolute", left: 12, ...shadows.card },
  missing: { alignItems: "center", gap: 6, paddingHorizontal: 24 },
  missingTitle: { ...typography.headline },
  missingBody: { ...typography.caption },
});
