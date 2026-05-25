import { useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextArea } from "@/components/ui/TextArea";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { uploadFile } from "@/lib/db";
import { createEvent, EVENT_CATEGORIES, type EventCategory } from "@/lib/events";

function defaultStartLocal(): string {
  const d = new Date(Date.now() + 48 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToISO(local: string): string {
  return new Date(local).toISOString();
}

export default function NewEventScreen() {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setBusy(true);
    setError(null);

    let coverUrl: string | undefined;
    if (coverUri) {
      const { url, error: upErr } = await uploadFile(userId, "posts", coverUri, "image/jpeg");
      if (upErr || !url) {
        setBusy(false);
        setError(upErr || "Cover upload failed.");
        return;
      }
      coverUrl = url;
    }

    const { error: createErr } = await createEvent(userId, {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      start_at: localToISO(startLocal),
      location_name: locationName.trim() || undefined,
      city: city.trim() || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      cover_url: coverUrl,
    });

    setBusy(false);
    if (createErr) {
      setError(createErr);
      return;
    }
    trackEvent("event_created", { category, city: city.trim() || "" });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Host an event</Text>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Photo walks, open calls, meetups — bring creatives together in real life.
        </Text>

        <Pressable style={styles.coverBox} onPress={pickCover}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImg} />
          ) : (
            <>
              <ImagePlus size={22} color={colors.textSubtle} />
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

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Golden hour photo walk in Brooklyn"
            style={styles.input}
            placeholderTextColor={colors.textSubtle}
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

        <Field label="Starts (local time)">
          <TextInput
            value={startLocal}
            onChangeText={setStartLocal}
            placeholder="YYYY-MM-DDTHH:mm"
            style={styles.input}
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
          />
        </Field>

        <Field label="Location name">
          <TextInput
            value={locationName}
            onChangeText={setLocationName}
            placeholder="Washington Square Park"
            style={styles.input}
            placeholderTextColor={colors.textSubtle}
          />
        </Field>

        <Field label="City">
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="New York"
            style={styles.input}
            placeholderTextColor={colors.textSubtle}
          />
        </Field>

        <Field label="Capacity (optional)">
          <TextInput
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
            placeholder="e.g. 20"
            style={styles.input}
            placeholderTextColor={colors.textSubtle}
          />
        </Field>

        <ErrorBanner message={error} />
        <Button title="Publish event" variant="primary" loading={busy} onPress={onSubmit} />
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
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.brandText },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  coverBox: {
    height: 120,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  coverImg: { width: "100%", height: "100%" },
  coverLabel: { fontSize: 12, color: colors.textSubtle, marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    width: "30%",
    minWidth: 96,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  catChipOn: { borderColor: colors.brandText, backgroundColor: colors.brandSoft },
  catEmoji: { fontSize: 18 },
  catText: { fontSize: 10, color: colors.textMuted, textAlign: "center", marginTop: 2 },
  catTextOn: { color: colors.brandText, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
});
