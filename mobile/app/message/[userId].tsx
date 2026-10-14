import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Send, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, GUTTER, radii, spacing, typography, inputText } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { trackEvent } from "@/lib/analytics";
import {
  getProfile,
  profileGate,
  startConversation,
  type ConversationOrigin,
  type Profile,
} from "@/lib/db";

type Origin = Exclude<ConversationOrigin, "swipe">;
const ORIGINS: Origin[] = ["project", "profile", "event", "story"];

/** A starting line, so nobody faces an empty box. They can change all of it. */
function suggestion(origin: Origin, about: string | undefined, firstName: string): string {
  const hi = `Hi ${firstName}!`;
  switch (origin) {
    case "project":
      return about ? `${hi} I saw "${about}" and I'd love to be part of it.` : `${hi} I like your project.`;
    case "event":
      return about ? `${hi} I saw "${about}". Are you running another one?` : `${hi} I saw your event.`;
    case "story":
      return about ? `${hi} I loved "${about}". Want to make something together?` : `${hi} I loved your work.`;
    default:
      return `${hi} I like your work and I'd love to collaborate.`;
  }
}

/**
 * Reach out: send someone a first message without needing a mutual match.
 *
 * Opened from a project, a profile, an event or a piece of work, with what it
 * is about in the params so the first line can say so. If the two of you
 * already have a conversation it goes straight there instead. Asking for
 * someone's attention needs the same floor as posting or liking.
 */
export default function ReachOutScreen() {
  const params = useLocalSearchParams<{
    userId: string;
    origin?: string;
    originId?: string;
    about?: string;
  }>();
  const router = useRouter();
  const { userId: me } = useAuth();
  const { matches, refresh } = useMatches();

  const origin: Origin = ORIGINS.includes(params.origin as Origin) ? (params.origin as Origin) : "profile";
  const existing = useMemo(
    () => matches.find((m) => m.other_user_id === params.userId),
    [matches, params.userId]
  );

  const [them, setThem] = useState<Profile | null>(null);
  const [mine, setMine] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      router.replace({ pathname: "/chat/[matchId]", params: { matchId: existing.id } });
    }
  }, [existing, router]);

  useEffect(() => {
    if (!params.userId) return;
    getProfile(params.userId).then(({ data, error: err }) => {
      if (err || !data) {
        setError(err || "This person's profile isn't available.");
        return;
      }
      setThem(data);
      setText((t) => t || suggestion(origin, params.about, data.name.split(" ")[0]));
    });
  }, [params.userId, params.about, origin]);

  // Whether loading your own profile has settled, successfully or not.
  //
  // The error was discarded here and `mine` stayed null, which made
  // profileGate(null) fail. The footer renders on gate.ok and the explanation
  // renders on `!gate.ok && mine`, so a failed load produced a composer with
  // the opener filled in, free typing, no Send button anywhere, and no reason
  // given. Tracking the failure separately means you always get one or the
  // other.
  const [mineError, setMineError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    setMineError(null);
    getProfile(me)
      .then(({ data, error }) => {
        if (!alive) return;
        setMine(data);
        if (!data) setMineError(error || "Couldn't load your profile.");
      })
      .catch((e) => {
        if (alive) setMineError(e instanceof Error ? e.message : "Couldn't load your profile.");
      });
    return () => {
      alive = false;
    };
  }, [me, retry]);

  const gate = profileGate(mine, "message");
  const isMe = !!me && params.userId === me;

  const send = async () => {
    if (!me || !params.userId || !text.trim() || sending || !gate.ok) return;
    setSending(true);
    setError(null);
    const { matchId, error: err } = await startConversation(
      params.userId,
      text.trim(),
      origin,
      params.originId || null
    );
    if (err || !matchId) {
      setError(err || "That didn't send. Try again.");
      setSending(false);
      return;
    }
    trackEvent("conversation_started", { origin, match_id: matchId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await refresh();
    router.replace({ pathname: "/chat/[matchId]", params: { matchId } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View style={{ width: 22 }} />
          <Text style={styles.headerTitle}>New message</Text>
          <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Close">
            <X size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {existing || (!them && !error) ? (
            <ActivityIndicator color={colors.textSecondary} />
          ) : !them ? (
            <ErrorBanner message={error} />
          ) : (
            <>
              <View style={styles.to}>
                <Avatar creator={them} size="lg" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toName}>{them.name}</Text>
                  {them.role ? <Text style={styles.toRole}>{them.role}</Text> : null}
                </View>
              </View>
              {params.about ? (
                <View style={styles.about}>
                  <Text style={styles.aboutLabel}>About</Text>
                  <Text style={styles.aboutText} numberOfLines={2}>
                    {params.about}
                  </Text>
                </View>
              ) : null}

              {isMe ? (
                <Text style={styles.hint}>This is you.</Text>
              ) : mineError ? (
                <View style={styles.gate}>
                  <Text style={styles.gateText}>{mineError}</Text>
                  <Pressable onPress={() => setRetry((n) => n + 1)} hitSlop={8}>
                    <Text style={styles.gateLink}>Try again</Text>
                  </Pressable>
                </View>
              ) : !gate.ok && mine ? (
                <View style={styles.gate}>
                  <Text style={styles.gateText}>{gate.line}</Text>
                  <Pressable onPress={() => router.replace("/account/edit-profile")} hitSlop={8}>
                    <Text style={styles.gateLink}>Edit profile</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="Who you are and what you'd like to make together"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.input}
                    multiline
                    maxLength={2000}
                    autoFocus
                  />
                  <Text style={styles.hint}>
                    No match needed. This opens a conversation in both of your Messages.
                  </Text>
                  <ErrorBanner message={error} />
                </>
              )}
            </>
          )}
        </ScrollView>

        {them && !isMe && !existing && gate.ok ? (
          <View style={styles.footer}>
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
              accessibilityRole="button"
            >
              {sending ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <>
                  <Send size={18} color={colors.onAccent} />
                  <Text style={styles.sendText}>Send</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headerTitle: { ...typography.headline, color: colors.text },
  body: { padding: GUTTER, gap: spacing.lg },
  to: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  toName: { ...typography.title, color: colors.text },
  toRole: { ...typography.caption, color: colors.textSecondary },
  about: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: spacing.md,
    gap: 2,
  },
  aboutLabel: { ...typography.eyebrow, color: colors.textSecondary },
  aboutText: { ...typography.bodyStrong, color: colors.text },
  input: {
    ...inputText,
    minHeight: 140,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: spacing.md,
    color: colors.text,
    textAlignVertical: "top",
  },
  hint: { ...typography.caption, color: colors.textSecondary },
  gate: { gap: spacing.sm },
  gateText: { ...typography.body, color: colors.text },
  gateLink: { ...typography.bodyStrong, color: colors.brandText },
  footer: {
    padding: GUTTER,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  sendText: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.onAccent },
});
