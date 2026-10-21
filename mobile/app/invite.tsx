import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { SceneChips } from "@/components/SceneChips";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { FOUNDING_MARK } from "@/components/IdentityLine";
import { useAuth } from "@/lib/auth";
import { useMembership } from "@/lib/membership";
import { getProfile } from "@/lib/db";
import { joinWaitlist, redeemInvite, setScene, type Scene } from "@/lib/scenes";
import { colors, fonts, GUTTER, spacing, typography } from "@/lib/theme";

type Step = "code" | "scene" | "waitlist" | "listed";

/** Remembers "you're on the list" across launches. Per device is enough. */
const LISTED_KEY = "melange.waitlisted";

/**
 * The invite gate, shown after sign-in to anyone who isn't a member yet.
 *
 * Being invited is the status, so the code is the primary action and the
 * waitlist the quiet second one. Existing members never see this: they were
 * grandfathered in by the migration.
 */
export default function InviteScreen() {
  const router = useRouter();
  const { session, userId, signOut } = useAuth();
  const { markMember } = useMembership();

  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [founding, setFounding] = useState(false);

  const [wlScene, setWlScene] = useState<Scene | "other" | null>(null);
  const [instagram, setInstagram] = useState("");
  const [makes, setMakes] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(LISTED_KEY)
      .then((v) => {
        if (v === "1") setStep((s) => (s === "code" ? "listed" : s));
      })
      .catch(() => {});
  }, []);

  const enterApp = () => {
    markMember();
    router.replace("/(tabs)/connect");
  };

  const onRedeem = async () => {
    if (busy || !userId) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await redeemInvite(code);
    if (err || !data) {
      setBusy(false);
      setError(err ?? "That code didn't go through.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AsyncStorage.removeItem(LISTED_KEY).catch(() => {});
    setFounding(data.founding);
    if (data.alreadyMember) {
      setBusy(false);
      enterApp();
      return;
    }
    // The code may carry a scene; a profile that already had one keeps it.
    // Only someone left with neither is asked.
    const { data: profile } = await getProfile(userId);
    setBusy(false);
    if (data.scene || profile?.scene) enterApp();
    else setStep("scene");
  };

  const onPickScene = async (scene: Scene) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await setScene(scene);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    enterApp();
  };

  const onJoinWaitlist = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await joinWaitlist({
      email: session?.user?.email ?? "",
      scene: wlScene,
      instagram,
      whatYouMake: makes,
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    AsyncStorage.setItem(LISTED_KEY, "1").catch(() => {});
    setStep("listed");
  };

  const goTo = (next: Step) => {
    setError(null);
    setStep(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === "code" ? (
            <>
              <Text style={styles.mark}>{FOUNDING_MARK}</Text>
              <Text style={styles.title}>Melange is invite-only</Text>
              <Text style={styles.body}>
                Where young creatives find their crew: the people, the nights, the ideas. A friend
                who&apos;s already in can send you a code.
              </Text>
              <Field label="Invite code">
                <Input
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  placeholder="MEL-XXXXX"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="go"
                  onSubmitEditing={onRedeem}
                  accessibilityLabel="Invite code"
                />
              </Field>
              <ErrorBanner message={error} />
              <Button
                title="Get in"
                variant="primary"
                size="lg"
                fullWidth
                loading={busy}
                disabled={!code.trim()}
                onPress={onRedeem}
              />
              <Pressable onPress={() => goTo("waitlist")} hitSlop={8} style={styles.secondary}>
                <Text style={styles.link}>No code? Join the waitlist</Text>
              </Pressable>
            </>
          ) : step === "scene" ? (
            <>
              <Text style={styles.mark}>{FOUNDING_MARK}</Text>
              <Text style={styles.title}>You&apos;re in{founding ? ", founding member" : ""}.</Text>
              <Text style={styles.body}>Where&apos;s your scene? Nights and people near you come first.</Text>
              <SceneChips<Scene | null>
                value={null}
                onChange={(s) => {
                  if (s) onPickScene(s);
                }}
                disabled={busy}
              />
              <ErrorBanner message={error} />
              <Pressable onPress={enterApp} hitSlop={8} style={styles.secondary} disabled={busy}>
                <Text style={styles.link}>None of these yet — skip</Text>
              </Pressable>
            </>
          ) : step === "waitlist" ? (
            <>
              <Text style={styles.title}>Join the waitlist</Text>
              <Text style={styles.body}>
                We open scene by scene. Tell us where you are and what you make, and we&apos;ll
                write to {session?.user?.email ?? "you"} when there&apos;s room.
              </Text>
              <Field label="Your scene">
                <SceneChips<Scene | "other" | null>
                  value={wlScene}
                  onChange={setWlScene}
                  otherLabel="Somewhere else"
                />
              </Field>
              <Field label="Instagram">
                <Input
                  value={instagram}
                  onChangeText={setInstagram}
                  placeholder="@you"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={100}
                />
              </Field>
              <Field label="What you make">
                <Input
                  value={makes}
                  onChangeText={setMakes}
                  placeholder="Film photos, zines, sets, nights…"
                  maxLength={300}
                />
              </Field>
              <ErrorBanner message={error} />
              <Button
                title="Join the waitlist"
                variant="primary"
                size="lg"
                fullWidth
                loading={busy}
                onPress={onJoinWaitlist}
              />
              <Pressable onPress={() => goTo("code")} hitSlop={8} style={styles.secondary}>
                <Text style={styles.link}>Have a code?</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.mark}>{FOUNDING_MARK}</Text>
              <Text style={styles.title}>You&apos;re on the list</Text>
              <Text style={styles.body}>
                We&apos;ll be in touch when your scene opens up. If a friend sends you a code before
                then, come back and use it.
              </Text>
              <Button title="Have a code?" variant="outline" size="lg" fullWidth onPress={() => goTo("code")} />
            </>
          )}
        </ScrollView>

        <Pressable onPress={() => signOut()} hitSlop={8} style={styles.signOut}>
          <Text style={styles.signOutText}>
            Signed in as {session?.user?.email ?? "you"} · <Text style={styles.signOutLink}>Sign out</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: GUTTER + spacing.sm,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  mark: { ...typography.display1, color: colors.accent },
  title: { ...typography.display1, color: colors.brand },
  body: { ...typography.body, color: colors.textSecondary },
  secondary: { alignSelf: "center", paddingVertical: spacing.sm },
  link: { ...typography.bodyStrong, color: colors.brandText },
  signOut: { alignItems: "center", paddingHorizontal: GUTTER, paddingBottom: spacing.md },
  signOutText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  signOutLink: { fontFamily: fonts.semibold, color: colors.brandText },
});
