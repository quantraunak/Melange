import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Plus, X } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Glass } from "@/components/ui/Glass";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PhotoViewer } from "@/components/PhotoViewer";
import { colors, fonts, radii, typography } from "@/lib/theme";
import { PAY_TYPES, ROLES, uploadFile, type PayType } from "@/lib/db";
import { SCENES } from "@/lib/scenes";

const MAX_IMAGES = 5;

export type ProjectFormValues = {
  title: string;
  description: string;
  roles: string[];
  projectStart: string | null; // YYYY-MM-DD
  projectEnd: string | null;
  location: string;
  /** sd / la / sf / other_ca / remote, or null. */
  region: string | null;
  isRemote: boolean;
  payTypes: PayType[];
  compensation: string;
  mediaUrls: string[];
};

type Asset =
  | { kind: "remote"; url: string }
  | { kind: "local"; uri: string; mimeType?: string; width?: number; height?: number };

const STEPS = ["Project", "Who", "When & where", "Pay & photos"] as const;

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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const [region, setRegion] = useState<string | null>(initial?.region ?? null);
  const [isRemote, setIsRemote] = useState(initial?.isRemote ?? false);
  const [payTypes, setPayTypes] = useState<PayType[]>(initial?.payTypes ?? []);
  const [otherRole, setOtherRole] = useState("");
  /** "Other" tapped: the box to type a role opens under the chips. */
  const [otherOpen, setOtherOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [compensation, setCompensation] = useState(initial?.compensation ?? "");
  const [assets, setAssets] = useState<Asset[]>(
    (initial?.mediaUrls ?? []).map((url) => ({ kind: "remote", url }))
  );
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /**
   * What the upload is actually doing. The old copy said "Uploading images…"
   * next to a spinner that never changed, so a stalled upload and a slow one
   * looked identical and there was nothing to do but force-quit.
   */
  const [progress, setProgress] = useState<{
    index: number;
    total: number;
    fraction: number;
    attempt: number;
  } | null>(null);

  // Roles typed under "Other" show as chips like the rest.
  const customRoles = roles.filter((r) => !(ROLES as readonly string[]).includes(r));

  const addOtherRole = () => {
    const r = otherRole.trim();
    if (!r) return;
    setRoles((prev) => (prev.some((x) => x.toLowerCase() === r.toLowerCase()) ? prev : [...prev, r]));
    setOtherRole("");
  };

  // Typed under "Other" and never added with +: it still counts. Without
  // this, typing "Tattoo artist" and tapping Next dropped it without a word.
  const rolesWithTyped = (): string[] => {
    const r = otherRole.trim();
    if (!r || roles.some((x) => x.toLowerCase() === r.toLowerCase())) return roles;
    return [...roles, r];
  };

  const togglePay = (k: PayType) => {
    Haptics.selectionAsync();
    setPayTypes((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

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
      Alert.alert("Photo access needed", "Allow photo access in Settings to add photos.");
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
      width: a.width,
      height: a.height,
    }));
    setAssets((prev) => [...prev, ...newAssets].slice(0, MAX_IMAGES));
  };

  const removeAsset = (idx: number) => setAssets((prev) => prev.filter((_, i) => i !== idx));

  const validateStep = (s: number): string | null => {
    // Only a title is required. Who, dates, place, pay and photos are optional.
    if (s === 0 && !title.trim()) return "Give your project a title.";
    if (s === 2) {
      if (startText.trim() && !startIso) return "Start date: try 10/18/2026.";
      if (endText.trim() && !endIso) return "End date: try 10/19/2026.";
      if (startIso && endIso && endIso < startIso) return "The end date is before the start.";
    }
    return null;
  };

  const next = () => {
    const v = validateStep(step);
    if (v) return setError(v);
    setError(null);
    if (step === 1) addOtherRole();
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
    const toUpload = assets.filter((a) => a.kind === "local").length;
    let done = 0;
    for (const a of assets) {
      if (a.kind === "remote") {
        finalUrls.push(a.url);
      } else {
        setProgress({ index: done + 1, total: toUpload, fraction: 0, attempt: 1 });
        const { url, error: upErr } = await uploadFile(
          userId,
          "posts",
          a.uri,
          a.mimeType || "image/jpeg",
          {
            width: a.width,
            height: a.height,
            onProgress: (p) =>
              setProgress({
                index: done + 1,
                total: toUpload,
                fraction: p.fraction,
                attempt: p.attempt,
              }),
          }
        );
        if (upErr || !url) {
          // Everything typed so far stays on screen: the form is not reset, so
          // the only thing lost is the retry.
          setUploading(false);
          setProgress(null);
          setError(upErr || "Image upload failed.");
          return;
        }
        done += 1;
        finalUrls.push(url);
      }
    }
    setUploading(false);
    setProgress(null);

    const { error: submitErr } = await onSubmit({
      title: title.trim(),
      description: description.trim(),
      roles: rolesWithTyped(),
      projectStart: startIso,
      projectEnd: endIso ?? startIso,
      location: location.trim(),
      region,
      isRemote,
      payTypes,
      compensation: compensation.trim(),
      mediaUrls: finalUrls,
    });
    if (submitErr) setError(submitErr);
  };

  const showSpinner = uploading || busy;
  const last = step === STEPS.length - 1;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.progress}>
        {STEPS.map((label, i) => (
          <Pressable key={label} onPress={() => i < step && setStep(i)} style={styles.progressItem}>
            <View style={[styles.bar, i <= step && styles.barOn]} />
            <Text style={[styles.barLabel, i === step && styles.barLabelOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <Text style={styles.stepTitle}>What&apos;s your project?</Text>
            <Field label="Title">
              <Input value={title} onChangeText={setTitle} placeholder="e.g. Portfolio shoot, need a stylist" autoFocus />
            </Field>
            <Field label="About it" hint="What it is and what you need help with.">
              <TextArea
                value={description}
                onChangeText={setDescription}
                placeholder="I'm a model building my portfolio. Looking for a stylist and a photographer this month."
                numberOfLines={4}
              />
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>Who are you looking for?</Text>
            <ChipRow style={{ marginTop: 4 }}>
              {ROLES.filter((r) => r !== "Other").map((r) => (
                <Chip key={r} label={r} selected={roles.includes(r)} onPress={() => toggleRole(r)} />
              ))}
              {customRoles.map((r) => (
                <Chip key={r} label={r} selected onPress={() => toggleRole(r)} />
              ))}
              <Chip
                label="Other"
                selected={otherOpen}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (otherOpen) addOtherRole();
                  setOtherOpen((o) => !o);
                }}
              />
            </ChipRow>
            {otherOpen ? (
              <Field label="Who else?" hint="Type it, then tap + to add more than one.">
                <View style={styles.otherRow}>
                  <Input
                    value={otherRole}
                    onChangeText={setOtherRole}
                    placeholder="e.g. Tattoo artist"
                    onSubmitEditing={addOtherRole}
                    returnKeyType="done"
                    autoFocus
                    containerStyle={{ flex: 1 }}
                  />
                  <Pressable onPress={addOtherRole} style={styles.otherAdd} accessibilityLabel="Add">
                    <Plus size={18} color={colors.onBrand} />
                  </Pressable>
                </View>
              </Field>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.stepTitle}>When and where?</Text>
            <View style={styles.twoCol}>
              <Field label="Starts" style={{ flex: 1 }} hint={startIso ? prettyDate(startIso) : "Optional"}>
                <Input value={startText} onChangeText={setStart} placeholder="10/18/2026" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
              </Field>
              <Field label="Ends" style={{ flex: 1 }} hint={endIso ? prettyDate(endIso) : "Optional"}>
                <Input value={endText} onChangeText={setEnd} placeholder="10/19/2026" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
              </Field>
            </View>
            <Field label="Area">
              <ChipRow>
                {SCENES.filter((r) => r.id !== "remote").map((r) => (
                  <Chip
                    key={r.id}
                    label={r.label}
                    selected={region === r.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRegion(region === r.id ? null : r.id);
                    }}
                  />
                ))}
              </ChipRow>
            </Field>
            <Pressable
              style={styles.checkRow}
              onPress={() => {
                Haptics.selectionAsync();
                setIsRemote((v) => !v);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isRemote }}
            >
              <View style={[styles.checkbox, isRemote && styles.checkboxOn]}>
                {isRemote ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
              </View>
              <Text style={styles.checkLabel}>Can be done remotely</Text>
            </Pressable>
            <Field label="Place (optional)">
              <Input value={location} onChangeText={setLocation} placeholder="e.g. Echo Park, or a studio downtown" />
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.stepTitle}>How are people paid?</Text>
            <View style={styles.payList}>
              {PAY_TYPES.map((p) => {
                const on = payTypes.includes(p.key);
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => togglePay(p.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Glass variant="soft" radius={radii.md} style={[styles.payRow, on && styles.payRowOn]}>
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.payLabel}>{p.label}</Text>
                        <Text style={styles.payHint}>{p.hint}</Text>
                      </View>
                    </Glass>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Details (optional)" hint="Rate, meals, travel.">
              <Input value={compensation} onChangeText={setCompensation} placeholder="e.g. $150/day, lunch on set" />
            </Field>

            <Field label="Photos for your project (optional)" hint={`Up to ${MAX_IMAGES}. The first one shows on Discover. Tap one to see it bigger.`}>
              <View style={styles.images}>
                {assets.map((a, idx) => (
                  <View key={`${idx}-${a.kind === "remote" ? a.url : a.uri}`} style={styles.imageThumb}>
                    <Pressable onPress={() => setViewing(idx)} accessibilityLabel="See photo bigger" style={{ width: "100%", height: "100%" }}>
                      <Image source={{ uri: a.kind === "remote" ? a.url : a.uri }} style={{ width: "100%", height: "100%" }} />
                    </Pressable>
                    <Pressable style={styles.imageRemove} onPress={() => removeAsset(idx)} hitSlop={6}>
                      <X size={14} color={colors.white} />
                    </Pressable>
                  </View>
                ))}
                {assets.length < MAX_IMAGES ? (
                  <Pressable style={styles.imageAdd} onPress={addImage}>
                    <ImagePlus size={22} color={colors.iconFaint} />
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
            <Text style={styles.uploadHintText}>
              {progress
                ? progress.attempt > 1
                  ? `Photo ${progress.index} of ${progress.total} · retrying`
                  : `Photo ${progress.index} of ${progress.total} · ${Math.round(
                      progress.fraction * 100
                    )}%`
                : "Getting your photos ready…"}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <PhotoViewer
        photos={assets.map((a) => (a.kind === "remote" ? a.url : a.uri))}
        index={viewing}
        onClose={() => setViewing(null)}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  progressItem: { flex: 1, gap: 6 },
  bar: { height: 3, borderRadius: radii.sm, backgroundColor: colors.lineStrong },
  barOn: { backgroundColor: colors.brand },
  barLabel: { ...typography.micro, color: colors.iconFaint },
  barLabelOn: { color: colors.text, fontFamily: fonts.semibold },
  scroll: { padding: 16, gap: 14, paddingBottom: 24 },
  stepTitle: typography.display1,
  stepHint: { ...typography.caption, marginTop: -6 },
  twoCol: { flexDirection: "row", gap: 10 },
  payList: { gap: 8 },
  payRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  payRowOn: { borderColor: colors.accent },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  checkLabel: typography.body,
  otherRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  otherAdd: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  payLabel: typography.headline,
  payHint: typography.caption,
  images: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageThumb: {
    width: 92,
    height: 92,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
    position: "relative",
  },
  imageRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  imageAdd: {
    width: 92,
    height: 92,
    borderRadius: radii.sm,
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  imageAddText: { ...typography.micro, fontFamily: fonts.semibold },
  uploadHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  uploadHintText: typography.caption,
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
  },
});
