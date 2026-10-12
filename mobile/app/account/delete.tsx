import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, AlertTriangle } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii, typography } from "@/lib/theme";
import { deleteAccount } from "@/lib/db";

const CONFIRM = "DELETE";

export default function DeleteAccount() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (text.trim() !== CONFIRM) {
      setError(`Type ${CONFIRM} to confirm.`);
      return;
    }
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile, projects, matches, and messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            setError(null);
            const { error: err } = await deleteAccount();
            setLoading(false);
            if (err) setError(err);
            // signOut inside deleteAccount triggers the auth state listener.
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Delete account</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.warnBlock}>
          <AlertTriangle size={32} color={colors.dangerText} />
          <Text style={styles.warnTitle}>This cannot be undone.</Text>
          <Text style={styles.warnBody}>
            Deleting your account removes your profile, posts, swipes, matches, messages,
            and uploaded media permanently. You will be signed out immediately.
          </Text>
        </View>

        <View style={styles.card}>
          <Field label={`Type ${CONFIRM} to confirm`}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder={CONFIRM}
              autoCapitalize="characters"
            />
          </Field>

          <ErrorBanner message={error} />

          <Button
            title="Delete my account"
            variant="danger"
            loading={loading}
            onPress={onDelete}
          />
          <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>
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
    backgroundColor: colors.surface,
    borderBottomColor: colors.lineStrong,
    borderBottomWidth: 1,
  },
  headerTitle: { ...typography.headline, flex: 1, textAlign: "center", color: colors.text },
  scroll: { padding: 16, gap: 16 },
  warnBlock: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: 20,
    alignItems: "center",
    gap: 8,
    borderColor: colors.dangerLine,
    borderWidth: 1,
  },
  warnTitle: { ...typography.headline, color: colors.dangerText, marginTop: 4 },
  warnBody: { ...typography.caption, color: colors.dangerText, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
    gap: 12,
    borderColor: colors.lineStrong,
    borderWidth: 1,
  },
});
