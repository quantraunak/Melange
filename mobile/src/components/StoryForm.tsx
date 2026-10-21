import { useEffect, useRef, useState } from "react";
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
import { ArrowLeft, ArrowRight, ImagePlus, Plus, UserPlus, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, radii, typography } from "@/lib/theme";
import { ROLES, type CreatorInfo } from "@/lib/db";
import {
  STORY_MAX_CREDITS,
  STORY_MAX_IMAGES,
  normalizeContactLink,
  searchProfiles,
  uploadStoryAssets,
  type StoryAsset,
  type StoryCredit,
  type StoryUploadProgress,
} from "@/lib/stories";

const STEPS = ["What", "Who with", "Photos", "Finish"] as const;

export type StoryFormValues = {
  title: string;
  story: string;
  credits: StoryCredit[];
  mediaUrls: string[];
  contactLink: string | null;
  happenedOn: string | null;
};

type Asset = StoryAsset;

/** "2024-06" from "June 2024", "6/2024", "2024-06". Month precision only. */
export function normalizeMonth(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) return clampMonth(+iso[1], +iso[2]);
  const slash = s.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (slash) return clampMonth(+slash[2], +slash[1]);
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return clampMonth(+yearOnly[1], 1);
  const parsed = new Date(`${s} 1`);
  if (!Number.isNaN(parsed.getTime())) {
    return clampMonth(parsed.getFullYear(), parsed.getMonth() + 1);
  }
  return null;
}

function clampMonth(y: number, m: number): string | null {
  if (m < 1 || m > 12) return null;
  if (y < 1970 || y > new Date().getFullYear() + 1) return null;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function prettyMonth(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "long", year: "numeric" });
}

