import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { createEvent, EVENT_CATEGORIES, getEvent, updateEvent, type EventCategory } from "@/lib/events";
import { normalizeDate } from "@/components/ProjectForm";

const pad = (n: number) => String(n).padStart(2, "0");

/** "10/18/2026" for a Date, the format the field asks for. */
function dateText(d: Date): string {
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

/** "7:30" and pm for a Date. */
function timeParts(d: Date): { text: string; pm: boolean } {
  const h = d.getHours();
  return { text: `${h % 12 || 12}:${pad(d.getMinutes())}`, pm: h >= 12 };
}

/**
 * "7", "7:30", "730", "7:30pm", "19:30". Returns hours and minutes, or null
 * when it isn't a time. An am/pm typed in the field wins over the toggle.
 */
export function parseTime(raw: string, pmToggle: boolean): { h: number; m: number } | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  const t = /^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p)?$/.exec(s);
  if (!t) return null;
  let h = Number(t[1]);
  const m = t[2] === undefined ? 0 : Number(t[2]);
  if (m > 59 || h > 23) return null;
  const suffix = t[3];
  if (h <= 12) {
    const pm = suffix ? suffix.startsWith("p") : pmToggle;
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  } else if (suffix) {
    return null; // "19pm"
  }
  return { h, m };
}

