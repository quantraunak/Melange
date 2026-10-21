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
import { ArrowLeft } from "lucide-react-native";

import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAuth } from "@/lib/auth";
import { getEvent, type EventWithDetails } from "@/lib/events";
import {
  deleteNightMessage,
  getNightMessages,
  getNightPeople,
  isNightMember,
  sendNightMessage,
  type NightMessage,
  type NightPerson,
} from "@/lib/nights";
import { supabase } from "@/lib/supabase";
import { colors, GUTTER, spacing, typography } from "@/lib/theme";

/**
 * The night chat: one group conversation for the host and everyone going,
 * before the night and after it. Long-press a message to report it, or to
 * delete one of your own.
 */
export default function NightChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();

  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [people, setPeople] = useState<NightPerson[]>([]);
  const [messages, setMessages] = useState<NightMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<NightMessage>>(null);

  const member = !!event && isNightMember(event, userId);

  const loadPeople = useCallback(async () => {
    if (!id) return;
    const res = await getNightPeople(id);
    if (!res.error) setPeople(res.data);
  }, [id]);

  useEffect(() => {
    if (!id || !userId) return;
    (async () => {
      setLoading(true);
      const ev = await getEvent(id, userId);
      setEvent(ev.data);
      if (ev.error) {
        setError(ev.error);
        setLoading(false);
        return;
      }
      if (ev.data && isNightMember(ev.data, userId)) {
        const [msgs] = await Promise.all([getNightMessages(id), loadPeople()]);
        setMessages(msgs.data);
        if (msgs.error) setError(msgs.error);
      }
      setLoading(false);
    })();
  }, [id, userId, loadPeople]);

  const names = useMemo(() => new Map(people.map((p) => [p.user_id, p.name])), [people]);

  // Someone who RSVPs after we loaded writes before we know their name: ask
  // again, once per unknown sender, rather than labelling them "Someone".
  const askedFor = useRef(new Set<string>());
  useEffect(() => {
    const unknown = messages.find((m) => m.sender_id !== userId && !names.has(m.sender_id));
    if (!unknown || askedFor.current.has(unknown.sender_id)) return;
    askedFor.current.add(unknown.sender_id);
    loadPeople();
  }, [messages, names, userId, loadPeople]);

  useEffect(() => {
    if (!id || !userId || !member) return;
    const channel = supabase
      .channel(`night:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${id}` },
        (payload) => {
          const msg = payload.new as NightMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      )
      .on(
        "postgres_changes",
        // No event_id filter on deletes: with RLS on, Realtime sends a
        // DELETE with only the primary key, so a filter on event_id never
        // matches and a deleted message would stay on everyone else's
        // screen. Removing by id is harmless for ids that aren't in this chat.
        { event: "DELETE", schema: "public", table: "event_messages" },
        (payload) => {
          const gone = (payload.old as { id?: string }).id;
          if (gone) setMessages((prev) => prev.filter((m) => m.id !== gone));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, userId, member]);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const send = useCallback(async () => {
    if (!id || !userId || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    const body = text.trim();
    setText("");
    const { data, error: err } = await sendNightMessage(id, userId, body);
    if (err || !data) {
      setError(err ?? "That didn't send.");
      setText(body);
    } else {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    }
    setSending(false);
  }, [id, userId, text, sending]);

  const onLongPress = (m: NightMessage) => {
    const mine = m.sender_id === userId;
    const act = async () => {
      if (mine) {
        const before = messages;
        setMessages((prev) => prev.filter((x) => x.id !== m.id));
        const { error: err } = await deleteNightMessage(m.id);
        if (err) {
          setMessages(before);
          Alert.alert("Couldn't delete that", err);
        }
      } else {
        router.push({ pathname: "/report/[kind]/[id]", params: { kind: "event_message", id: m.id } });
      }
    };
    const label = mine ? "Delete message" : "Report message";
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", label], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) act();
        }
      );
    } else {
      Alert.alert(label, undefined, [
        { text: "Cancel", style: "cancel" },
        { text: mine ? "Delete" : "Report", style: "destructive", onPress: act },
      ]);
    }
  };

  const header = (
    <View style={styles.header}>
      <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
        <ArrowLeft size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerName} numberOfLines={1}>
          {event?.title ?? "Event chat"}
        </Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {people.length ? `Event chat · ${people.length} people` : "Event chat"}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {header}
        <View style={styles.center}>
          <ErrorBanner message={error} />
          <Text style={styles.gateTitle}>RSVP to join the chat</Text>
          <Text style={styles.gateBody}>The event chat is for the host and everyone going.</Text>
          <Button title="Back to the event" variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {error ? (
          <View style={{ paddingHorizontal: GUTTER, paddingTop: spacing.sm }}>
            <ErrorBanner message={error} />
          </View>
        ) : null}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.gateTitle}>Nobody&apos;s said anything yet</Text>
              <Text style={styles.gateBody}>Say who you&apos;re coming with, or ask what to bring.</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <ChatBubble
              item={item}
              prev={messages[index - 1]}
              isMe={item.sender_id === userId}
              senderName={names.get(item.sender_id) ?? "Someone"}
              onLongPress={() => onLongPress(item)}
            />
          )}
        />
        <ChatComposer
          value={text}
          onChangeText={setText}
          onSend={send}
          sending={sending}
          placeholder="Message everyone going..."
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerName: { ...typography.bodyStrong },
  headerSub: { ...typography.micro },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  gateTitle: { ...typography.headline, textAlign: "center" },
  gateBody: { ...typography.caption, textAlign: "center", marginBottom: spacing.sm },
  list: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1 },
});
