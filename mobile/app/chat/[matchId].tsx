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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MoreVertical } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import {
  blockUser,
  getMessages,
  sendMessage,
  type Message,
} from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

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
              <Text style={styles.notFoundBody}>It may have been removed.</Text>
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
        {/* The header is the way to the person, as it is in Messages. */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/profile/[userId]",
              params: { userId: match.other_user_id },
            })
          }
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${match.other_creator.name}'s profile`}
          style={({ pressed }) => [styles.headerMiddle, pressed && { opacity: 0.6 }]}
        >
          <Avatar creator={match.other_creator} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>
              {match.other_creator.name}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {match.context}
            </Text>
          </View>
        </Pressable>
        <Pressable hitSlop={12} onPress={openMenu} accessibilityLabel="Conversation options">
          <MoreVertical size={20} color={colors.text} />
        </Pressable>
      </View>

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
                <Text style={styles.emptyChatText}>Say hi.</Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <ChatBubble item={item} prev={messages[index - 1]} isMe={item.sender_id === userId} />
            )}
          />
        )}

        <ChatComposer value={text} onChangeText={setText} onSend={send} sending={sending} />
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
});