export default function NewEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useAuth();
  /** Set when editing an event you host. */
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("other");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [pm, setPm] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [city, setCity] = useState("");
  const [capacity, setCapacity] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");
  const [howToPay, setHowToPay] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  /** The cover already on an event being edited. */
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An event belongs to a region; the host's own is the likely one. Only
  // fills an empty choice, so a slow profile read can't undo a pick.
  useEffect(() => {
    if (!userId || editId) return;
    getProfile(userId).then(({ data }) => {
      if (isScene(data?.scene)) setScene((s) => s ?? (data.scene as Scene));
    });
  }, [userId, editId]);

  // Editing: fill the form from the event.
  useEffect(() => {
    if (!userId || !editId) return;
    getEvent(editId, userId).then(({ data, error: err }) => {
      setLoadingEdit(false);
      if (!data) {
        setError(err || "Couldn't load this event.");
        return;
      }
      if (data.host_id !== userId) {
        setError("Only the host can edit this event.");
        return;
      }
      const d = new Date(data.start_at);
      setTitle(data.title);
      setDescription(data.description ?? "");
      setCategory(data.category);
      setDateStr(dateText(d));
      if (data.time_set !== false) {
        const t = timeParts(d);
        setTimeStr(t.text);
        setPm(t.pm);
      }
      setLocationName(data.location_name ?? "");
      setCity(data.city ? data.city.replace(/\b\w/g, (c) => c.toUpperCase()) : "");
      setCapacity(data.capacity ? String(data.capacity) : "");
      setIsPaid(!!data.is_paid);
      setPrice(data.price ?? "");
      setHowToPay(data.how_to_pay ?? "");
      setCoverUrl(data.cover_url);
      if (isScene(data.scene)) setScene(data.scene as Scene);
    });
  }, [userId, editId]);

  if (!userId) return null;

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Allow photo access to add a cover.");
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
      setError("Add a name for the event.");
      return;
    }
    const iso = normalizeDate(dateStr);
    if (!iso) {
      setError(dateStr.trim() ? "Date: try 10/18/2026." : "Add the date.");
      return;
    }
    const time = timeStr.trim() ? parseTime(timeStr, pm) : null;
    if (timeStr.trim() && !time) {
      setError("Time: try 7:30.");
      return;
    }
    if (isPaid && !howToPay.trim()) {
      setError("Say how people pay, like Venmo @name or cash at the door.");
      return;
    }
    const [y, mo, da] = iso.split("-").map(Number);
    // With no time, noon: the same calendar day in every timezone.
    const start = new Date(y, mo - 1, da, time ? time.h : 12, time ? time.m : 0, 0, 0);

    setBusy(true);
    setError(null);
    // Everything below can throw (upload, network, PostgREST). Without this
    // try/finally a throw left busy stuck true and the form dead.
    try {
      let cover = coverUrl ?? undefined;
      if (coverUri) {
        const { url, error: upErr } = await uploadFile(userId, "posts", coverUri, "image/jpeg");
        if (upErr || !url) {
          setError(upErr || "Cover upload failed.");
          return;
        }
        cover = url;
      }

      const fields = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        start_at: start.toISOString(),
        location_name: locationName.trim() || undefined,
        city: city.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        cover_url: cover,
        scene,
        is_paid: isPaid,
        price: isPaid ? price.trim() || undefined : undefined,
        how_to_pay: isPaid ? howToPay.trim() || undefined : undefined,
        time_set: !!time,
      };

      if (editId) {
        const { error: upErr } = await updateEvent(editId, {
          ...fields,
          description: fields.description ?? null,
          location_name: fields.location_name ?? null,
          city: fields.city ?? null,
          capacity: fields.capacity ?? null,
          cover_url: fields.cover_url ?? null,
          price: fields.price ?? null,
          how_to_pay: fields.how_to_pay ?? null,
        });
        if (upErr) {
          setError(upErr);
          return;
        }
        router.back();
        return;
      }

      const { error: createErr } = await createEvent(userId, fields);
      if (createErr) {
        setError(createErr);
        return;
      }
      trackEvent("event_created", { category, city: city.trim() || "", scene: scene ?? "", paid: isPaid });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the event.");
    } finally {
      setBusy(false);
    }
  };

  const shownCover = coverUri ?? coverUrl;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>{editId ? "Edit event" : "Post an event"}</Text>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Close">
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      {loadingEdit ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Pressable style={styles.coverBox} onPress={pickCover}>
          {shownCover ? (
            <Image source={{ uri: shownCover }} style={styles.coverImg} />
          ) : (
            <>
              <ImagePlus size={22} color={colors.iconFaint} />
              <Text style={styles.coverLabel}>Add a photo (optional)</Text>
            </>
          )}
        </Pressable>

        <Field label="Name">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Open mic night"
            style={styles.input}
            placeholderTextColor={colors.textTertiary}
          />
        </Field>

        <Field label="About it">
          <TextArea
            value={description}
            onChangeText={setDescription}
            placeholder="Doors at 7. Sign up to perform at the door."
            numberOfLines={4}
          />
        </Field>

        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.catGrid}>
          {EVENT_CATEGORIES.map((c) => {
            const on = category === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[styles.catChip, on && styles.catChipOn]}
              >
                <Text style={[styles.catText, on && styles.catTextOn]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <Field label="Date" style={{ flex: 1 }}>
            <TextInput
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="10/18/2026"
              style={styles.input}
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          </Field>
          <Field label="Time (optional)" style={{ flex: 1 }}>
            <View style={styles.timeRow}>
              <TextInput
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="7:30"
                style={[styles.input, { flex: 1 }]}
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
              <View style={styles.ampm}>
                {(["AM", "PM"] as const).map((label) => {
                  const on = (label === "PM") === pm;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setPm(label === "PM")}
                      style={[styles.ampmBtn, on && styles.ampmOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.ampmText, on && styles.ampmTextOn]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Field>
        </View>

        <Field label="Area">
          <SceneChips<Scene | null> value={scene} onChange={(s) => setScene(s === scene ? null : s)} />
        </Field>

        <Field label="Place">
          <TextInput
            value={locationName}
            onChangeText={setLocationName}
            placeholder="The Echo"
            style={styles.input}
            placeholderTextColor={colors.textTertiary}
          />
        </Field>

        <Field label="City">
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Los Angeles"
            style={styles.input}
            placeholderTextColor={colors.textTertiary}
          />
        </Field>

        <Text style={styles.sectionLabel}>Cost</Text>
        <View style={styles.costRow}>
          {([false, true] as const).map((paid) => {
            const on = isPaid === paid;
            return (
              <Pressable
                key={String(paid)}
                onPress={() => setIsPaid(paid)}
                style={[styles.catChip, styles.costChip, on && styles.catChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.catText, on && styles.catTextOn]}>{paid ? "Paid" : "Free"}</Text>
              </Pressable>
            );
          })}
        </View>
        {isPaid ? (
          <>
            <Field label="Price">
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="$10"
                style={styles.input}
                placeholderTextColor={colors.textTertiary}
                maxLength={60}
              />
            </Field>
            <Field label="How to pay">
              <TextArea
                value={howToPay}
                onChangeText={setHowToPay}
                placeholder="Venmo @yourname, or cash at the door"
                numberOfLines={2}
                maxLength={300}
              />
            </Field>
          </>
        ) : null}

        <Field label="Spots (optional)">
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
        <Button title={editId ? "Save" : "Post"} variant="primary" loading={busy} onPress={onSubmit} />
      </ScrollView>
      )}
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
  headerTitle: { ...typography.headline },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 12 },
  timeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  ampm: { flexDirection: "row", borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.sm, overflow: "hidden" },
  ampmBtn: { paddingHorizontal: 8, paddingVertical: 10, backgroundColor: colors.white },
  ampmOn: { backgroundColor: colors.surface },
  ampmText: { ...typography.caption, color: colors.textSecondary },
  ampmTextOn: { color: colors.text, fontFamily: fonts.semibold },
  costRow: { flexDirection: "row", gap: 8 },
  costChip: { width: undefined, minWidth: 96, paddingHorizontal: 16 },
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
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  catChipOn: { borderColor: colors.text, backgroundColor: colors.surface },
  catText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  catTextOn: { color: colors.text, fontFamily: fonts.semibold },
  input: { ...inputText, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: colors.white },
});
