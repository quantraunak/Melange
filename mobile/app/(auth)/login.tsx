import { useState } from "react";
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
import { Link, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Logo } from "@/components/Logo";
import { colors } from "@/lib/theme";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable hitSlop={16} onPress={() => router.back()}>
              <ArrowLeft size={22} color={colors.white} />
            </Pressable>
          </View>

          <View style={styles.header}>
            <Logo size={64} stroke={colors.white} />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to keep collaborating.</Text>
          </View>

          <View style={styles.card}>
            <Field label="Email">
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            </Field>
            <Field label="Password">
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="password"
                textContentType="password"
              />
            </Field>

            <ErrorBanner message={error} />

            <Button title="Sign in" variant="primary" size="lg" loading={loading} onPress={onSubmit} />

            <View style={styles.footer}>
              <Text style={styles.footerText}>New here? </Text>
              <Link href="/(auth)/signup" style={styles.footerLink}>
                Create an account
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
  topBar: { paddingTop: 8, paddingBottom: 16 },
  header: { alignItems: "center", marginVertical: 24, gap: 8 },
  title: { color: colors.white, fontSize: 24, fontWeight: "800", marginTop: 12 },
  subtitle: { color: "#bfdbfe", fontSize: 14 },
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
});
