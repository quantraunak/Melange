import { useMemo } from "react";
import { Alert, Dimensions, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link2, Star } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Chip } from "@/components/ui/Chip";
import { sized } from "@/lib/imageUrl";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import type { Profile, ProfileTrust } from "@/lib/db";

/*
 * The parts of a profile that are about the PERSON, shared by your own Profile
 * tab and everyone else's page so the two can never drift apart:
 *
 *   About    who they are: what they do, what they're looking for, bio,
 *            links, photos.
 *   Trust    rating, reviews and past collabs, from people they worked with.
 *
 * Showcase (past work) and Projects (what they have open) are separate
 * sections each screen renders itself, because they come from separate
 * tables and the actions on them differ between your page and someone else's.
 */

const TILE = (Dimensions.get("window").width - GUTTER * 2 - spacing.sm * 2) / 3;
/** Photographs of people are portrait; a 4:5 tile keeps the figure whole. */
const TILE_H = Math.round((TILE * 5) / 4);

export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          color={colors.accent}
          fill={n <= Math.round(rating) ? colors.accent : "transparent"}
        />
      ))}
    </View>
  );
}

/**
 * "Mar 2026". A date-only value (or one cast to UTC midnight, as
 * public_credits returns) is anchored at midday so it stays in its own month
 * in every timezone.
 */
export function monthYear(iso: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const midnightUtc = /^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?(Z|\+00:?00)$/.test(iso);
  const anchored = dateOnly
    ? `${iso}T12:00:00`
    : midnightUtc
      ? `${iso.slice(0, 10)}T12:00:00`
      : iso;
  return new Date(anchored).toLocaleDateString([], { month: "short", year: "numeric" });
}

/** Profile links are free text: repair a missing scheme, and say so if it still won't open. */
async function openLink(url: string, label: string): Promise<void> {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  try {
    await Linking.openURL(candidate);
  } catch {
    Alert.alert(`Can't open that ${label} link`, candidate);
  }
}

export function RatingLine({ trust }: { trust: ProfileTrust | null }) {
  if (!trust || trust.review_count === 0 || trust.avg_rating == null) return null;
  return (
    <View style={styles.ratingRow}>
      <Stars rating={trust.avg_rating} />
      <Text style={styles.ratingText}>
        {trust.avg_rating.toFixed(1)} · {trust.review_count} review{trust.review_count === 1 ? "" : "s"}
      </Text>
    </View>
  );
}

/**
 * About: what they do, what they're looking for, bio, links and photos.
 * `emptyHint` is shown when there is nothing at all (your own page uses it to
 * point at Edit profile).
 */