export function StoryForm({
  userId,
  submitLabel,
  onSubmit,
  busy,
  externalError,
}: {
  userId: string;
  submitLabel: string;
  busy?: boolean;
  externalError?: string | null;
  onSubmit: (values: StoryFormValues) => Promise<{ error: string | null }>;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [credits, setCredits] = useState<StoryCredit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [linkText, setLinkText] = useState("");
  const [whenText, setWhenText] = useState("");
  const [whenIso, setWhenIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /**
   * What the upload is actually doing. The old copy said "Uploading photos…"
   * next to a spinner that never changed, so a stalled upload and a slow one
   * looked identical and there was nothing to do but force-quit.
   */
  const [progress, setProgress] = useState<StoryUploadProgress | null>(null);

  const addCredit = (c: StoryCredit) => {
    if (credits.length >= STORY_MAX_CREDITS) {
      Alert.alert("That's the limit", `Up to ${STORY_MAX_CREDITS} collaborators per story.`);
      return;
    }
    // Same Melange account twice, or the same plain name twice, is a mistake.
    const dupe = credits.some((x) =>
      c.user_id ? x.user_id === c.user_id : !x.user_id && x.name.toLowerCase() === c.name.toLowerCase()
    );
    if (dupe) return;
    Haptics.selectionAsync();
    setCredits((prev) => [...prev, c]);
  };

  const removeCredit = (i: number) => setCredits((prev) => prev.filter((_, idx) => idx !== i));

  const addImage = async () => {
    if (assets.length >= STORY_MAX_IMAGES) {
      Alert.alert("That's the limit", `Up to ${STORY_MAX_IMAGES} photos per story.`);
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
      selectionLimit: STORY_MAX_IMAGES - assets.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    setAssets((prev) =>
      [...prev, ...result.assets.map((a) => ({
        kind: "local" as const,
        uri: a.uri,
        mimeType: a.mimeType,
        width: a.width,
        height: a.height,
      }))].slice(
        0,
        STORY_MAX_IMAGES
      )
    );
  };

  const validateStep = (s: number): string | null => {
    if (s === 0 && !title.trim()) return "Give the story a title.";
    if (s === 2 && assets.length === 0) return "Add at least one photo of the work.";
    if (s === 3) {
      if (whenText.trim() && !whenIso) return "When: try June 2024 or 6/2024.";
      if (linkText.trim()) {
        const { error: linkErr } = normalizeContactLink(linkText);
        if (linkErr) return linkErr;
      }
    }
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

    const { urls: finalUrls, error: upErr } = await uploadStoryAssets(userId, assets, setProgress);
    setUploading(false);
    setProgress(null);
    if (upErr || !finalUrls) {
      // Everything typed so far stays on screen: the form is not reset, so
      // the only thing lost is the retry.
      setError(upErr || "Photo upload failed.");
      return;
    }

    const { url: link } = normalizeContactLink(linkText);
    const { error: submitErr } = await onSubmit({
      title: title.trim(),
      story: story.trim(),
      credits,
      mediaUrls: finalUrls,
      contactLink: link,
      happenedOn: whenIso,
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
            <Text style={styles.stepTitle}>What did you make?</Text>
            <Field label="Title">
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Rooftop editorial for a vintage label"
                autoFocus
              />
            </Field>
            <Field label="How you did it" hint="Optional, but it is the part people read.">
              <TextArea
                value={story}
                onChangeText={setStory}
                placeholder="We shot at golden hour on a borrowed roof. One light, a bedsheet bounce, and a stylist who brought three racks for a two-look shoot…"
                numberOfLines={7}
              />
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <CreditsStep
            userId={userId}
            credits={credits}
            onAdd={addCredit}
            onRemove={removeCredit}
          />
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.stepTitle}>Show the work</Text>
            <Text style={styles.stepHint}>
              The first photo is the cover. Up to {STORY_MAX_IMAGES}.
            </Text>
            <View style={styles.images}>
              {assets.map((a, idx) => (
                <View key={`${idx}-${a.kind === "remote" ? a.url : a.uri}`} style={styles.imageThumb}>
                  <Image
                    source={{ uri: a.kind === "remote" ? a.url : a.uri }}
                    style={{ width: "100%", height: "100%" }}
                  />
                  {idx === 0 ? (
                    <View style={styles.coverTag}>
                      <Text style={styles.coverTagText}>Cover</Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.imageRemove}
                    onPress={() => setAssets((prev) => prev.filter((_, i) => i !== idx))}
                    hitSlop={6}
                  >
                    <X size={14} color={colors.white} />
                  </Pressable>
                </View>
              ))}
              {assets.length < STORY_MAX_IMAGES ? (
                <Pressable style={styles.imageAdd} onPress={addImage}>
                  <ImagePlus size={22} color={colors.iconFaint} />
                  <Text style={styles.imageAddText}>Add</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.stepTitle}>Nearly there</Text>
            <Field label="When was it?" hint={whenIso ? prettyMonth(whenIso) : "Optional. e.g. June 2024"}>
              <Input
                value={whenText}
                onChangeText={(t) => {
                  setWhenText(t);
                  setWhenIso(normalizeMonth(t));
                }}
                placeholder="June 2024"
                autoCapitalize="words"
              />
            </Field>

            <Field
              label="A link to your work"
              hint="Optional. Your portfolio or Instagram — a public page, not an email or phone number."
            >
              <Input
                value={linkText}
                onChangeText={setLinkText}
                placeholder="instagram.com/yourhandle"
                autoCapitalize="none"
                keyboardType="url"
              />
            </Field>

            <View style={styles.privacyNote}>
              <Text style={styles.privacyText}>
                People who want to work with you tap{" "}
                <Text style={styles.privacyStrong}>Work with me</Text>, which goes through the
                usual like and match. Nobody gets a way to contact you directly unless you both
                say yes.
              </Text>
            </View>
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
            title={showSpinner ? "Posting…" : submitLabel}
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

/**
 * Who you made it with.
 *
 * Two ways in, on purpose: pick someone on Melange so the story reaches their
 * profile too, or type a plain name for the many collaborators who will never
 * install this. A record that only counted Melange users would be a record of
 * almost nothing.
 */
function CreditsStep({
  userId,
  credits,
  onAdd,
  onRemove,
}: {
  userId: string;
  credits: StoryCredit[];
  onAdd: (c: StoryCredit) => void;
  onRemove: (i: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CreatorInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const { data } = await searchProfiles(q, userId);
      setResults(data);
      setSearching(false);
    }, 280);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, userId]);

  const addTyped = () => {
    const name = query.trim();
    if (!name) return;
    onAdd({ name, role: pendingRole, user_id: null });
    setQuery("");
    setPendingRole(null);
  };

  return (
    <>
      <Text style={styles.stepTitle}>Who made it with you?</Text>
      <Text style={styles.stepHint}>
        Optional. Anyone on Melange gets the story on their profile too; everyone else is just a
        name, which is fine.
      </Text>

      {credits.length ? (
        <View style={styles.creditList}>
          {credits.map((c, i) => (
            <View key={`${c.name}-${i}`} style={styles.creditPill}>
              <Text style={styles.creditPillName} numberOfLines={1}>
                {c.name}
              </Text>
              {c.role ? <Text style={styles.creditPillRole}>{c.role}</Text> : null}
              {c.user_id ? <View style={styles.dot} /> : null}
              <Pressable hitSlop={8} onPress={() => onRemove(i)} accessibilityLabel={`Remove ${c.name}`}>
                <X size={14} color={colors.iconFaint} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Field label="Add a collaborator">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search Melange, or just type a name"
          autoCapitalize="words"
          leading={<UserPlus size={16} color={colors.iconFaint} />}
        />
      </Field>

      <Text style={styles.roleLabel}>Their role (optional)</Text>
      <ChipRow>
        {ROLES.map((r) => (
          <Chip
            key={r}
            label={r}
            size="sm"
            selected={pendingRole === r}
            onPress={() => setPendingRole((p) => (p === r ? null : r))}
          />
        ))}
      </ChipRow>

      {query.trim().length >= 2 ? (
        <View style={styles.results}>
          {searching ? (
            <View style={styles.searchingRow}>
              <ActivityIndicator size="small" color={colors.iconFaint} />
              <Text style={styles.searchingText}>Searching Melange…</Text>
            </View>
          ) : null}

          {results.map((p) => (
            <Pressable
              key={p.user_id}
              onPress={() => {
                onAdd({ name: p.name, role: pendingRole ?? p.role, user_id: p.user_id ?? null });
                setQuery("");
                setPendingRole(null);
              }}
              style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.85 }]}
            >
              <Avatar creator={p} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{p.name}</Text>
                {p.role ? <Text style={styles.resultRole}>{p.role}</Text> : null}
              </View>
              <Plus size={17} color={colors.brandText} />
            </Pressable>
          ))}

          <Pressable
            onPress={addTyped}
            style={({ pressed }) => [styles.resultRow, styles.typedRow, pressed && { opacity: 0.85 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName}>Add “{query.trim()}”</Text>
              <Text style={styles.resultRole}>
                {pendingRole ? `${pendingRole}, not on Melange` : "Not on Melange"}
              </Text>
            </View>
            <Plus size={17} color={colors.brandText} />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  progressItem: { flex: 1, gap: 6 },
  bar: { height: 3, borderRadius: radii.sm, backgroundColor: colors.lineStrong },
  barOn: { backgroundColor: colors.accent },
  barLabel: { ...typography.micro, color: colors.iconFaint },
  barLabelOn: { color: colors.text, fontFamily: fonts.semibold },
  scroll: { padding: 16, gap: 14, paddingBottom: 24 },
  stepTitle: typography.display1,
  stepHint: { ...typography.caption, marginTop: -6, lineHeight: 19 },

  creditList: { gap: 8 },
  creditPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.sm,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  creditPillName: { ...typography.body, fontFamily: fonts.semibold, flexShrink: 1 },
  creditPillRole: { ...typography.caption, color: colors.textSecondary },
  dot: { width: 6, height: 6, borderRadius: radii.sm, backgroundColor: colors.accent },

  roleLabel: { ...typography.eyebrow, color: colors.textSecondary, marginTop: -4 },

  results: { gap: 2, marginTop: 4 },
  searchingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  searchingText: typography.caption,
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  typedRow: { borderStyle: "dashed" },

  resultName: { ...typography.body, fontFamily: fonts.semibold },
  resultRole: { ...typography.micro },

  images: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageThumb: {
    width: 92,
    height: 92,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
    position: "relative",
  },
  coverTag: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  coverTagText: { ...typography.micro, fontFamily: fonts.semibold, color: colors.text },
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

  // A note on the page, set off by a rule; not a box.
  privacyNote: { paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.lineStrong },
  privacyText: { ...typography.caption, lineHeight: 19 },
  privacyStrong: { color: colors.text, fontFamily: fonts.semibold },

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
