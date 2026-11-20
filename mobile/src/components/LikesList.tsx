import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Heart, MessageCircle } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { useMatches } from "@/lib/matches";
import { supabase } from "@/lib/supabase";
import { getMyLikes, type LikeRow } from "@/lib/hearts";
import { startConversation } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";

type Person = { user_id: string; name: string; avatar_url: string | null };
/** Their latest like, so a like on your project can be answered in one tap. */
type Latest = Pick<LikeRow, "kind" | "target_id" | "title">;

/**
 * The top of Messages: a row of faces, one per person who liked your project
 * or hearted you or your work, newest first. Tap a face for their profile;
 * whether to write is decided there, with the work in front of you.
 *
 * This used to be a list with a sentence and a Message button on every row,
 * plus a toggle for hearts you'd sent. Faces say "someone's interested" in a
 * glance, and what you hearted is your business, not your inbox's.
 */
export function LikesList({ reloadKey = 0 }: { reloadKey?: number }) {
  const router = useRouter();
  const { matches } = useMatches();
  const [people, setPeople] = useState<Person[]>([]);
  const [latest, setLatest] = useState<Map<string, Latest>>(new Map());
  const [error, setError] = useState<string | null>(null);
  // The accept card: someone liked your project. Saying yes used to mean
  // opening their profile and writing the first line yourself, and of the
  // first likes on Melange most were never answered.
  const [open, setOpen] = useState<{ person: Person; like: Latest } | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    // The error is kept. Dropping it made a failed my_likes render exactly
    // like having no hearts, so an expired token or a missing migration was
    // indistinguishable from nobody liking you.
    const { data, error: likesErr } = await getMyLikes();
    if (likesErr) {
      setError(likesErr);
      return;
    }
    // my_likes is newest first, so the first sighting of a person is their
    // latest heart and the order of `ids` is the order of the row.
    const received = data.filter((r) => r.direction === "received");
    const ids = [...new Set(received.map((r) => r.other_user))];
    const first = new Map<string, Latest>();
    for (const r of received)
      if (!first.has(r.other_user)) first.set(r.other_user, r);
    setLatest(first);
    if (!ids.length) {
      setError(null);
      setPeople([]);
      return;
    }
    const { data: profs, error: profErr } = await supabase
      .from("profiles")
      .select("user_id,name,avatar_url")
      .in("user_id", ids);
    if (profErr) {
      setError(profErr.message);
      return;
    }
    setError(null);
    const byId = new Map(
      ((profs || []) as Person[]).map((p) => [p.user_id, p]),
    );
    setPeople(ids.map((id) => byId.get(id)).filter((p): p is Person => !!p));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // reloadKey is in here rather than in its own effect so a pull-to-refresh
      // still reloads without the mount running the whole thing twice.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, reloadKey]),
  );

  if (error) {
    return (
      <Text style={styles.note}>
        Couldn&apos;t load your hearts. Pull to refresh.
      </Text>
    );
  }

  // Someone you already have a thread with is in the list below; my_likes
  // also counts every mutual right-swipe as a project like, so without this
  // every match would sit up here too, forever.
  const talking = new Set(matches.map((m) => m.other_user_id));
  const shown = people.filter((p) => !talking.has(p.user_id));
  if (!shown.length) return null;

  const accept = async () => {
    if (!open || sending) return;
    const { person, like } = open;
    const first = (person.name || "there").split(" ")[0];
    const what = like.title ? `"${like.title}"` : "my project";
    setSending(true);
    setSendErr(null);
    const { matchId, error: err } = await startConversation(
      person.user_id,
      `Hey ${first}! Saw you liked ${what}. Want to work on it together?`,
      "project",
      like.target_id,
    );
    setSending(false);
    if (err || !matchId) {
      setSendErr(err || "That didn't send. Try again.");
      return;
    }
    trackEvent("like_accepted", {
      post_id: like.target_id,
      other: person.user_id,
    });
    setOpen(null);
    router.push({ pathname: "/chat/[matchId]", params: { matchId } });
  };

  const card = open ? (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => setOpen(null)}
    >
      <Pressable style={styles.scrim} onPress={() => setOpen(null)}>
        <Pressable
          style={styles.modal}
          accessibilityViewIsModal
          onPress={() => {}}
        >
          <Avatar
            creator={{
              name: open.person.name,
              avatar_url: open.person.avatar_url,
            }}
            size="lg"
          />
          <Text style={styles.modalTitle}>
            {open.person.name} liked{" "}
            {open.like.title ? `"${open.like.title}"` : "your project"}
          </Text>
          <Text style={styles.modalBody}>
            Say yes and a chat opens with a first message from you.
          </Text>
          {sendErr ? <Text style={styles.modalErr}>{sendErr}</Text> : null}
          <Pressable
            onPress={accept}
            disabled={sending}
            style={({ pressed }) => [
              styles.modalBtn,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
          >
            {sending ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <>
                <MessageCircle size={18} color={colors.onBrand} />
                <Text style={styles.modalBtnText}>Start the chat</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              const id = open.person.user_id;
              setOpen(null);
              router.push({
                pathname: "/profile/[userId]",
                params: { userId: id },
              });
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.secondary}>See their profile first</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  ) : null;

  return (
    <>
      {card}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {shown.map((p) => {
          const first = (p.name || "Someone").split(" ")[0];
          return (
            <Pressable
              key={p.user_id}
              onPress={() => {
                const like = latest.get(p.user_id);
                if (like?.kind === "project") {
                  setSendErr(null);
                  setOpen({ person: p, like });
                } else {
                  router.push({
                    pathname: "/profile/[userId]",
                    params: { userId: p.user_id },
                  });
                }
              }}
              style={({ pressed }) => [
                styles.item,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${p.name} hearted you. Open their profile.`}
            >
              <View>
                <Avatar
                  creator={{ name: p.name, avatar_url: p.avatar_url }}
                  size="lg"
                />
                <View style={styles.badge}>
                  <Heart size={10} color={colors.white} fill={colors.white} />
                </View>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {first}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
  },
  row: {
    gap: spacing.lg,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  item: { alignItems: "center", width: 64, gap: spacing.xs },
  // Ink: the "yes" colour. The badge is the only mark; the face does the rest.
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    ...typography.micro,
    fontFamily: fonts.medium,
    color: colors.text,
    maxWidth: 64,
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: GUTTER * 2,
  },
  modal: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  modalTitle: { ...typography.title, color: colors.text, textAlign: "center" },
  modalBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  modalErr: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
  },
  modalBtn: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  modalBtnText: {
    ...typography.bodyStrong,
    fontFamily: fonts.bold,
    color: colors.onBrand,
  },
  secondary: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
  },
});
