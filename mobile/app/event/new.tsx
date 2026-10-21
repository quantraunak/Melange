import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextArea } from "@/components/ui/TextArea";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, radii, typography, inputText } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { getProfile, uploadFile } from "@/lib/db";
import { isScene, type Scene } from "@/lib/scenes";
import { SceneChips } from "@/components/SceneChips";
import { createEvent, EVENT_CATEGORIES, type EventCategory } from "@/lib/events";

function defaultStartLocal(): string {
  const d = new Date(Date.now() + 48 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Parse what someone typed into the Starts field as a *local* instant, or
 * return null if it isn't a date at all.
 *
 * Two bugs lived in the one-line `new Date(local).toISOString()` this
 * replaces:
 *
 * 1. Anything Date could not parse ("next friday", "10/20", a half-typed
 *    value) made toISOString() throw RangeError. onSubmit had no try/catch,
 *    so the throw escaped as an unhandled rejection after setBusy(true) —
 *    the Publish button span forever and no error was ever shown.
 * 2. A bare "2026-10-20" — which the field's own hint invites — is parsed by
 *    spec as UTC midnight, while every value with a time in it is parsed as
 *    local. West of UTC that stored the event on the previous day, and with
 *    the 4-hour default duration it could land in "Already happened"
 *    immediately. Same fix the rest of the app uses: anchor a date-only
 *    value at 12:00 local (see projectDates in src/lib/db.ts and monthYear
 *    in app/profile/[userId].tsx), and build the Date from explicit
 *    components so no string-parsing rule can reinterpret it.
 */
function parseLocalStart(raw: string): Date | null {
  const s = raw.trim().replace(" ", "T");
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}):(\d{2}))?$/.exec(s);
  if (!m) return null;
  const [, yy, mm, dd, hh, mi] = m;
  const year = Number(yy);
  const month = Number(mm) - 1;
  const day = Number(dd);
  // Noon, not midnight, when only a date was given: it is the same calendar
  // day in every timezone the value might later be rendered in.
  const hour = hh === undefined ? 12 : Number(hh);
  const minute = mi === undefined ? 0 : Number(mi);
  if (hour > 23 || minute > 59) return null;
  const d = new Date(year, month, day, hour, minute, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  // Date rolls overflow forward (Feb 31 becomes Mar 3). Reject instead of
  // silently publishing an event on a day nobody typed.
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

export default function NewEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("photo_walk");
  const [startLocal, setStartLocal] = useState(defaultStartLocal);
  const [locationName, setLocationName] = useState("");
  const [city, setCity] = useState("");
  const [capacity, setCapacity] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A night belongs to a scene; the host's own is the likely one. Only fills
  // an empty choice, so a slow profile read can't undo a pick.
  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then(({ data }) => {
      if (isScene(data?.scene)) setScene((s) => s ?? (data.scene as Scene));
    });
  }, [userId]);

  if (!userId) return null;

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo permission is required for a cover image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const onSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!startLocal.trim()) {
      setError("Start date and time are required.");
      return;
    }
    // Parse before setBusy, so an unparseable value is an error message
    // rather than a Publish button that spins for the rest of the session.
    const start = parseLocalStart(startLocal);
    if (!start) {
      setError("Use the format 2026-10-16T14:30, or just 2026-10-16 for the date.");
      return;
    }
    setBusy(true);
    setError(null);

    // Everything below can throw (upload, network, PostgREST). Without this
    // try/finally a throw left busy stuck true and the form dead.
    try {
      let coverUrl: string | undefined;
      if (coverUri) {
        const { url, error: upErr } = await uploadFile(userId, "posts", coverUri, "image/jpeg");
        if (upErr || !url) {
          setError(upErr || "Cover upload failed.");
          return;
        }
        coverUrl = url;
      }

      const { error: createErr } = await createEvent(userId, {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        start_at: start.toISOString(),
        location_name: locationName.trim() || undefined,
        city: city.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        cover_url: coverUrl,
        scene,
      });

      if (createErr) {
        setError(createErr);
        return;
      }
      trackEvent("event_created", { category, city: city.trim() || "", scene: scene ?? "" });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish the event.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Host a night</Text>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          A night out, a photo walk, a screening, a small show. Everyone going shares a chat
          before it, and can heart each other for three days after.
        </Text>

        <Pressable style={styles.coverBox} onPress={pickCover}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImg} />
          ) : (
            <>
              <ImagePlus size={22} color={colors.iconFaint} />
              <Text style={styles.coverLabel}>Add cover photo (optional)</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.catGrid}>
          {EVENT_CATEGORIES.map((c) => {
            const on = category === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[styles.catChip, on && styles.catChipOn]}
              >
                <Text style={styles.catEmoji}>{c.emoji}</Text>
                <Text style={[styles.catText, on && styles.catTextOn]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="Scene" hint="Nights show first to people in this scene.">
          <SceneChips<Scene | null> value={scene} onChange={(s) => setScene(s === scene ? null : s)} />
        </Field>

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Golden hour photo walk in Brooklyn"
            style={styles.input}
            placeholderTextColor={colors.textTertiary}
          />
        </Field>

        <Field label="Description">
          <TextArea
            value={description}
            onChangeText={setDescription}
            placeholder="What to bring, meetup spot, vibe..."
            numberOfLines={4}
          />
        </Field>

        <Field
          label="Starts (local time)"
          hint="Already happened? Put the date it was on — a date on its own is fine."
        >
          <TextInput
            value={startLocal}
            onChangeText={setStartLocal}
            placeholder="2026-10-16T14:30"
            style={styles.input}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
          />
        </Field>

        <Field label="Location name">
          <TextInput
            value={locationName}
            onChangeText={setLocationName}
            placeholder="Washington Square Park"
            style={styles.input}
            placeholderTextColor={colors.textTertiary}
          />
        </Field>

        <Field label="City">
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="New York"
            style={styles.input}
            placeholderTextColor={colors.textTertiary}
          />
        </Field>

        <Field label="Capacity (optional)">
          <TextInput
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
            placeholder="e.g. 20"
            style={styles.input}
            placeholderTextColor={colors.textTertiary}
          />
        </Field>

        <ErrorBanner message={error} />
        <Button title="Publish" variant="primary" loading={busy} onPress={onSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
  },
  headerTitle: { ...typography.headline, color: colors.brandText },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  hint: { ...typography.caption, color: colors.textSecondary },
  coverBox: {
    height: 120,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  coverImg: { width: "100%", height: "100%" },
  coverLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  sectionLabel: { ...typography.caption, fontFamily: fonts.semibold, color: colors.textSecondary },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    width: "30%",
    minWidth: 96,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  catChipOn: { borderColor: colors.brandText, backgroundColor: colors.surfaceSunken },
  catEmoji: { ...typography.headline },
  catText: { ...typography.micro, color: colors.textSecondary, textAlign: "center", marginTop: 2 },
  catTextOn: { color: colors.brandText, fontFamily: fonts.semibold },
  input: { ...inputText, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: colors.white },
});
