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
import { ArrowLeft, CalendarRange, ExternalLink, Handshake, Trash2, Users } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Glass } from "@/components/ui/Glass";
import { GlassButton } from "@/components/ui/GlassButton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, shadows, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import {
  deleteStory,
  getOpenProjectsBy,
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

  /**
   * "Work with me" never opens a direct message. It opens one of the author's
   * own projects, where a like is a like like any other and a chat appears
   * only once they like back.
   */
  const workWithMe = async () => {
    if (!story) return;
    setBusy(true);
    const { data, error: err } = await getOpenProjectsBy(story.author_id);
    setBusy(false);
    if (err) return setError(err);
    if (!data.length) {
      Alert.alert(
        "No open projects",
        `${story.author.name} has nothing open right now. Their next project will show up in Discover.`
      );
      return;
    }
    router.push({ pathname: "/post/[id]", params: { id: data[0].id } });
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
                        source={{ uri }}
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
                {when ? (
                  <View style={styles.when}>
                    <CalendarRange size={13} color={colors.textSubtle} />
                    <Text style={styles.whenText}>{when}</Text>
                  </View>
                ) : null}
              </View>

              <ErrorBanner message={error} />

              {story.credits.length ? (
                <Glass style={styles.creditsCard}>
                  <View style={styles.creditsHead}>
                    <Users size={15} color={colors.textMuted} />
                    <Text style={styles.creditsTitle}>Made with</Text>
                  </View>
                  <View style={styles.creditsList}>
                    {story.credits.map((c, i) => (
                      <View key={`${c.name}-${i}`} style={styles.creditRow}>
                        <Text style={styles.creditName} numberOfLines={1}>
                          {c.name}
                        </Text>
                        {c.role ? <Chip label={c.role} size="sm" tone="neutral" /> : null}
                        {c.user_id ? <Chip label="on Melange" size="sm" tone="accent" /> : null}
                      </View>
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
                    title="Work with me"
                    variant="primary"
                    size="lg"
                    loading={busy}
                    onPress={workWithMe}
                    leadingIcon={<Handshake size={17} color={colors.onBrand} />}
                    style={{ flex: 1 }}
                  />
                ) : null}
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

              {!mine ? (
                <Text style={styles.consentNote}>
                  A chat opens only if you both say yes.
                </Text>
              ) : null}

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
  galleryImage: { width: SCREEN_W, height: 400, backgroundColor: colors.surfaceStrong },
  galleryEmpty: { backgroundColor: colors.surfaceStrong },
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
    borderRadius: 3,
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
  title: { ...typography.display, fontSize: 26, lineHeight: 31 },
  byRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  byName: { ...typography.h3 },
  byRole: { ...typography.small },
  when: { flexDirection: "row", alignItems: "center", gap: 4 },
  whenText: { ...typography.tiny },

  creditsCard: { padding: 14, gap: 10 },
  creditsHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  creditsTitle: { ...typography.eyebrow, color: colors.textMuted },
  creditsList: { gap: 9 },
  creditRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  creditName: { ...typography.body, fontWeight: "700", maxWidth: "55%" },

  howWrap: { gap: 7 },
  howTitle: { ...typography.eyebrow, color: colors.textMuted },
  howBody: { ...typography.body, lineHeight: 23, color: colors.text },

  ctaRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  consentNote: { ...typography.tiny, textAlign: "center", marginTop: -8 },

  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  deleteText: { color: colors.dangerText, fontSize: 14, fontWeight: "600" },

  backWrap: { position: "absolute", left: 12, ...shadows.soft },
  missing: { alignItems: "center", gap: 6, paddingHorizontal: 24 },
  missingTitle: { ...typography.h2 },
  missingBody: { ...typography.small },
});
