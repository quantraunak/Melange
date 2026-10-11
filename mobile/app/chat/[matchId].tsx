import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MoreVertical, Send } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, radii, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import {
  blockUser,
  getMessages,
  sendMessage,
  type Message,
} from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { getMyReviewForMatch, isReviewEligible } from "@/lib/reviews";
import { supabase } from "@/lib/supabase";
import { formatClockTime } from "@/lib/format";

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const {
    matches,
    loading: matchesLoading,
    markRead,
    refresh: refreshMatches,
  } = useMatches();

  const match = useMemo(() => matches.find((m) => m.id === matchId), [matches, matchId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReview, setHasReview] = useState(false);
  const [retriedNotFound, setRetriedNotFound] = useState(false);

  // If matches have finished loading and this matchId still isn't in the
  // list, try one refresh (e.g. a match created just before navigating here
  // may not have been in the initial fetch) before treating it as missing.
  useEffect(() => {
    if (match || matchesLoading || retriedNotFound) return;
    setRetriedNotFound(true);
    refreshMatches();
  }, [match, matchesLoading, retriedNotFound, refreshMatches]);

  const listRef = useRef<FlatList<Message>>(null);

  // Load messages + mark read on open.
  useEffect(() => {
    if (!matchId || !userId) return;
    (async () => {
      setLoading(true);
      const { data, error: err } = await getMessages(matchId);
      if (err) setError(err);
      setMessages(data || []);
      setLoading(false);
      await markRead(matchId);
      const { data: review } = await getMyReviewForMatch(matchId, userId);
      setHasReview(!!review);
    })();
  }, [matchId, userId, markRead]);

  // Realtime: new messages on this match.
  useEffect(() => {
    if (!matchId || !userId) return;
    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_id !== userId) {
            await markRead(matchId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, userId, markRead]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const send = useCallback(async () => {
    if (!matchId || !userId || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    const body = text.trim();
    setText("");
    const { data, error: err } = await sendMessage(matchId, userId, body);
    if (err) {
      setError(err);
      setText(body); // restore on failure
    } else if (data) {
      trackEvent("message_sent", { match_id: matchId });
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    }
    setSending(false);
  }, [matchId, userId, text, sending]);

  const openMenu = useCallback(() => {
    if (!match || !userId) return;
    const otherId = match.other_user_id;

    const showAndroid = () => {
      Alert.alert(
        match.other_creator.name,
        undefined,
        [
          {
            text: "Report user",
            style: "destructive",
            onPress: () =>
              router.push({
                pathname: "/report/[kind]/[id]",
                params: { kind: "user", id: otherId },
              }),
          },
          {
            text: "Block user",
            style: "destructive",
            onPress: () => confirmBlock(),
          },
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true }
      );
    };

    const confirmBlock = () => {
      Alert.alert(
        `Block ${match.other_creator.name}?`,
        "You will no longer see their projects and they will no longer see yours. This cannot be undone here.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              const { error: err } = await blockUser(userId, otherId);
              if (err) {
                Alert.alert("Couldn't block", err);
                return;
              }
              await refreshMatches();
              router.back();
            },
          },
        ]
      );
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: match.other_creator.name,
          options: ["Cancel", "Report user", "Block user"],
          destructiveButtonIndex: [1, 2],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) {
            router.push({
              pathname: "/report/[kind]/[id]",
              params: { kind: "user", id: otherId },
            });
          } else if (idx === 2) {
            confirmBlock();
          }
        }
      );
    } else {
      showAndroid();
    }
  }, [match, userId, router, refreshMatches]);

  if (!match) {
    // Still fetching matches, or we just kicked off the one-shot retry
    // above — this is a transient state, keep spinning.
    const stillResolving = matchesLoading || !retriedNotFound;
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Conversation</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loading}>
          {stillResolving ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <View style={styles.notFound}>
              <Text style={styles.notFoundTitle}>Conversation not found</Text>
              <Text style={styles.notFoundBody}>
                This match may have been removed, or you may no longer have access to it.
              </Text>
              <Pressable
                style={styles.notFoundBtn}
                onPress={() => router.replace("/(tabs)/messages")}
              >
                <Text style={styles.notFoundBtnText}>Back to messages</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerMiddle}>
          <Avatar creator={match.other_creator} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>
              {match.other_creator.name}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {match.other_post.title}
            </Text>
          </View>
        </View>
        <Pressable hitSlop={12} onPress={openMenu} accessibilityLabel="Conversation options">
          <MoreVertical size={20} color={colors.text} />
        </Pressable>
      </View>

      {isReviewEligible(match.created_at) && !hasReview ? (
        <Pressable
          style={styles.reviewBanner}
          onPress={() =>
            router.push({ pathname: "/review/[matchId]", params: { matchId: match.id } })
          }
        >
          <Text style={styles.reviewBannerText}>
            Collaborated? Leave a review for {match.other_creator.name}
          </Text>
          <Text style={styles.reviewBannerCta}>Review</Text>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {error ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><ErrorBanner message={error} /></View> : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatTitle}>You matched</Text>
                <Text style={styles.emptyChatText}>
                  You both said yes to {match.other_post.title}. Whoever writes first
                  usually names a date.
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isMe = item.sender_id === userId;
              const prev = messages[index - 1];
              const next = messages[index + 1];
              const sameAuthorBefore = prev && prev.sender_id === item.sender_id;
              // A run of messages from one person is one block: only its last
              // bubble is timestamped, and only its outer corners are round.
              // Stamping every bubble turns a conversation into a log.
              const endsRun = !next || next.sender_id !== item.sender_id;
              return (
                <View
                  style={[
                    styles.bubbleRow,
                    isMe ? styles.bubbleRowMe : styles.bubbleRowOther,
                    sameAuthorBefore ? { marginTop: 2 } : { marginTop: 10 },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isMe ? styles.bubbleMe : styles.bubbleOther,
                      endsRun && (isMe ? styles.bubbleMeTail : styles.bubbleOtherTail),
                    ]}
                  >
                    <Text style={[styles.bubbleText, isMe && { color: colors.onAccent }]}>
                      {item.content}
                    </Text>
                  </View>
                  {endsRun ? (
                    <Text style={styles.bubbleTime}>{formatClockTime(item.created_at)}</Text>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        <SafeAreaView edges={["bottom"]} style={styles.inputSafe}>
          <View style={styles.inputBar}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              multiline
              maxLength={2000}
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
              accessibilityLabel="Send message"
            >
              <Send size={18} color={colors.white} />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerMiddle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { ...typography.headline, flex: 1, color: colors.text },
  headerName: { ...typography.bodyStrong, color: colors.text },
  headerSubtitle: { ...typography.micro, color: colors.textSecondary },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFound: { alignItems: "center", paddingHorizontal: 32, gap: 8 },
  notFoundTitle: { ...typography.headline, color: colors.text },
  notFoundBody: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  notFoundBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  notFoundBtnText: { ...typography.bodyStrong, color: colors.white },
  messageList: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1 },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 6,
  },
  emptyChatTitle: { ...typography.headline, color: colors.text },
  emptyChatText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },

  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowMe: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "76%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.lg,
  },
  /* No tail notch: the spec allows four radii and a fifth value for one
     corner of one component is how scales rot. A run reads as a run from
     spacing — 2pt inside a block, 10pt between blocks. */
  bubbleMe: { backgroundColor: colors.bubbleMe },
  bubbleOther: { backgroundColor: colors.bubbleOther },
  bubbleMeTail: {},
  bubbleOtherTail: {},
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTime: { ...typography.micro, color: colors.textTertiary, marginBottom: 2 },
  inputSafe: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    ...typography.body,
    flex: 1,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  reviewBannerText: { ...typography.caption, flex: 1, color: colors.textSecondary, marginRight: 8 },
  reviewBannerCta: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
});
