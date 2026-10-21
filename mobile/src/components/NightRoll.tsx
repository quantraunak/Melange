import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { ImageIcon, ImagePlus } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { NightPhotoViewer } from "@/components/NightPhotoViewer";
import { colors, GUTTER, radii, spacing, typography } from "@/lib/theme";
import {
  addNightPhotos,
  deleteNightPhoto,
  getNightRoll,
  removeMyTag,
  tagNightPhoto,
  type AddProgress,
  type NightPhoto,
} from "@/lib/nightPhotos";
import type { NightPerson } from "@/lib/nights";

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_GAP = spacing.xs;
/** Three across inside the gutter. */
const GRID_TILE = (SCREEN_W - GUTTER * 2 - GRID_GAP * 2) / 3;
const STRIP_TILE = 112;
/** Most photos one pick can add. The picker enforces it. */
const PICK_LIMIT = 20;

/**
 * The night's photos, for the people who were there: yours first (photos
 * you're tagged in) as a strip, then the whole roll as a grid. Members only;
 * the page decides that and shows something else to everyone else.
 *
 * `refreshKey` changes whenever the page reloads, so pull-to-refresh and
 * coming back to the page pick up photos others added.
 */
export function NightRoll({
  eventId,
  userId,
  people,
  refreshKey,
}: {
  eventId: string;
  userId: string;
  people: NightPerson[];
  refreshKey: number;
}) {
  const [photos, setPhotos] = useState<NightPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AddProgress | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<{ ids: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await getNightRoll(eventId);
    // A failed reload keeps what's on screen rather than blanking the roll.
    if (err && !data.length) {
      setError(err);
    } else {
      setPhotos(data);
      setError(err);
    }
    setLoaded(true);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const mine = useMemo(() => photos.filter((p) => p.includes_me), [photos]);

  const markBusy = (id: string, on: boolean) =>
    setBusy((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const patch = (id: string, fn: (p: NightPhoto) => NightPhoto) =>
    setPhotos((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));

  const add = async () => {
    if (progress) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo permission denied", "Enable photo access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: PICK_LIMIT,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;

    setError(null);
    setProgress({ index: 1, total: result.assets.length, fraction: 0 });
    const { added, failed } = await addNightPhotos(
      eventId,
      userId,
      result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })),
      setProgress
    );
    setProgress(null);
    if (added) await load();
    if (failed.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      // Say which ones, so the rest can be picked again without guessing.
      const lines = failed.map((f) => `Photo ${f.index}: ${f.error}`).join("\n");
      Alert.alert(
        added ? `${added} added, ${failed.length} didn't upload` : "Those photos didn't upload",
        lines
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  /**
   * Optimistic: the name shows on the photo at once and comes back off if
   * the server refuses (not at the night, blocked, photo gone).
   */
  const tag = async (photo: NightPhoto, person: NightPerson) => {
    if (photo.tagged.some((t) => t.user_id === person.user_id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const isMe = person.user_id === userId;
    patch(photo.id, (p) => ({
      ...p,
      tagged: [...p.tagged, { user_id: person.user_id, name: person.name }],
      includes_me: p.includes_me || isMe,
    }));
    const { error: err } = await tagNightPhoto(photo.id, person.user_id);
    if (err) {
      patch(photo.id, (p) => ({
        ...p,
        tagged: p.tagged.filter((t) => t.user_id !== person.user_id),
        includes_me: isMe ? false : p.includes_me,
      }));
      Alert.alert(`Couldn't tag ${person.name.split(" ")[0]}`, err);
    }
  };

  const untagMe = async (photo: NightPhoto) => {
    if (busy.has(photo.id)) return;
    const before = photo.tagged;
    patch(photo.id, (p) => ({ ...p, tagged: p.tagged.filter((t) => t.user_id !== userId), includes_me: false }));
    markBusy(photo.id, true);
    const { error: err } = await removeMyTag(photo.id, userId);
    markBusy(photo.id, false);
    if (err) {
      patch(photo.id, (p) => ({ ...p, tagged: before, includes_me: true }));
      Alert.alert("Couldn't remove your tag", err);
    }
  };

  const remove = (photo: NightPhoto) => {
    Alert.alert("Delete this photo?", "It comes off the night for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          markBusy(photo.id, true);
          const { error: err } = await deleteNightPhoto(photo);
          markBusy(photo.id, false);
          if (err) {
            Alert.alert("Couldn't delete it", err);
            return;
          }
          setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        },
      },
    ]);
  };

  const open = (list: NightPhoto[], index: number) => setViewing({ ids: list.map((p) => p.id), index });
  const close = useCallback(() => setViewing(null), []);

  const tile = (p: NightPhoto, list: NightPhoto[], i: number, size: number) => (
    <Pressable
      key={p.id}
      onPress={() => open(list, i)}
      style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && { opacity: 0.85 }]}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Photo from ${(p.uploader_name ?? "someone").split(" ")[0]}`}
    >
      {p.url ? (
        <Image
          source={{ uri: p.url, cacheKey: p.path }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <ImageIcon size={20} color={colors.iconFaint} strokeWidth={1.4} />
      )}
    </Pressable>
  );

  const uploading = progress
    ? `Adding ${progress.index} of ${progress.total}${
        progress.fraction > 0 && progress.fraction < 1 ? ` · ${Math.round(progress.fraction * 100)}%` : "…"
      }`
    : null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>Photos{photos.length ? ` (${photos.length})` : ""}</Text>
        <Button
          title={progress ? "Adding…" : "Add photos"}
          variant="outline"
          size="sm"
          disabled={!!progress}
          leadingIcon={<ImagePlus size={14} color={colors.text} />}
          onPress={add}
        />
      </View>

      {/* Its own line, not the button: a percentage on a dimmed button
          reads as disabled, and this is the part people watch. */}
      {progress ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.muted}>{uploading}</Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(((progress.index - 1 + progress.fraction) / progress.total) * 100)}%` },
              ]}
            />
          </View>
        </View>
      ) : null}

      <ErrorBanner message={error} />

      {mine.length ? (
        <>
          <Text style={styles.sub}>Your photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {mine.map((p, i) => tile(p, mine, i, STRIP_TILE))}
          </ScrollView>
        </>
      ) : null}

      {photos.length ? (
        <>
          {mine.length ? <Text style={styles.sub}>Everyone&apos;s</Text> : null}
          <View style={styles.grid}>{photos.map((p, i) => tile(p, photos, i, GRID_TILE))}</View>
        </>
      ) : loaded && !error ? (
        <Text style={styles.muted}>No photos yet. Add yours from the night.</Text>
      ) : null}

      <NightPhotoViewer
        photos={photos}
        ids={viewing?.ids ?? null}
        startIndex={viewing?.index ?? 0}
        userId={userId}
        people={people}
        busy={busy}
        onClose={close}
        onTag={tag}
        onRemoveMyTag={untagMe}
        onDelete={remove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  eyebrow: { ...typography.eyebrow, color: colors.textSecondary },
  sub: { ...typography.caption, color: colors.textSecondary },
  muted: { ...typography.caption, color: colors.textSecondary },
  strip: { gap: spacing.sm },
  track: { height: 4, borderRadius: radii.pill, backgroundColor: colors.lineStrong, overflow: "hidden" },
  fill: { height: 4, backgroundColor: colors.brand },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  tile: {
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
});
