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
 * The step after signup: profile photos. Liking, messaging and posting need
 * PROFILE_MIN_IMAGES, so this asks for them now, while someone is already
 * setting up. "Skip for now" is there because without it the only way past
 * a denied photo permission or a failed upload was to kill the app, and most
 * people who sign up have no photos ready. Skipping changes nothing about
 * the floor: it still asks before a like, a message or a post.
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Add your profile photos ✨</Text>
        <Text style={styles.body}>
          You, or work you&apos;ve made. They&apos;re the first thing people see.
        </Text>
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
        {photos.length < 1 ? (
          <Pressable onPress={done} hitSlop={12} accessibilityRole="button" style={styles.skip}>
            <Text style={styles.skipText}>Skip for now</Text>
            <Text style={styles.skipHint}>
              You can look around. You&apos;ll need a photo to like or message, and {PROFILE_MIN_IMAGES} to post.
            </Text>
          </Pressable>
        ) : null}
        <Button
          title="Done"
          variant="primary"
          size="lg"
          fullWidth
          disabled={photos.length < 1}
          onPress={done}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: GUTTER, paddingTop: spacing.xl, gap: spacing.lg },
  title: { ...typography.display1, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
  footer: { paddingHorizontal: GUTTER, paddingBottom: spacing.md, gap: spacing.md },
  skip: { alignItems: "center", gap: 2 },
  skipText: { ...typography.body, fontFamily: fonts.semibold, color: colors.brandText },
  skipHint: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
});
