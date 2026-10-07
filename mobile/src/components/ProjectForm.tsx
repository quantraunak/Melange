import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { ArrowLeft, ArrowRight, ImagePlus, X } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Glass } from "@/components/ui/Glass";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii, typography } from "@/lib/theme";
import { PAY_TYPES, ROLES, uploadFile, type PayType } from "@/lib/db";

const MAX_IMAGES = 5;

export type ProjectFormValues = {
  title: string;
  description: string;
  roles: string[];
  projectStart: string | null; // YYYY-MM-DD
  projectEnd: string | null;
  location: string;
  payType: PayType | null;
  compensation: string;
  mediaUrls: string[];
};

type Asset =
  | { kind: "remote"; url: string }
  | { kind: "local"; uri: string; mimeType?: string };

const STEPS = ["What", "Roles", "When & where", "Pay & poster"] as const;

/**
 * Accepts "2026-10-18", "10/18", "10/18/26", "Oct 18". Returns YYYY-MM-DD or
 * null. A month/day with no year lands on the next occurrence, so "10/18"
 * typed in November means next year.
 */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return toIso(+iso[1], +iso[2], +iso[3]);
  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (slash) {
    let y = slash[3] ? +slash[3] : undefined;
    if (y !== undefined && y < 100) y += 2000;
    return toIso(y ?? nextYearFor(+slash[1], +slash[2]), +slash[1], +slash[2]);
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    const y = /\d{4}/.test(s) ? parsed.getFullYear() : nextYearFor(m, d);
    return toIso(y, m, d);
  }
  return null;
}

function nextYearFor(m: number, d: number): number {
  const now = new Date();
  const y = now.getFullYear();
  const candidate = new Date(y, m - 1, d, 12);
  return candidate.getTime() < now.getTime() - 86400000 ? y + 1 : y;
}

function toIso(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d, 12);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function prettyDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Quick picks for the most common answers. */
function weekendPicks(): { label: string; start: string; end: string }[] {
  const now = new Date();
  const day = now.getDay(); // 0 Sun
  const toSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + toSat, 12);
  const sun = new Date(sat.getTime() + 86400000);
  const sat2 = new Date(sat.getTime() + 7 * 86400000);
  const sun2 = new Date(sat2.getTime() + 86400000);
  const iso = (d: Date) => toIso(d.getFullYear(), d.getMonth() + 1, d.getDate())!;
  return [
    { label: "This weekend", start: iso(sat), end: iso(sun) },
    { label: "Next weekend", start: iso(sat2), end: iso(sun2) },
  ];
}

