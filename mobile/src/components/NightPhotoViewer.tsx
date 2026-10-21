import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Check, Tag, Trash2, UserRoundX, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import type { NightPhoto } from "@/lib/nightPhotos";
import type { NightPerson } from "@/lib/nights";

const { width: SCREEN_W } = Dimensions.get("window");

function firstName(name: string | null | undefined): string {
  return (name ?? "").split(" ")[0] || "Someone";
}

/**
 * Full-screen night photos: swipe between them, see who's in each, tag
 * people, take your own tag off, and delete what you added.
 *
 * Light, like everything else: the photo sits on the app's ground rather
 * than on black, and the controls are on their own opaque strip below it,
 * not over it (DESIGN.md: no dark chrome, no scrim on a photograph).
 *
 * The parent owns the photos and does the writes; this only shows `photos`
 * and calls back, so an optimistic tag or a rollback shows here the moment
 * the parent's state moves. `ids` fixes which photos this viewing pages
 * through (the "Your photos" strip or the whole roll) at the time it opened.
 */
export function NightPhotoViewer({
  photos,
  ids,
  startIndex,
  userId,
  people,
  busy,
  onClose,
  onTag,
  onRemoveMyTag,
  onDelete,
}: {
  photos: NightPhoto[];
  ids: string[] | null;
  startIndex: number;
  userId: string;
  people: NightPerson[];
  /** Photo ids with a write in flight. */
  busy: Set<string>;
  onClose: () => void;
  onTag: (photo: NightPhoto, person: NightPerson) => void;
  onRemoveMyTag: (photo: NightPhoto) => void;
  onDelete: (photo: NightPhoto) => void;
}) {
  const visible = !!ids;
  // Look each id up in the live list, so a deleted photo drops out and a new
  // tag shows without reopening.
  const pages = useMemo(() => {
    if (!ids) return [];
    const byId = new Map(photos.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is NightPhoto => !!p);
  }, [ids, photos]);

  const [index, setIndex] = useState(startIndex);
  const [tagging, setTagging] = useState(false);
  const listRef = useRef<FlatList<NightPhoto>>(null);

  useEffect(() => {
    if (visible) setIndex(startIndex);
  }, [visible, startIndex]);

  // The last photo in this viewing was deleted: nothing left to show.
  useEffect(() => {
    if (visible && ids && !pages.length) onClose();
  }, [visible, ids, pages.length, onClose]);

  const at = Math.min(index, Math.max(0, pages.length - 1));
  const current = pages[at];

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <X size={22} color={colors.text} />
          </Pressable>
          {pages.length > 1 ? (
            <Text style={styles.count}>
              {at + 1} of {pages.length}
            </Text>
          ) : null}
          <View style={{ width: 22 }} />
        </View>

        {visible && pages.length ? (
          <FlatList
            ref={listRef}
            data={pages}
            keyExtractor={(p) => p.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(startIndex, pages.length - 1)}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
            renderItem={({ item }) => (
              <View style={styles.page}>
                {item.url ? (
                  <Image
                    source={{ uri: item.url, cacheKey: item.path }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    transition={120}
                    accessibilityLabel={`Photo from ${firstName(item.uploader_name)}`}
                  />
                ) : null}
              </View>
            )}
            style={{ flex: 1 }}
          />
        ) : (
          <View style={styles.page} />
        )}

        {current ? (
          <View style={styles.foot}>
            <Text style={styles.from} numberOfLines={1}>
              {current.uploader_id === userId ? "You added this" : `From ${firstName(current.uploader_name)}`}
            </Text>
            {current.caption ? <Text style={styles.caption}>{current.caption}</Text> : null}
            <Text style={styles.with} numberOfLines={2}>
              {current.tagged.length
                ? `With ${current.tagged.map((t) => (t.user_id === userId ? "you" : firstName(t.name))).join(", ")}`
                : "Nobody tagged yet"}
            </Text>
            <View style={styles.actions}>
              <Button
                title="Tag people"
                variant="outline"
                size="sm"
                leadingIcon={<Tag size={14} color={colors.text} />}
                onPress={() => setTagging(true)}
              />
              {current.includes_me ? (
                <Button
                  title="Remove my tag"
                  variant="ghost"
                  size="sm"
                  disabled={busy.has(current.id)}
                  leadingIcon={<UserRoundX size={14} color={colors.text} />}
                  onPress={() => onRemoveMyTag(current)}
                />
              ) : null}
              {current.uploader_id === userId ? (
                <Button
                  title="Delete"
                  variant="ghost"
                  size="sm"
                  disabled={busy.has(current.id)}
                  leadingIcon={<Trash2 size={14} color={colors.text} />}
                  onPress={() => onDelete(current)}
                />
              ) : null}
              {busy.has(current.id) ? <ActivityIndicator color={colors.textSecondary} /> : null}
            </View>
          </View>
        ) : null}

        <TagSheet
          visible={tagging && !!current}
          photo={current ?? null}
          people={people}
          userId={userId}
          onTag={(p) => current && onTag(current, p)}
          onClose={() => setTagging(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Everyone from the night; tap someone to tag them. A tag is one tap and
 * shows at once (the parent rolls it back if the server says no). People
 * already tagged show a check and can't be tapped again: taking a tag off
 * is the tagged person's call, from their own "Remove my tag".
 */
function TagSheet({
  visible,
  photo,
  people,
  userId,
  onTag,
  onClose,
}: {
  visible: boolean;
  photo: NightPhoto | null;
  people: NightPerson[];
  userId: string;
  onTag: (p: NightPerson) => void;
  onClose: () => void;
}) {
  const tagged = new Set((photo?.tagged ?? []).map((t) => t.user_id));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Who&apos;s in it?</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetList}>
          {people.length ? (
            people.map((p) => {
              const on = tagged.has(p.user_id);
              return (
                <Pressable
                  key={p.user_id}
                  disabled={on}
                  onPress={() => onTag(p)}
                  style={({ pressed }) => [styles.personRow, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={on ? `${p.name}, tagged` : `Tag ${p.name}`}
                >
                  <Avatar creator={p} size="md" />
                  <Text style={styles.personName} numberOfLines={1}>
                    {p.user_id === userId ? "You" : p.name}
                  </Text>
                  {on ? (
                    <View style={styles.checkOn}>
                      <Check size={14} color={colors.onAccent} />
                    </View>
                  ) : (
                    <Text style={styles.tagLink}>Tag</Text>
                  )}
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.empty}>Nobody else was on the list.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
  },
  count: { ...typography.micro, color: colors.textSecondary },
  page: { width: SCREEN_W, flex: 1, alignItems: "center", justifyContent: "center" },
  foot: {
    backgroundColor: colors.surface,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  from: { ...typography.bodyStrong, color: colors.text },
  caption: { ...typography.body, color: colors.text },
  with: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  sheet: { flex: 1, backgroundColor: colors.surface },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  sheetTitle: { ...typography.headline, color: colors.text },
  done: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.brandText },
  sheetList: { paddingHorizontal: GUTTER, paddingBottom: spacing.xxxl },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  personName: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  tagLink: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
  checkOn: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.lg },
});
