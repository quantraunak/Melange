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
import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import {
  blockUser,
  getMessages,
  sendMessage,
  type Message,
} from "@/lib/db";
import { getMyReviewForMatch, isReviewEligible } from "@/lib/reviews";
import { supabase } from "@/lib/supabase";
import { formatClockTime } from "@/lib/format";

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const { matches, markRead, refresh: refreshMatches } = useMatches();

  const match = useMemo(() => matches.find((m) => m.id === matchId), [matches, matchId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReview, setHasReview] = useState(false);

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
        "You will no longer see their posts and they will no longer see yours. This cannot be undone here.",
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
          <ActivityIndicator color={colors.brand} />
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
                <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isMe = item.sender_id === userId;
              const prev = messages[index - 1];
              const sameAuthor = prev && prev.sender_id === item.sender_id;
              return (
                <View
                  style={[
                    styles.bubbleRow,
                    isMe ? styles.bubbleRowMe : styles.bubbleRowOther,
                    sameAuthor ? { marginTop: 2 } : { marginTop: 8 },
                  ]}
                >
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    <Text style={[styles.bubbleText, isMe && { color: colors.white }]}>
                      {item.content}
                    </Text>
                    <Text style={[styles.bubbleTime, isMe ? { color: "#ddd6fe" } : null]}>
                      {formatClockTime(item.created_at)}
                    </Text>
                  </View>
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
              placeholderTextColor={colors.textSubtle}
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
  safe: { flex: 1, backgroundColor: colors.card },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  headerMiddle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  headerName: { fontSize: 15, fontWeight: "700", color: colors.text },
  headerSubtitle: { fontSize: 11, color: colors.textSubtle },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  messageList: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyChatText: { color: colors.textSubtle, fontSize: 14 },
  bubbleRow: { flexDirection: "row" },
  bubbleRowMe: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  bubbleMe: { backgroundColor: colors.bubbleMe, borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: colors.bubbleOther, borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 15, color: colors.text, lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: colors.textSubtle, marginTop: 2, alignSelf: "flex-end" },
  inputSafe: { backgroundColor: colors.card, borderTopColor: colors.border, borderTopWidth: 1 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    backgroundColor: "#ede9fe",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#c4b5fd",
  },
  reviewBannerText: { flex: 1, fontSize: 12, color: "#5b21b6", marginRight: 8 },
  reviewBannerCta: { fontSize: 12, fontWeight: "700", color: colors.accent },
});
