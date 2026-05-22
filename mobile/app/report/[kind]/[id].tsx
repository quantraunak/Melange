import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, X } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { submitReport, type ReportReason } from "@/lib/db";

const REASONS: { id: ReportReason; label: string; help: string }[] = [
  { id: "spam", label: "Spam or scam", help: "Repetitive, off-topic, or trying to sell something unrelated." },
  { id: "harassment", label: "Harassment or hate speech", help: "Threats, insults, slurs, or targeted abuse." },
  { id: "inappropriate", label: "Inappropriate content", help: "Sexually explicit, violent, or otherwise unsafe content." },
  { id: "fake", label: "Fake profile or impersonation", help: "Pretending to be someone they're not." },
  { id: "underage", label: "Minor / underage user", help: "Looks like the account belongs to someone under 18." },
  { id: "other", label: "Something else", help: "Tell us what's wrong below." },
];

export default function ReportScreen() {
  const router = useRouter();
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const { userId } = useAuth();
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validKind: "user" | "post" | "message" =
    kind === "user" || kind === "post" || kind === "message" ? kind : "user";

  const submit = async () => {
    if (!userId || !id) return;
    if (!selected) return setError("Please pick a reason.");
    setLoading(true);
    setError(null);
    const { error: err } = await submitReport(userId, validKind, id, selected, details.trim() || undefined);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    Alert.alert(
      "Report received",
      "Thanks for letting us know. Our team will review this and take action if it violates our rules.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={{ width: 22 }} />
        <Text style={styles.headerTitle}>
          Report {validKind === "user" ? "user" : validKind}
        </Text>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Help us keep Melange safe. Reports are confidential and reviewed by our team.
          </Text>

          <Field label="Reason">
            <View style={styles.reasons}>
              {REASONS.map((r) => {
                const active = selected === r.id;
                return (
                  <Pressable
                    key={r.id}
                    style={[styles.reasonRow, active && styles.reasonRowActive]}
                    onPress={() => setSelected(r.id)}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <Check size={12} color={colors.white} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reasonLabel, active && { color: colors.brandText }]}>
                        {r.label}
                      </Text>
                      <Text style={styles.reasonHelp}>{r.help}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="More detail (optional)">
            <TextArea
              value={details}
              onChangeText={setDetails}
              placeholder="Add anything you'd like us to know."
              numberOfLines={4}
            />
          </Field>

          <ErrorBanner message={error} />

          <Button title="Send report" variant="primary" loading={loading} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.text },
  scroll: { padding: 16, gap: 14 },
  intro: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  reasons: { gap: 8 },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  reasonRowActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandText,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderColor: colors.borderStrong,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  reasonLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  reasonHelp: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
