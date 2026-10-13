import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

import { EventsFeed } from "@/components/EventsFeed";
import { colors, typography } from "@/lib/theme";

/** Events on their own, for the link in Settings. Explore shows the same feed. */
export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => setReloadKey((k) => k + 1)} tintColor={colors.brand} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.screenHeader}>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Events</Text>
        <View style={{ width: 22 }} />
      </View>
      <EventsFeed reloadKey={reloadKey} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  screenTitle: { ...typography.headline, color: colors.text },
  scroll: { padding: 16, paddingBottom: 120, gap: 12 },
});
