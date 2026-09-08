import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  LogOut,
  ShieldOff,
  Trash2,
  User,
} from "lucide-react-native";

import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

/**
 * Settings.
 *
 * The gear in the header used to call router.push("/(tabs)/profile"), which
 * navigates to the Profile tab -- so pressing it while already on Profile, the
 * screen most people are on when they reach for settings, did nothing at all.
 * Account controls also lived only at the bottom of the profile form, below the
 * posts list, where nothing suggested they were there.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const onSignOut = () =>
    Alert.alert("Sign out?", "You can sign back in any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);

  const rows: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    danger?: boolean;
  }[] = [
    {
      icon: <User size={18} color={colors.textMuted} />,
      label: "Edit profile",
      onPress: () => router.push("/(tabs)/profile"),
    },
    {
      icon: <ShieldOff size={18} color={colors.textMuted} />,
      label: "Blocked users",
      onPress: () => router.push("/account/blocked"),
    },
    {
      icon: <FileText size={18} color={colors.textMuted} />,
      label: "Privacy & terms",
      onPress: () => Linking.openURL("https://melange-psi.vercel.app/privacy"),
    },
    {
      icon: <LogOut size={18} color={colors.textMuted} />,
      label: "Sign out",
      onPress: onSignOut,
    },
    {
      icon: <Trash2 size={18} color={colors.dangerText} />,
      label: "Delete account",
      onPress: () => router.push("/account/delete"),
      danger: true,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {rows.map((row) => (
          <Pressable
            key={row.label}
            style={[styles.row, row.danger && { borderColor: "#fecaca" }]}
            onPress={row.onPress}
            accessibilityRole="button"
          >
            {row.icon}
            <Text style={[styles.rowText, row.danger && { color: colors.dangerText }]}>
              {row.label}
            </Text>
            <ChevronRight size={16} color={colors.textSubtle} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  body: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  rowText: { flex: 1, color: colors.text, fontSize: 15 },
});
