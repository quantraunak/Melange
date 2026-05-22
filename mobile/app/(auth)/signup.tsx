import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Logo } from "@/components/Logo";
import { colors, radii } from "@/lib/theme";
import { supabase } from "@/lib/supabase";

const ROLES = [
  { id: "photographer", label: "Photographer" },
  { id: "model", label: "Model" },
  { id: "makeup-artist", label: "Makeup Artist" },
  { id: "stylist", label: "Stylist" },
  { id: "designer", label: "Designer" },
  { id: "other", label: "Other" },
];

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<string>("");
  const [skills, setSkills] = useState("");
  const [bio, setBio] = useState("");
  const [project, setProject] = useState("");

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Please enter your name.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!acceptedTerms) return setError("Please accept the Terms and Privacy Policy to continue.");

    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    const userId = data.user?.id;
    if (!userId) {
      setLoading(false);
      setError(
        "Signup succeeded but no user ID returned. If email confirmation is enabled, check your inbox."
      );
      return;
    }

    const skillsArr = skills.split(",").map((s) => s.trim()).filter(Boolean);

    const { error: profileErr } = await supabase.from("profiles").insert({
      user_id: userId,
      name: name.trim(),
      role: role || null,
      bio: bio.trim() || null,
      current_project: project.trim() || null,
      skills: skillsArr.length ? skillsArr : null,
      avatar_url: null,
    });

    setLoading(false);

    if (profileErr) {
      setError(`Profile insert failed: ${profileErr.message}`);
      return;
    }

    // Auth state listener will route us into the app.
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <Pressable hitSlop={16} onPress={() => router.back()}>
              <ArrowLeft size={22} color={colors.white} />
            </Pressable>
          </View>

          <View style={styles.header}>
            <Logo size={56} stroke={colors.white} />
            <Text style={styles.title}>Create your profile</Text>
            <Text style={styles.subtitle}>Only takes a minute.</Text>
          </View>

          <View style={styles.card}>
            <Field label="Name">
              <Input value={name} onChangeText={setName} placeholder="Your full name" />
            </Field>

            <Field label="Email">
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </Field>

            <View style={styles.row}>
              <Field label="Password" style={{ flex: 1 }}>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  secureTextEntry
                />
              </Field>
              <Field label="Confirm" style={{ flex: 1 }}>
                <Input
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter"
                  secureTextEntry
                />
              </Field>
            </View>

            <Field label="What's your role?">
              <View style={styles.roleGrid}>
                {ROLES.map((r) => {
                  const selected = role === r.id;
                  return (
                    <Pressable
                      key={r.id}
                      style={[styles.rolePill, selected && styles.rolePillSelected]}
                      onPress={() => setRole(r.id)}
                    >
                      {selected ? (
                        <Check size={14} color={colors.brandText} style={{ marginRight: 4 }} />
                      ) : null}
                      <Text style={[styles.rolePillText, selected && styles.rolePillTextSelected]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="Skills" hint="Comma-separated (e.g. Portrait, Lighting, Posing)">
              <Input
                value={skills}
                onChangeText={setSkills}
                placeholder="Portrait Photography, Lighting"
              />
            </Field>

            <Field label="Current project" hint="What are you working on right now?">
              <Input
                value={project}
                onChangeText={setProject}
                placeholder="e.g. Editorial shoot in Brooklyn"
              />
            </Field>

            <Field label="Bio">
              <TextArea
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about your work and what you're looking for."
                numberOfLines={4}
              />
            </Field>

            <Pressable
              style={styles.termsRow}
              onPress={() => setAcceptedTerms((v) => !v)}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxOn]}>
                {acceptedTerms ? <Check size={12} color={colors.white} /> : null}
              </View>
              <Text style={styles.termsText}>
                I'm at least 18 years old and I agree to the{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL("https://melange-psi.vercel.app/terms")}
                >
                  Terms
                </Text>{" "}
                and{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL("https://melange-psi.vercel.app/privacy")}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </Pressable>

            <ErrorBanner message={error} />

            <Button
              title="Create account"
              variant="primary"
              size="lg"
              loading={loading}
              onPress={submit}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Have an account? </Text>
              <Link href="/(auth)/login" style={styles.footerLink}>
                Sign in
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brand },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },
  topBar: { paddingTop: 8, paddingBottom: 12 },
  header: { alignItems: "center", marginBottom: 16, gap: 6 },
  title: { color: colors.white, fontSize: 22, fontWeight: "800", marginTop: 8 },
  subtitle: { color: "#bfdbfe", fontSize: 13 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  row: { flexDirection: "row", gap: 12 },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  rolePillSelected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandText,
  },
  rolePillText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  rolePillTextSelected: { color: colors.brandText },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 4 },
  footerText: { color: colors.textMuted, fontSize: 13 },
  footerLink: { color: colors.brandText, fontSize: 13, fontWeight: "700" },

  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.brandText,
    fontWeight: "700",
  },
});