export function ProjectForm({
  userId,
  initial,
  submitLabel,
  onSubmit,
  busy,
  externalError,
}: {
  userId: string;
  initial?: Partial<ProjectFormValues>;
  submitLabel: string;
  busy?: boolean;
  externalError?: string | null;
  onSubmit: (values: ProjectFormValues) => Promise<{ error: string | null }>;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [roles, setRoles] = useState<string[]>(initial?.roles ?? []);
  const [startText, setStartText] = useState(initial?.projectStart ? prettyDate(initial.projectStart) : "");
  const [endText, setEndText] = useState(initial?.projectEnd ? prettyDate(initial.projectEnd) : "");
  const [startIso, setStartIso] = useState<string | null>(initial?.projectStart ?? null);
  const [endIso, setEndIso] = useState<string | null>(initial?.projectEnd ?? null);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [payType, setPayType] = useState<PayType | null>(initial?.payType ?? null);
  const [compensation, setCompensation] = useState(initial?.compensation ?? "");
  const [assets, setAssets] = useState<Asset[]>(
    (initial?.mediaUrls ?? []).map((url) => ({ kind: "remote", url }))
  );
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const picks = useMemo(() => weekendPicks(), []);

  const toggleRole = (r: string) => {
    Haptics.selectionAsync();
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const setStart = (text: string) => {
    setStartText(text);
    setStartIso(normalizeDate(text));
  };
  const setEnd = (text: string) => {
    setEndText(text);
    setEndIso(normalizeDate(text));
  };

  const addImage = async () => {
    if (assets.length >= MAX_IMAGES) {
      Alert.alert("That's the limit", `Up to ${MAX_IMAGES} images per project.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo access needed", "Allow photo access in Settings to add a poster.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - assets.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    const newAssets: Asset[] = result.assets.map((a) => ({
      kind: "local",
      uri: a.uri,
      mimeType: a.mimeType,
    }));
    setAssets((prev) => [...prev, ...newAssets].slice(0, MAX_IMAGES));
  };

  const removeAsset = (idx: number) => setAssets((prev) => prev.filter((_, i) => i !== idx));

  const validateStep = (s: number): string | null => {
    // Only a title and a photo are required. Roles, dates and pay are optional.
    if (s === 0 && !title.trim()) return "Give your project a title.";
    if (s === 2) {
      if (startText.trim() && !startIso) return "Start date: try 10/18 or Oct 18.";
      if (endText.trim() && !endIso) return "End date: try 10/19 or Oct 19.";
      if (startIso && endIso && endIso < startIso) return "The end date is before the start.";
    }
    if (s === 3 && assets.length === 0) return "Add at least one photo so people can see what you mean.";
    return null;
  };

  const next = () => {
    const v = validateStep(step);
    if (v) return setError(v);
    setError(null);
    Keyboard.dismiss();
    Haptics.selectionAsync();
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = async () => {
    for (let s = 0; s < STEPS.length; s++) {
      const v = validateStep(s);
      if (v) {
        setStep(s);
        setError(v);
        return;
      }
    }
    setError(null);
    setUploading(true);

    const finalUrls: string[] = [];
    for (const a of assets) {
      if (a.kind === "remote") {
        finalUrls.push(a.url);
      } else {
        const { url, error: upErr } = await uploadFile(userId, "posts", a.uri, a.mimeType || "image/jpeg");
        if (upErr || !url) {
          setUploading(false);
          setError(upErr || "Image upload failed.");
          return;
        }
        finalUrls.push(url);
      }
    }
    setUploading(false);

    const { error: submitErr } = await onSubmit({
      title: title.trim(),
      description: description.trim(),
      roles,
      projectStart: startIso,
      projectEnd: endIso ?? startIso,
      location: location.trim(),
      payType,
      compensation: compensation.trim(),
      mediaUrls: finalUrls,
    });
    if (submitErr) setError(submitErr);
  };

  const showSpinner = uploading || busy;
  const last = step === STEPS.length - 1;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.progress}>
        {STEPS.map((label, i) => (
          <Pressable key={label} onPress={() => i < step && setStep(i)} style={styles.progressItem}>
            <View style={[styles.bar, i <= step && styles.barOn]} />
            <Text style={[styles.barLabel, i === step && styles.barLabelOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <Text style={styles.stepTitle}>What are you making?</Text>
            <Field label="Title">
              <Input value={title} onChangeText={setTitle} placeholder="e.g. Golden-hour rooftop editorial" autoFocus />
            </Field>
            <Field label="Description" hint="One or two lines. What it is, what the look is.">
              <TextArea
                value={description}
                onChangeText={setDescription}
                placeholder="Moody, warm, film-grain look. Looking for a model and a stylist."
                numberOfLines={4}
              />
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>Who do you still need?</Text>
            <Text style={styles.stepHint}>Optional. Tap who you&apos;d love to work with. People apply to the project, not to a role.</Text>
            <ChipRow style={{ marginTop: 4 }}>
              {ROLES.map((r) => (
                <Chip key={r} label={r} selected={roles.includes(r)} onPress={() => toggleRole(r)} />
              ))}
            </ChipRow>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.stepTitle}>When and where?</Text>
            <ChipRow>
              {picks.map((p) => (
                <Chip
                  key={p.label}
                  label={p.label}
                  selected={startIso === p.start && endIso === p.end}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setStartIso(p.start);
                    setEndIso(p.end);
                    setStartText(prettyDate(p.start));
                    setEndText(prettyDate(p.end));
                  }}
                />
              ))}
            </ChipRow>
            <View style={styles.twoCol}>
              <Field label="Starts" style={{ flex: 1 }} hint={startIso ? prettyDate(startIso) : "e.g. 10/18"}>
                <Input value={startText} onChangeText={setStart} placeholder="10/18" autoCapitalize="none" />
              </Field>
              <Field label="Ends" style={{ flex: 1 }} hint={endIso ? prettyDate(endIso) : "optional"}>
                <Input value={endText} onChangeText={setEnd} placeholder="10/19" autoCapitalize="none" />
              </Field>
            </View>
            <Field label="Location">
              <Input value={location} onChangeText={setLocation} placeholder="e.g. Orange, CA" />
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.stepTitle}>How are people paid?</Text>
            <View style={styles.payList}>
              {PAY_TYPES.map((p) => {
                const on = payType === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPayType(p.key);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Glass variant="soft" radius={radii.lg} style={[styles.payRow, on && styles.payRowOn]}>
                      <View style={[styles.radio, on && styles.radioOn]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.payLabel}>{p.label}</Text>
                        <Text style={styles.payHint}>{p.hint}</Text>
                      </View>
                    </Glass>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Detail" hint="Optional: rate, meals, travel.">
              <Input value={compensation} onChangeText={setCompensation} placeholder="e.g. $150/day, lunch on set" />
            </Field>

            <Field label={`Poster or stills (up to ${MAX_IMAGES})`} hint="The first image is the card.">
              <View style={styles.images}>
                {assets.map((a, idx) => (
                  <View key={`${idx}-${a.kind === "remote" ? a.url : a.uri}`} style={styles.imageThumb}>
                    <Image source={{ uri: a.kind === "remote" ? a.url : a.uri }} style={{ width: "100%", height: "100%" }} />
                    <Pressable style={styles.imageRemove} onPress={() => removeAsset(idx)} hitSlop={6}>
                      <X size={14} color={colors.white} />
                    </Pressable>
                  </View>
                ))}
                {assets.length < MAX_IMAGES ? (
                  <Pressable style={styles.imageAdd} onPress={addImage}>
                    <ImagePlus size={22} color={colors.textSubtle} />
                    <Text style={styles.imageAddText}>Add</Text>
                  </Pressable>
                ) : null}
              </View>
            </Field>
          </>
        ) : null}

        <ErrorBanner message={error || externalError || null} />
        {uploading ? (
          <View style={styles.uploadHint}>
            <ActivityIndicator size="small" color={colors.text} />
            <Text style={styles.uploadHintText}>Uploading images…</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Button
            variant="outline"
            size="lg"
            onPress={back}
            leadingIcon={<ArrowLeft size={16} color={colors.text} />}
            title="Back"
          />
        ) : (
          <View />
        )}
        {last ? (
          <Button
            title={showSpinner ? "Saving…" : submitLabel}
            variant="primary"
            size="lg"
            loading={showSpinner}
            onPress={submit}
            style={{ flex: 1 }}
          />
        ) : (
          <Button
            title="Next"
            variant="primary"
            size="lg"
            onPress={next}
            trailingIcon={<ArrowRight size={16} color={colors.onBrand} />}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  progressItem: { flex: 1, gap: 6 },
  bar: { height: 3, borderRadius: 2, backgroundColor: colors.border },
  barOn: { backgroundColor: colors.accent },
  barLabel: { ...typography.tiny, color: colors.textFaint },
  barLabelOn: { color: colors.text, fontWeight: "700" },
  scroll: { padding: 16, gap: 14, paddingBottom: 24 },
  stepTitle: { ...typography.h1, marginTop: 6 },
  stepHint: { ...typography.small, marginTop: -6 },
  twoCol: { flexDirection: "row", gap: 10 },
  payList: { gap: 8 },
  payRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  payRowOn: { borderColor: colors.accent },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  radioOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  payLabel: typography.h3,
  payHint: typography.small,
  images: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageThumb: {
    width: 92,
    height: 92,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
    position: "relative",
  },
  imageRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  imageAdd: {
    width: 92,
    height: 92,
    borderRadius: radii.md,
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  imageAddText: { ...typography.tiny, fontWeight: "600" },
  uploadHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  uploadHintText: typography.small,
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