export function ProfileAbout({ profile, emptyHint }: { profile: Profile; emptyHint?: string }) {
  const roles = useMemo(() => {
    const out = [profile.role, ...(profile.skills ?? [])].filter(
      (r): r is string => !!r && !!r.trim() && r !== "other"
    );
    return [...new Set(out)].slice(0, 6);
  }, [profile]);

  const links = useMemo(
    () =>
      [
        profile.reel_url ? { label: "Reel / portfolio", url: profile.reel_url } : null,
        profile.instagram_url ? { label: "Instagram", url: profile.instagram_url } : null,
        profile.linkedin_url ? { label: "LinkedIn", url: profile.linkedin_url } : null,
      ].filter((l): l is { label: string; url: string } => !!l),
    [profile]
  );

  // Shown only once the owner has saved their profile from a build that
  // labels this field publicly. It was collected for years inside Edit
  // profile as "Current project" and never displayed to anyone, so printing
  // the existing values would publish text five real people wrote in private.
  // See 19_looking_for_consent.sql.
  const lookingFor = profile.looking_for_is_public ? profile.current_project?.trim() : undefined;
  const bio = profile.bio?.trim();
  const photos = profile.portfolio_urls ?? [];
  const empty = !roles.length && !lookingFor && !bio && !links.length && !photos.length;

  return (
    <View style={styles.block}>
      <Text style={styles.eyebrow}>About</Text>

      {empty && emptyHint ? <Text style={styles.muted}>{emptyHint}</Text> : null}

      {roles.length ? (
        <View style={styles.chips}>
          {roles.map((r) => (
            <Chip key={r} label={r} size="sm" />
          ))}
        </View>
      ) : null}

      {lookingFor ? (
        <View style={styles.lookingFor}>
          <Text style={styles.label}>Looking for</Text>
          <Text style={styles.body}>{lookingFor}</Text>
        </View>
      ) : null}

      {bio ? <Text style={styles.bio}>{bio}</Text> : null}

      {links.length ? (
        <View style={styles.chips}>
          {links.map((l) => (
            <Pressable
              key={l.label}
              style={({ pressed }) => [styles.linkChip, pressed && { opacity: 0.7 }]}
              onPress={() => openLink(l.url, l.label)}
              accessibilityRole="link"
            >
              <Link2 size={14} color={colors.brandText} />
              <Text style={styles.linkText}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {photos.length ? (
        <View style={styles.grid}>
          {photos.map((url, i) => (
            <Image
              key={`${url}-${i}`}
              source={{ uri: sized(url, TILE, TILE_H) }}
              style={styles.tile}
              contentFit="cover"
              transition={160}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Past collabs and reviews. Faces open the other person's profile. */
export function ProfileTrustSections({
  trust,
  onOpenPerson,
}: {
  trust: ProfileTrust | null;
  onOpenPerson: (userId?: string) => void;
}) {
  return (
    <>
      <View style={styles.block}>
        <Text style={styles.eyebrow}>Past collabs</Text>
        {!trust?.past_collabs.length ? (
          <Text style={styles.muted}>
            None confirmed yet. One shows here once both people review each other.
          </Text>
        ) : (
          trust.past_collabs.map((c) => (
            <Pressable
              key={c.match_id}
              onPress={() => onOpenPerson(c.with.user_id)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
            >
              <Avatar creator={c.with} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {c.title ?? `With ${c.with.name}`}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {c.title ? `with ${c.with.name} · ` : ""}
                  {monthYear(c.date)}
                </Text>
              </View>
              <Stars rating={c.rating} size={11} />
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.block}>
        <Text style={styles.eyebrow}>
          {trust?.review_count ? `Reviews (${trust.review_count})` : "Reviews"}
        </Text>
        {!trust?.reviews.length ? (
          <Text style={styles.muted}>
            No reviews yet. They appear once both people on a collab have written one.
          </Text>
        ) : (
          trust.reviews.map((r) => (
            <View key={r.id} style={styles.review}>
              <Pressable style={styles.reviewHead} onPress={() => onOpenPerson(r.reviewer.user_id)}>
                <Avatar creator={r.reviewer} size="sm" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{r.reviewer.name}</Text>
                  <Text style={styles.rowWhen}>{monthYear(r.created_at)}</Text>
                </View>
                <Stars rating={r.rating} size={11} />
              </Pressable>
              {r.body ? <Text style={styles.body}>{r.body}</Text> : null}
              {r.tags.length ? (
                <View style={styles.chips}>
                  {r.tags.map((t) => (
                    <Chip key={t} label={t} size="sm" />
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </>
  );
}

export const profileStyles = StyleSheet.create({
  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { ...typography.eyebrow, color: colors.textSecondary },
  sectionAction: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
  hint: { ...typography.caption, color: colors.textTertiary, marginTop: -4 },
  muted: { ...typography.caption, color: colors.textSecondary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  rowWhen: { ...typography.micro, color: colors.textTertiary },
  thumb: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.bg },
  thumbEmpty: { backgroundColor: colors.surfaceSunken },
});

const styles = StyleSheet.create({
  ...profileStyles,
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  ratingText: { ...typography.caption, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  lookingFor: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
  },
  label: { ...typography.micro, fontFamily: fonts.semibold, color: colors.accentInk, textTransform: "uppercase" },
  body: { ...typography.body, color: colors.text },
  bio: { ...typography.body, color: colors.textSecondary },
  linkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  linkText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: { width: TILE, height: TILE_H, borderRadius: radii.sm, backgroundColor: colors.surfaceSunken },
  review: {
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
