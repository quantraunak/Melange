import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { PortfolioPhotos } from "@/components/PortfolioPhotos";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAuth } from "@/lib/auth";
import { getProfile, PROFILE_MIN_IMAGES } from "@/lib/db";
import { clearFreshSignup } from "@/lib/onboarding";
import { colors, fonts, GUTTER, spacing, typography } from "@/lib/theme";

/**
 * The one optional step after signup: three photos. Liking a project or
 * posting one needs PROFILE_MIN_IMAGES, so asking now, while someone is
 * already in "set up my profile" mode, saves a wall later. Skip is always
 * there and always works.
 */
export default function OnboardingPhotosScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearFreshSignup();
  }, []);

  // A brand-new profile has none, but a retried signup might not be new.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    (async () => {
      const { data, error: err } = await getProfile(userId);
      if (!live) return;
      // Starting from an empty grid is a safe fallback here: adding writes
      // the list it shows plus the new photos, so the worst case is the
      // retried signup's old photos dropping out, never a crash or a block.
      if (err) console.warn("onboarding: getProfile failed", err);
      else if (data?.portfolio_urls?.length) setPhotos(data.portfolio_urls);
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  const done = () => router.replace("/(tabs)/connect");
  if (!userId) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <Pressable onPress={done} hitSlop={12} accessibilityRole="button">
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Add 3 photos you&apos;ve made or love</Text>
        <Text style={styles.body}>They&apos;re the first thing people see on your profile.</Text>
        <PortfolioPhotos
          userId={userId}
          photos={photos}
          onChange={setPhotos}
          onError={setError}
          emptySlots={PROFILE_MIN_IMAGES}
        />
        <ErrorBanner message={error} />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title="Done"
          variant="primary"
          size="lg"
          fullWidth
          disabled={photos.length === 0}
          onPress={done}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: GUTTER, paddingVertical: spacing.md },
  skip: { ...typography.body, fontFamily: fonts.semibold, color: colors.brandText },
  scroll: { paddingHorizontal: GUTTER, paddingTop: spacing.xl, gap: spacing.lg },
  title: { ...typography.display1, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
  footer: { paddingHorizontal: GUTTER, paddingBottom: spacing.md },
});
