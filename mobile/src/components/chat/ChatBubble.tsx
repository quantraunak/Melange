import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Heart } from "lucide-react-native";
import { MESSAGE_HEART_BLUE } from "@/lib/messageHearts";
import { formatChatDivider } from "@/lib/format";
import { colors, radii, typography } from "@/lib/theme";

export type ChatLine = { id: string; sender_id: string; content: string; created_at: string };

const GAP_MS = 15 * 60 * 1000;

function gap(a?: ChatLine, b?: ChatLine): number {
  return a && b ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : Infinity;
}

/**
 * One message, shared by one-on-one chats and night chats.
 *
 * Time used to sit beside the bubble, and only after a pause. In a
 * conversation that spans a day that reads as a few stale times, and the
 * stamp pushed the sender's bubbles in from the edge. Now it's a centered
 * divider whenever the conversation resumes after a pause, the way Messages
 * does it. In a group, the sender's name heads each run of theirs.
 */
export function ChatBubble({
  item,
  prev,
  isMe,
  senderName,
  onLongPress,
  onDoubleTap,
  hearts = 0,
  footer,
}: {
  item: ChatLine;
  prev?: ChatLine;
  isMe: boolean;
  /** Group chats only: who wrote it, shown above the first bubble of a run. */
  senderName?: string;
  onLongPress?: () => void;
  /** Double-tap, the way you heart a message elsewhere. */
  onDoubleTap?: () => void;
  /** How many people hearted it: a blue heart on the bubble. */
  hearts?: number;
  /** A line under the bubble, e.g. "Seen". */
  footer?: string | null;
}) {
  const lastTap = useRef(0);
  const onPress = onDoubleTap
    ? () => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          lastTap.current = 0;
          onDoubleTap();
        } else {
          lastTap.current = now;
        }
      }
    : undefined;
  const startsSection = gap(prev, item) > GAP_MS;
  const sameAuthorBefore = !startsSection && !!prev && prev.sender_id === item.sender_id;

  return (
    <View>
      {startsSection ? <Text style={styles.divider}>{formatChatDivider(item.created_at)}</Text> : null}
      {senderName && !isMe && !sameAuthorBefore ? (
        <Text style={styles.sender} numberOfLines={1}>
          {senderName}
        </Text>
      ) : null}
      <View
        style={[
          styles.row,
          isMe ? styles.rowMe : styles.rowOther,
          sameAuthorBefore || (senderName && !isMe) ? { marginTop: 2 } : { marginTop: 10 },
        ]}
      >
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          disabled={!onLongPress && !onDoubleTap}
          delayLongPress={350}
          style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, hearts > 0 && styles.bubbleHearted]}
          accessibilityHint={onDoubleTap ? "Double-tap to heart" : undefined}
        >
          <Text style={[styles.text, isMe && { color: colors.onAccent }]}>{item.content}</Text>
          {hearts > 0 ? (
            <View style={[styles.heart, isMe ? styles.heartMe : styles.heartOther]}>
              <Heart size={12} color={MESSAGE_HEART_BLUE} fill={MESSAGE_HEART_BLUE} />
              {hearts > 1 ? <Text style={styles.heartCount}>{hearts}</Text> : null}
            </View>
          ) : null}
        </Pressable>
      </View>
      {footer ? <Text style={[styles.footer, isMe && { textAlign: "right" }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowMe: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  /* No tail notch: the spec allows four radii and a fifth value for one
     corner of one component is how scales rot. A run reads as a run from
     spacing — 2pt inside a block, 10pt between blocks. */
  bubble: {
    maxWidth: "76%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.lg,
  },
  bubbleMe: { backgroundColor: colors.bubbleMe },
  bubbleOther: { backgroundColor: colors.bubbleOther },
  bubbleHearted: { marginBottom: 10 },
  heart: {
    position: "absolute",
    bottom: -10,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  heartMe: { left: -6 },
  heartOther: { right: -6 },
  heartCount: { ...typography.micro, color: MESSAGE_HEART_BLUE },
  footer: { ...typography.micro, color: colors.textTertiary, marginTop: 3, marginHorizontal: 4 },
  text: { ...typography.body, color: colors.text },
  sender: { ...typography.micro, color: colors.textTertiary, marginTop: 10, marginLeft: 14 },
  divider: {
    ...typography.micro,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: 18,
    marginBottom: 4,
  },
});
