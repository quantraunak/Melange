import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { ImagePlus, Search, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth";
import {
  createStory,
  getCurrentTheme,
  searchPeople,
  STORY_MAX_CREDITS,
  uploadStoryAssets,
  type StoryAsset,
  type StoryCredit,
  type StoryUploadProgress,
  type TaggablePerson,
  type WeeklyTheme,
} from "@/lib/stories";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";

/** collab_stories.title is 1–140 characters (09_stories.sql). */
const LINE_MAX = 140;

/**
 * Quick post, from Explore's +: one photo, one line, optionally who's in it
 * and whether it's for this week's theme. The four-step story form is for
 * writing up a shoot; this is for "here's a photo I made today", which is
 * most of what people want to post and was the thing with no door.
 *
 * It's an ordinary collab_stories row (title = the line, one photo, tagged
 * members as credits with no role), so it shows on Explore, on profiles and
 * on the profiles of everyone tagged. The server pushes "Maya tagged you".
 */
export default function QuickPostScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const params = useLocalSearchParams<{ theme?: string }>();

  const [photo, setPhoto] = useState<StoryAsset | null>(null);
  const [line, setLine] = useState("");
  const [tags, setTags] = useState<TaggablePerson[]>([]);
  const [theme, setTheme] = useState<WeeklyTheme | null>(null);
  const [forTheme, setForTheme] = useState(params.theme === "1");
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState<StoryUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data, error: err } = await getCurrentTheme();
      if (!live) return;
      // No theme is a quiet absence (the toggle just isn't there); a failed
      // lookup is logged rather than shown, since posting still works.
      if (err) console.warn("current_theme failed", err);
      setTheme(data);
      if (!data) setForTheme(false);
    })();
    return () => {
      live = false;
    };
  }, []);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo access needed", "Allow photo access in Settings to post.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setPhoto({ kind: "local", uri: a.uri, mimeType: a.mimeType, width: a.width, height: a.height });
    setError(null);
  };

  const addTag = (p: TaggablePerson) => {
    if (tags.some((t) => t.user_id === p.user_id)) return;
    if (tags.length >= STORY_MAX_CREDITS) {
      Alert.alert("That's the limit", `Up to ${STORY_MAX_CREDITS} people per post.`);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setTags((prev) => [...prev, p]);
  };

  const post = async () => {
    if (!userId || posting) return;
    if (!photo) return setError("Pick a photo.");
    if (!line.trim()) return setError("Add a line about it.");
    setPosting(true);
    setError(null);

    const { urls, error: upErr } = await uploadStoryAssets(userId, [photo], setProgress);
    setProgress(null);
    if (upErr || !urls) {
      setPosting(false);
      setError(upErr || "Photo upload failed.");
      return;
    }

    const credits: StoryCredit[] = tags.map((t) => ({ name: t.name, role: null, user_id: t.user_id }));
    const res = await createStory(userId, {
      title: line.trim(),
      story: "",
      mediaUrls: urls,
      credits,
      contactLink: null,
      happenedOn: null,
      themeId: forTheme && theme ? theme.id : null,
    });
    if (res.error || res.unavailable || !res.data) {
      // Nothing is cleared, so a retry is one tap. The photo already uploaded
      // is re-sent; an orphaned file is cheaper than a lost post.
      setPosting(false);
      setError(res.error || "That didn't post. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  if (!userId) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Close">
          <X size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New post</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={pick}
            disabled={posting}
            style={({ pressed }) => [styles.photo, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={photo ? "Change photo" : "Choose a photo"}
          >
            {photo && photo.kind === "local" ? (
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <>
                <ImagePlus size={28} color={colors.iconFaint} strokeWidth={1.6} />
                <Text style={styles.photoText}>Choose a photo</Text>
              </>
            )}
          </Pressable>

          <Input
            value={line}
            onChangeText={setLine}
            placeholder="One line about it"
            maxLength={LINE_MAX}
            returnKeyType="done"
            accessibilityLabel="Caption"
          />

          <TagPicker tags={tags} onAdd={addTag} onRemove={(id) => setTags((p) => p.filter((t) => t.user_id !== id))} />

          {theme ? (
            <View style={styles.themeRow}>
              <Text style={styles.themeText} numberOfLines={1}>
                For this week&apos;s theme: <Text style={styles.themeName}>{theme.title}</Text>
              </Text>
              <Switch
                value={forTheme}
                onValueChange={setForTheme}
                trackColor={{ true: colors.accent, false: colors.lineStrong }}
                accessibilityLabel={`For this week's theme, ${theme.title}`}
              />
            </View>
          ) : null}

          <ErrorBanner message={error} />
        </ScrollView>

        <View style={styles.footer}>
          {progress ? (
            <Text style={styles.progress}>
              {progress.attempt > 1 ? "Uploading · retrying" : `Uploading · ${Math.round(progress.fraction * 100)}%`}
            </Text>
          ) : null}
          <Button title="Post" variant="primary" size="lg" fullWidth loading={posting} onPress={post} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Tag people: search members by name or @handle, tap to add. Members only,
 * on purpose. A tag is a notification and a line on their profile, so it
 * has to point at an account; plain-name credits live in the full form.
 */
function TagPicker({
  tags,
  onAdd,
  onRemove,
}: {
  tags: TaggablePerson[];
  onAdd: (p: TaggablePerson) => void;
  onRemove: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaggablePerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      seq.current++;
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    const run = ++seq.current;
    const t = setTimeout(async () => {
      const { data, error } = await searchPeople(q);
      // A slow answer to an older query must not replace a newer one.
      if (run !== seq.current) return;
      setResults(data);
      setSearchError(error);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const shown = results.filter((r) => !tags.some((t) => t.user_id === r.user_id));

  return (
    <View style={styles.tags}>
      {tags.length ? (
        <View style={styles.tagChips}>
          {tags.map((t) => (
            <Pressable
              key={t.user_id}
              onPress={() => onRemove(t.user_id)}
              hitSlop={6}
              style={styles.tagChip}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${t.name}`}
            >
              <Text style={styles.tagChipText} numberOfLines={1}>
                {t.name}
              </Text>
              <X size={13} color={colors.accentInk} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Tag people (optional)"
        autoCapitalize="none"
        autoCorrect={false}
        leading={<Search size={16} color={colors.iconFaint} />}
        trailing={searching ? <ActivityIndicator size="small" color={colors.iconFaint} /> : null}
        accessibilityLabel="Tag people"
      />
      {searchError ? <Text style={styles.searchNote}>Couldn&apos;t search right now.</Text> : null}
      {shown.map((p) => (
        <Pressable
          key={p.user_id}
          onPress={() => {
            onAdd(p);
            setQuery("");
          }}
          style={({ pressed }) => [styles.result, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`Tag ${p.name}`}
        >
          <Avatar creator={p} size="sm" />
          <Text style={styles.resultName} numberOfLines={1}>
            {p.name}
            {p.handle ? <Text style={styles.resultHandle}>{`  @${p.handle}`}</Text> : null}
          </Text>
        </Pressable>
      ))}
      {query.trim() && !searching && !searchError && shown.length === 0 ? (
        <Text style={styles.searchNote}>Nobody by that name yet.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.headline, color: colors.text },
  scroll: { paddingHorizontal: GUTTER, paddingBottom: spacing.xl, gap: spacing.lg },
  photo: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  photoText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.textSecondary },

  tags: { gap: spacing.sm },
  tagChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    maxWidth: 200,
  },
  tagChipText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.accentInk, flexShrink: 1 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  resultName: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  resultHandle: { ...typography.caption, color: colors.textTertiary },
  searchNote: { ...typography.caption, color: colors.textSecondary },

  themeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  themeText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  themeName: { fontFamily: fonts.semibold, color: colors.text },

  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  progress: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
});
