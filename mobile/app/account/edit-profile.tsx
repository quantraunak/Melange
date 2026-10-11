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
  });
  const [vibes, setVibes] = useState<string[]>([]);
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
      });
      setVibes(data.vibes ?? []);
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
    const skillsArr = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const { error: err } = await updateProfile(userId, {
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      bio: form.bio.trim() || undefined,
      current_project: form.currentProject.trim() || undefined,
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

            <Field label="Current project">
              <Input
                value={form.currentProject}
                onChangeText={(t) => setForm({ ...form, currentProject: t })}
                placeholder="What you're working on right now"
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
