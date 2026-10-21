import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { MapPin } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Chip } from "@/components/ui/Chip";
import { categoryDisplay } from "@/lib/events";
import { formatEventTime } from "@/lib/format";
import { sized } from "@/lib/imageUrl";
import type { Face, NightWithFaces } from "@/lib/nights";
import { sceneLabel } from "@/lib/scenes";
import { colors, fonts, radii, shadows, spacing, typography } from "@/lib/theme";

/** Overlapping faces. Who's going is the reason to go, so it leads the card's footer. */
export function FaceStack({ faces, total }: { faces: Face[]; total?: number }) {
  if (!faces.length) return null;
  const extra = (total ?? faces.length) - faces.length;
  return (
    <View style={styles.faces}>
      {faces.map((f, i) => (
        <View key={f.user_id} style={[styles.face, i > 0 && styles.faceOverlap]}>
          <Avatar creator={f} size="xs" />
        </View>
      ))}
      {extra > 0 ? <Text style={styles.facesMore}>+{extra}</Text> : null}
    </View>
  );
}

/**
 * One night on the Nights tab: the cover, when and where, and who's going.
 * The whole card opens the night; RSVP and the chat live there, so the list
 * stays one tap per thing.
 */
export function NightCard({
  night,
  showScene,
  onPress,
}: {
  night: NightWithFaces;
  /** On "All", say which scene each night is in. */
  showScene?: boolean;
  onPress: () => void;
}) {
  const cat = categoryDisplay(night.category);
  const { day, time } = formatEventTime(night.start_at);
  const scene = showScene ? sceneLabel(night.scene) : null;
  const going = night.going_count;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${night.title}, ${day} at ${time}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cover}>
        {night.cover_url ? (
          <Image
            source={{ uri: sized(night.cover_url, 400, 170) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={160}
          />
        ) : (
          <Text style={styles.coverEmoji}>{cat.emoji}</Text>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.when}>
          {day} · {time}
          {night.my_rsvp === "going" ? "  ·  You're going" : ""}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {night.title}
        </Text>
        {night.location_name || night.city ? (
          <View style={styles.placeRow}>
            <MapPin size={13} color={colors.iconFaint} />
            <Text style={styles.place} numberOfLines={1}>
              {[night.location_name, night.city].filter(Boolean).join(", ")}
            </Text>
          </View>
        ) : null}
        <View style={styles.footer}>
          <FaceStack faces={night.faces} total={going} />
          <Text style={styles.going}>
            {going ? `${going} going` : "Be the first to go"}
          </Text>
          {scene ? <Chip label={scene} size="sm" tone="outline" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadows.card,
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.995 }] },
  cover: {
    height: 150,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  coverEmoji: { ...typography.display1 },
  body: { padding: spacing.lg, gap: spacing.xs },
  when: { ...typography.eyebrow, color: colors.accentInk },
  title: { ...typography.title },
  placeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  place: { ...typography.caption, flex: 1 },
  footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  going: { ...typography.caption, fontFamily: fonts.medium, flex: 1 },
  faces: { flexDirection: "row", alignItems: "center" },
  face: { borderRadius: radii.pill, borderWidth: 2, borderColor: colors.surface },
  faceOverlap: { marginLeft: -8 },
  facesMore: { ...typography.micro, marginLeft: spacing.xs },
});
