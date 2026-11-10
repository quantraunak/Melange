import { useEffect, useState } from "react";
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

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PortfolioPhotos } from "@/components/PortfolioPhotos";
import { ProjectForm } from "@/components/ProjectForm";
import { colors, fonts, GUTTER, spacing, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { createPost, getProfile, updateProfile } from "@/lib/db";
import { normalizeSocialUrl } from "@/lib/reviews";
import {
  finishApplicantSetup,
  getMyApplicant,
  postFromForm,
  profileFromForm,
  type MyApplicant,
} from "@/lib/intros";

function normalizeLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * "We filled this in from your form."
 *
 * For someone who signed up after filling in a school's Melange form. Step 1
 * is their profile, step 2 their first post, both started from their answers.
 * Nothing is saved to the profile until they tap Save, and nothing is posted
 * until they tap Post: their answers were shared with their matches, not with
 * everyone, so making them public is their call. Shown once
 * (finish_applicant_setup); "Do this later" brings it back next launch.
 */
export default function FromFormScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [applicant, setApplicant] = useState<MyApplicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"profile" | "post">("profile");

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [instagram, setInstagram] = useState("");
  const [link, setLink] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    Promise.all([getMyApplicant(), getProfile(userId)]).then(([a, p]) => {
      if (!alive) return;
      setLoading(false);
      if (!a) {
        router.replace("/(tabs)/connect");
        return;
      }
      setApplicant(a);
      const f = profileFromForm(a);
      // What's already on their profile wins over the form.
      const prof = p.data;
      setName(prof?.name?.trim() || f.name);
      setRole(prof?.role && prof.role !== "other" ? prof.role : f.role);
      setLookingFor(prof?.current_project?.trim() || f.lookingFor);
      setInstagram(prof?.instagram_url?.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "") || f.instagram);
      setLink(prof?.reel_url || f.link);
      setPhotos(prof?.portfolio_urls ?? []);
    });
    return () => {
      alive = false;
    };
  }, [userId, router]);

  const done = async () => {
    await finishApplicantSetup();
    router.replace("/(tabs)/connect");
  };

  if (!userId || loading || !applicant) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      </SafeAreaView>
    );
  }

  const saveProfile = async () => {
    if (!name.trim()) return setError("Add your name.");
    setSaving(true);
    setError(null);
    const { error: err } = await updateProfile(userId, {
      name: name.trim(),
      role: role.trim() || undefined,
      current_project: lookingFor.trim() || undefined,
      // They're looking at the label "Who you're looking for (public)" and
      // tapping Save: that's the consent 19_looking_for_consent.sql asks for.
      looking_for_is_public: lookingFor.trim() ? true : undefined,
      instagram_url: normalizeSocialUrl("instagram", instagram),
      reel_url: normalizeLink(link),
    });
    setSaving(false);
    if (err && !err.startsWith("Saved.")) return setError(err);
    trackEvent("profile_saved");
    setStep("post");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.stepLabel}>{step === "profile" ? "1 of 2 · Your profile" : "2 of 2 · Your post"}</Text>
        <Pressable onPress={() => router.replace("/(tabs)/connect")} hitSlop={10} accessibilityRole="button">
          <Text style={styles.later}>Do this later</Text>
        </Pressable>
      </View>

      {step === "profile" ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>We started your profile from your form</Text>
            <Text style={styles.body}>
              Add a few photos, fix anything that&apos;s off, and save. Nothing is public until you do.
            </Text>

            <Field label="Photos" hint="Your work, or work you love. People look here first.">
              <PortfolioPhotos userId={userId} photos={photos} onChange={setPhotos} onError={setError} emptySlots={3} />
            </Field>
            <Field label="Name">
              <Input value={name} onChangeText={setName} placeholder="Your name" />
            </Field>
            <Field label="What you do">
              <Input value={role} onChangeText={setRole} placeholder="Photographer, writer, musician…" />
            </Field>
            <Field label="Who you're looking for (public)">
              <Input value={lookingFor} onChangeText={setLookingFor} placeholder="A model for a portrait series" />
            </Field>
            <Field label="Instagram">
              <Input value={instagram} onChangeText={setInstagram} placeholder="@yourhandle" autoCapitalize="none" />
            </Field>
            <Field label="Link to your work">
              <Input value={link} onChangeText={setLink} placeholder="yoursite.com" autoCapitalize="none" keyboardType="url" />
            </Field>

            <ErrorBanner message={error} />
            <Button title="Save profile" variant="primary" loading={saving} onPress={saveProfile} />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.postIntro}>
            <Text style={styles.title}>Here&apos;s a post from your idea</Text>
            <Text style={styles.body}>Add pictures, change anything, then post it. Or skip and post later.</Text>
            <ErrorBanner message={error} />
          </View>
          <ProjectForm
            userId={userId}
            initial={postFromForm(applicant)}
            submitLabel="Post"
            busy={posting}
            onSubmit={async (v) => {
              setPosting(true);
              const { data: created, error: err } = await createPost(userId, v.title, v.description, {
                roles: v.roles,
                looking_for: v.roles,
                project_start: v.projectStart ?? undefined,
                project_end: v.projectEnd ?? undefined,
                location: v.location || undefined,
                pay_type: v.payType ?? undefined,
                compensation: v.compensation || undefined,
                media_urls: v.mediaUrls.length ? v.mediaUrls : undefined,
              });
              setPosting(false);
              if (!err) {
                trackEvent("post_created", { roles: v.roles.length, photos: v.mediaUrls.length, from: "form" });
                await finishApplicantSetup();
                if (created) {
                  router.replace({ pathname: "/post/[id]", params: { id: created.id, posted: "1" } });
                } else {
                  router.replace("/(tabs)/connect");
                }
              }
              return { error: err };
            }}
          />
          <Pressable onPress={done} hitSlop={10} style={styles.skip} accessibilityRole="button">
            <Text style={styles.later}>Skip the post for now</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
  },
  stepLabel: { ...typography.eyebrow, color: colors.textSecondary },
  later: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
  scroll: { padding: GUTTER, gap: spacing.lg, paddingBottom: spacing.xxxl },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
  postIntro: { paddingHorizontal: GUTTER, gap: spacing.sm, paddingBottom: spacing.sm },
  skip: { alignSelf: "center", paddingVertical: spacing.md },
});
