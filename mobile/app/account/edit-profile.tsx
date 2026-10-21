import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { X } from "lucide-react-native";

import { PortfolioPhotos } from "@/components/PortfolioPhotos";
import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, radii, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { getProfile, ROLES, updateProfile, VIBE_PRESETS } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { normalizeSocialUrl } from "@/lib/reviews";
import { supabase } from "@/lib/supabase";
import { isScene, setHandle, setScene, type Scene } from "@/lib/scenes";
import { SceneChips } from "@/components/SceneChips";

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
    // The profile is saved; a stale verification badge isn't worth blocking
    // the screen over, but it is worth a line in the log rather than silence.
    const { error: verErr } = await supabase.rpc("refresh_profile_verification", { p_user_id: userId });
    if (verErr) console.warn("refresh_profile_verification failed", verErr.message);
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

            {/* Photos save as they're picked, not on Save: they're files. */}
            {userId ? (
              <Field label="Photos">
                <PortfolioPhotos userId={userId} photos={photos} onChange={setPhotos} onError={setError} />
              </Field>
            ) : null}

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
