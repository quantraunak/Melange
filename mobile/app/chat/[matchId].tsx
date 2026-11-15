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
import { ArrowLeft, MoreVertical, Users } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, radii, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import {
  blockUser,
  getMyPosts,
  getMessages,
  sendMessage,
  type Message,
} from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import * as Haptics from "expo-haptics";
import { addProjectMember } from "@/lib/projects";
import {
  getMessageHearts,
  getPeerReadAt,
  setMessageHeart,
  type MessageHeart,
} from "@/lib/messageHearts";

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

  // Hearts on messages, live for both people.
  const [hearts, setHearts] = useState<MessageHeart[]>([]);
  useEffect(() => {
    if (!matchId || !userId) return;
    let alive = true;
    const reload = () =>
      getMessageHearts(matchId).then((h) => {
        if (alive) setHearts(h);
      });
    reload();
    const channel = supabase
      .channel(`chat-hearts:${matchId}`)
      // A delete carries only the key, so re-read on any change.
      .on("postgres_changes", { event: "*", schema: "public", table: "message_hearts", filter: `match_id=eq.${matchId}` }, reload)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [matchId, userId]);

  const toggleHeart = useCallback(
    async (msg: Message) => {
      if (!matchId || !userId) return;
      const mine = hearts.some((h) => h.message_id === msg.id && h.user_id === userId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setHearts((prev) =>
        mine
          ? prev.filter((h) => !(h.message_id === msg.id && h.user_id === userId))
          : [...prev, { message_id: msg.id, user_id: userId }]
      );
      const err = await setMessageHeart(matchId, msg.id, userId, !mine);
      if (err) {
        setError(err);
        getMessageHearts(matchId).then(setHearts);
      }
    },
    [matchId, userId, hearts]
  );

  // "Seen": when the other person last opened this chat. Their read row is
  // private to them, so ask the server now and then while the chat is open.
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);
  useEffect(() => {
    if (!matchId || !userId) return;
    let alive = true;
    const check = () =>
      getPeerReadAt(userId, matchId).then((t) => {
        if (alive) setPeerReadAt(t);
      });
    check();
    const timer = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [matchId, userId]);
  const lastMine = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].sender_id === userId) return messages[i];
    return null;
  }, [messages, userId]);
  const seenId =
    lastMine && peerReadAt && Date.parse(peerReadAt) >= Date.parse(lastMine.created_at) ? lastMine.id : null;

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

  // "Add to my project": after talking, the owner puts this person on one of
  // their projects. Nothing is sent to them; it's the owner's list. When the
  // project is marked finished, both are asked to review each other.
  const [myProjects, setMyProjects] = useState<{ id: string; title: string }[]>([]);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getMyPosts(userId).then(({ data }) => {
      if (!alive) return;
      setMyProjects(
        (data || []).filter((p) => !p.finished_at).map((p) => ({ id: p.id, title: p.title }))
      );
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const addTo = useCallback(
    async (project: { id: string; title: string }) => {
      if (!matchId) return;
      const err = await addProjectMember(project.id, matchId);
      if (err) {
        setError(err);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAddedTo(project.title);
    },
    [matchId]
  );

  const pickProject = useCallback(() => {
    if (!match || !myProjects.length) return;
    const first = match.other_creator.name.split(" ")[0];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Add ${first} to which project?`,
          message: "They won't get a message. When you mark the project finished, you'll both be asked for a review.",
          options: ["Cancel", ...myProjects.map((p) => p.title)],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx > 0) addTo(myProjects[idx - 1]);
        }
      );
    } else {
      Alert.alert(
        `Add ${first} to which project?`,
        "They won't get a message. When you mark the project finished, you'll both be asked for a review.",
        [...myProjects.slice(0, 2).map((p) => ({ text: p.title, onPress: () => addTo(p) })), { text: "Cancel", style: "cancel" as const }]
      );
    }
  }, [match, myProjects, addTo]);

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
          ...(myProjects.length ? [{ text: "Add to my project", onPress: () => pickProject() }] : []),
          { text: "Cancel", style: "cancel" as const },
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
          options: ["Cancel", "Report user", "Block user", ...(myProjects.length ? ["Add to my project"] : [])],
          destructiveButtonIndex: [1, 2],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 3) {
            pickProject();
          } else if (idx === 1) {
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
  }, [match, userId, router, refreshMatches, myProjects.length, pickProject]);

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

        {myProjects.length ? (
          <Pressable
            onPress={addedTo ? undefined : pickProject}
            disabled={!!addedTo}
            style={({ pressed }) => [styles.projectBar, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Users size={15} color={colors.brandText} />
            <Text style={styles.projectBarText}>
              {addedTo
                ? `${match.other_creator.name.split(" ")[0]} is on "${addedTo}". Mark it finished when you're done.`
                : `Working together? Add ${match.other_creator.name.split(" ")[0]} to your project`}
            </Text>
          </Pressable>
        ) : null}

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
                <Text style={styles.emptyChatTitle}>You matched. Nobody&apos;s written yet.</Text>
                <Text style={styles.emptyChatText}>
                  Go first: say when you&apos;re free this week and what you&apos;d bring.
                </Text>
                <Text style={styles.emptyChatText}>Double-tap a message to heart it.</Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <ChatBubble
                item={item}
                prev={messages[index - 1]}
                isMe={item.sender_id === userId}
                hearts={hearts.filter((h) => h.message_id === item.id).length}
                onDoubleTap={() => toggleHeart(item)}
                onLongPress={() => toggleHeart(item)}
                footer={item.id === seenId ? "Seen" : null}
              />
            )}
            extraData={[hearts, seenId]}
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
    borderRadius: radii.md,
    backgroundColor: colors.brand,
  },
  notFoundBtnText: { ...typography.bodyStrong, color: colors.onBrand },
  projectBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  projectBarText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText, flex: 1 },
  messageList: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1 },
  emptyChat: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyChatTitle: { ...typography.display2 },
  emptyChatText: { ...typography.body, color: colors.textSecondary },
});
