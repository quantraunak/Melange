import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Plus, X } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import {
  getProfile,
  PORTFOLIO_MAX_IMAGES,
  ROLES,
  updatePortfolio,
  updateProfile,
  uploadFile,
  VIBE_PRESETS,
} from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { normalizeSocialUrl } from "@/lib/reviews";
import { supabase } from "@/lib/supabase";
import { isScene, setHandle, setScene, type Scene } from "@/lib/scenes";
import { SceneChips } from "@/components/SceneChips";

/** Three columns inside the form's 16pt padding. */
const TILE = (Dimensions.get("window").width - GUTTER * 2 - spacing.sm * 2) / 3;

function normalizeReel(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * Editing a profile is a task, so it gets its own screen.
 *
 * It used to live inline underneath the profile, which meant the tab was a
 * public page and a settings form at the same time: nine text fields and two
 * chip grids scrolling past the credits they were supposed to be describing.
 * Showing and editing are different jobs and now have different screens.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const [form, setForm] = useState({
    name: "",
    role: "",
    bio: "",
    currentProject: "",
    skills: "",
    instagram: "",
    linkedin: "",
    reel: "",
    handle: "",
  });
  /** What the server had when we opened, so Save only calls what changed. */
  const [saved, setSaved] = useState<{ handle: string; scene: Scene | null }>({ handle: "", scene: null });
  const [scene, setSceneChoice] = useState<Scene | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error: err } = await getProfile(userId);
    if (data) {
      setForm({
        name: data.name || "",
        role: data.role || "",
        bio: data.bio || "",
        currentProject: data.current_project || "",
        skills: data.skills?.join(", ") || "",
        instagram: data.instagram_url || "",
        linkedin: data.linkedin_url || "",
        reel: data.reel_url || "",
        handle: data.handle || "",
      });
      const sc = isScene(data.scene) ? data.scene : null;
      setSceneChoice(sc);
      setSaved({ handle: data.handle || "", scene: sc });
      setVibes(data.vibes ?? []);
      setPhotos(data.portfolio_urls ?? []);
    } else if (err) {
      setError(err);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Photos are files, so they save as they are picked rather than on Save.
     They used to be added from the profile tab, where the add tile sat on its
     own under a list it did not belong to. */
  const onAddPhotos = async () => {
    if (!userId) return;
    if (photos.length >= PORTFOLIO_MAX_IMAGES) {
      Alert.alert("Photos full", `Up to ${PORTFOLIO_MAX_IMAGES} photos.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo permission denied", "Enable photo access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: PORTFOLIO_MAX_IMAGES - photos.length,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;

    setPhotosBusy(true);
    setError(null);
    const uploaded: string[] = [];
    for (const asset of result.assets) {
      const { url, error: upErr } = await uploadFile(
        userId,
        "posts",
        asset.uri,
        asset.mimeType || "image/jpeg"
      );
      if (upErr || !url) {
        setError(upErr || "Upload failed.");
        break;
      }
      uploaded.push(url);
    }
    if (uploaded.length) {
      const next = [...photos, ...uploaded];
      const { error: updErr } = await updatePortfolio(userId, next);
      if (updErr) setError(updErr);
      else setPhotos(next);
    }
    setPhotosBusy(false);
  };

  const onRemovePhoto = (idx: number) => {
    if (!userId) return;
    Alert.alert("Remove photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const next = photos.filter((_, i) => i !== idx);
          setPhotosBusy(true);
          const { error: err } = await updatePortfolio(userId, next);
          setPhotosBusy(false);
          if (err) setError(err);
          else setPhotos(next);
        },
      },
    ]);
  };

  const onSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);

    // Handle first: it's the field most likely to be refused ("That handle is
    // taken."), and stopping here leaves nothing half-saved.
    const handle = form.handle.trim().replace(/^@/, "").toLowerCase();
    if (handle !== saved.handle) {
      const { error: hErr, handle: stored } = await setHandle(handle);
      if (hErr) {
        setSaving(false);
        setError(hErr);
        return;
      }
      setSaved((s) => ({ ...s, handle: stored ?? "" }));
    }
    if (scene !== saved.scene) {
      const { error: sErr } = await setScene(scene);
      if (sErr) {
        setSaving(false);
        setError(sErr);
        return;
      }
      setSaved((s) => ({ ...s, scene }));
    }

    const skillsArr = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const { error: err } = await updateProfile(userId, {
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      bio: form.bio.trim() || undefined,
      current_project: form.currentProject.trim() || undefined,
      // Saving from this screen is the consent: it is the screen that shows
      // the field is public, under the label "What you're looking for".
      looking_for_is_public: true,
      skills: skillsArr.length ? skillsArr : undefined,
      vibes: vibes.length ? vibes : [],
      instagram_url: normalizeSocialUrl("instagram", form.instagram),
      linkedin_url: normalizeSocialUrl("linkedin", form.linkedin),
      reel_url: form.reel.trim() ? normalizeReel(form.reel) : null,
    });
    setSaving(false);
    // `err` starting with "Saved." means the row saved and only the reel
    // column is missing on this database — worth saying, not worth blocking.
    if (err && !err.startsWith("Saved.")) {
      setError(err);
      return;
    }
    trackEvent("profile_saved");
    await supabase.rpc("refresh_profile_verification", { p_user_id: userId });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Close">
          <X size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <ErrorBanner message={error} />

            <Field label="Name">
              <Input value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
            </Field>

            <Field label="Handle" hint="Your public page: melange-psi.vercel.app/@handle. Letters, numbers, dots and underscores.">
              <Input
                value={form.handle}
                onChangeText={(t) => setForm({ ...form, handle: t })}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={31}
                leading={<Text style={styles.at}>@</Text>}
              />
            </Field>

            <Field label="Scene" hint="Nights and people from your scene come first.">
              <SceneChips<Scene | null>
                value={scene}
                onChange={(s) => setSceneChoice(s === scene ? null : s)}
              />
            </Field>

            <Field label="What you do" hint="Pick one, or type your own.">
              <ChipRow>
                {ROLES.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    size="sm"
                    selected={form.role === r}
                    onPress={() => setForm({ ...form, role: form.role === r ? "" : r })}
                  />
                ))}
              </ChipRow>
              <Text style={styles.subLabel}>Or type your own</Text>
              <Input
                value={form.role}
                onChangeText={(t) => setForm({ ...form, role: t })}
                placeholder="e.g. Set designer, Creative director"
              />
            </Field>

            <Field label="Reel or portfolio link" hint="Instagram, Vimeo, your site. People look here first.">
              <Input
                value={form.reel}
                onChangeText={(t) => setForm({ ...form, reel: t })}
                placeholder="vimeo.com/you"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </Field>

            <Field label="Photos">
              <View style={styles.grid}>
                {photos.map((url, idx) => (
                  <Pressable
                    key={`${url}-${idx}`}
                    style={styles.tile}
                    onPress={() => onRemovePhoto(idx)}
                    disabled={photosBusy}
                    accessibilityLabel="Remove photo"
                  >
                    <Image source={{ uri: url }} style={styles.tileImg} />
                    <View style={styles.tileRemove}>
                      <X size={12} color={colors.white} />
                    </View>
                  </Pressable>
                ))}
                {photos.length < PORTFOLIO_MAX_IMAGES ? (
                  <Pressable
                    style={[styles.tile, styles.tileAdd]}
                    onPress={onAddPhotos}
                    disabled={photosBusy}
                    accessibilityLabel="Add photos"
                  >
                    {photosBusy ? (
                      <ActivityIndicator color={colors.textTertiary} />
                    ) : (
                      <Plus size={22} color={colors.textTertiary} />
                    )}
                  </Pressable>
                ) : null}
              </View>
            </Field>

            <Field label="Skills and gear" hint="Comma-separated">
              <Input
                value={form.skills}
                onChangeText={(t) => setForm({ ...form, skills: t })}
                placeholder="e.g. Steadicam, Resolve, own a C70"
              />
            </Field>

            <Field label="Bio">
              <TextArea
                value={form.bio}
                onChangeText={(t) => setForm({ ...form, bio: t })}
                numberOfLines={4}
                placeholder="A short bio about your work."
              />
            </Field>

            <Field label="What you're looking for" hint="Shown at the top of your profile.">
              <Input
                value={form.currentProject}
                onChangeText={(t) => setForm({ ...form, currentProject: t })}
                placeholder="e.g. A stylist for an editorial in LA this month"
              />
            </Field>

            <Field label="Instagram">
              <Input
                value={form.instagram}
                onChangeText={(t) => setForm({ ...form, instagram: t })}
                placeholder="@handle or URL"
                autoCapitalize="none"
              />
            </Field>

            <Field label="LinkedIn">
              <Input
                value={form.linkedin}
                onChangeText={(t) => setForm({ ...form, linkedin: t })}
                placeholder="linkedin.com/in/you"
                autoCapitalize="none"
              />
            </Field>

            <Field label="Taste" hint="Helps rank projects for you (up to 5)">
              <View style={styles.vibeRow}>
                {VIBE_PRESETS.map((v) => {
                  const on = vibes.includes(v);
                  return (
                    <Pressable
                      key={v}
                      onPress={() =>
                        setVibes((prev) =>
                          on ? prev.filter((x) => x !== v) : prev.length < 5 ? [...prev, v] : prev
                        )
                      }
                      style={[styles.vibeChip, on && styles.vibeChipOn]}
                    >
                      <Text style={[styles.vibeChipText, on && styles.vibeChipTextOn]}>{v}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
          </ScrollView>

          <SafeAreaView edges={["bottom"]} style={styles.footer}>
            <Button title="Save profile" variant="primary" loading={saving} onPress={onSave} />
          </SafeAreaView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { ...typography.headline, color: colors.text },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 20, paddingBottom: 32 },
  subLabel: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginTop: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: TILE,
    aspectRatio: 1,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  tileImg: { width: "100%", height: "100%" },
  tileAdd: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  tileRemove: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
  at: { ...typography.body, color: colors.textSecondary },
  vibeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vibeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  vibeChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  vibeChipText: { ...typography.caption, color: colors.textSecondary },
  vibeChipTextOn: { color: colors.white, fontFamily: fonts.semibold },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
