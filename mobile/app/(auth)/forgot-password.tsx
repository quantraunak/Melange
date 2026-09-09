import { useRef, useState } from "react";
import {
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
import { ArrowLeft, MailCheck } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Logo } from "@/components/Logo";
import { colors, radii } from "@/lib/theme";
import { supabase } from "@/lib/supabase";

/**
 * Password reset, step 1: ask for the email.
 *
 * The reset link lands on the web app (/reset-password) rather than a
 * melange:// deep link. A recovery email gets opened wherever the person reads
 * mail -- often a laptop, not the phone the app is on -- and a deep link is a
 * dead end there. The web page sets the new password against the same Supabase
 * project, so they come back here and sign in normally.
 */
const RESET_REDIRECT = "https://melange-psi.vercel.app/reset-password";

const RESEND_SECONDS = 30;

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setCooldown(RESEND_SECONDS);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const submit = async () => {
    const address = email.trim();
    if (!address) return setError("Enter the email you signed up with.");

    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: RESET_REDIRECT,
    });
    setLoading(false);

    // Deliberately don't surface "user not found" -- that would let anyone
    // check which emails have Melange accounts. Supabase already returns
    // success for unknown addresses; we only show real transport errors.
    if (err) return setError(err.message);

    setSent(true);
    startCooldown();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable hitSlop={16} onPress={() => router.back()} accessibilityLabel="Back">
              <ArrowLeft size={22} color={colors.white} />
            </Pressable>
          </View>

          <View style={styles.header}>
            <Logo size={64} stroke={colors.white} />
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>
              {sent
                ? "Check your inbox for the link."
                : "We'll email you a link to set a new one."}
            </Text>
          </View>

          <View style={styles.card}>
            {sent ? (
              <View style={styles.sentBox}>
                <View style={styles.sentIcon}>
                  <MailCheck size={26} color={colors.brandText} />
                </View>
                <Text style={styles.sentTitle}>Email sent</Text>
                <Text style={styles.sentBody}>
                  If an account exists for{" "}
                  <Text style={{ fontWeight: "700", color: colors.text }}>{email.trim()}</Text>, a
                  reset link is on its way. Open it, choose a new password, then come back and sign
                  in.
                </Text>
                <Text style={styles.sentHint}>
                  Nothing after a minute? Check spam, and make sure the address is the one you
                  signed up with.
                </Text>

                <Button
                  title={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
                  variant="outline"
                  size="md"
                  fullWidth
                  disabled={cooldown > 0}
                  onPress={submit}
                />
                <Button
                  title="Back to sign in"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={() => router.replace("/(auth)/login")}
                />
              </View>
            ) : (
              <>
                <Field label="Email">
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    autoFocus
                    onSubmitEditing={submit}
                    returnKeyType="send"
                  />
                </Field>

                <ErrorBanner message={error} />

                <Button
                  title="Send reset link"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={loading}
                  onPress={submit}
                />

                <Pressable onPress={() => router.back()} style={styles.footer}>
                  <Text style={styles.footerText}>Remembered it? </Text>
                  <Text style={styles.footerLink}>Sign in</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brand },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },
  topBar: { paddingTop: 8, paddingBottom: 16 },
  header: { alignItems: "center", marginVertical: 24, gap: 8 },
  title: { color: colors.white, fontSize: 24, fontWeight: "800", marginTop: 12 },
  subtitle: { color: "#bfdbfe", fontSize: 14, textAlign: "center", paddingHorizontal: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    marginTop: 16,
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 4 },
  footerText: { color: colors.textMuted, fontSize: 13 },
  footerLink: { color: colors.brandText, fontSize: 13, fontWeight: "700" },

  sentBox: { alignItems: "center", gap: 10 },
  sentIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sentTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  sentBody: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
  sentHint: {
    fontSize: 11,
    color: colors.textSubtle,
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 6,
  },
});
