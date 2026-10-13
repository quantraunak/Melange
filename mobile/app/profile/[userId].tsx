import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Flag, Link2, MapPin, MessageCircle, Star } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Chip } from "@/components/ui/Chip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAuth } from "@/lib/auth";
import {
  getProfile,
  getProfileTrust,
  projectDates,
  type Profile,
  type ProfileTrust,
} from "@/lib/db";
import { sized } from "@/lib/imageUrl";
import {
  getOpenProjectsBy,
  getStoriesForUser,
  storyDate,
  type OpenProject,
  type StoryWithAuthor,
} from "@/lib/stories";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const TILE = (SCREEN_W - GUTTER * 2 - spacing.sm * 2) / 3;

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
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

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", year: "numeric" });
}

/**
 * Someone else's profile.
 *
 * It answers one question — is this person worth working with — with the
 * evidence: the photographs they stand behind, their links, what they have
 * made and with whom, what they have open now, and what people they actually
 * worked with said about them. The rating only counts reviews both people
 * wrote, so nobody can be rated by someone they never answered.
 *
 * Message opens a conversation without a match. Deliberately not here:
 * anything you can act on about your own account.
 */
export default function PublicProfileScreen() {
  const { userId: viewedId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { userId: me } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [work, setWork] = useState<StoryWithAuthor[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [projects, setProjects] = useState<OpenProject[]>([]);
  const [trust, setTrust] = useState<ProfileTrust | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!viewedId) return;
    setLoading(true);
    const [p, stories, projects, t] = await Promise.all([
      getProfile(viewedId),
      getStoriesForUser(viewedId),
      getOpenProjectsBy(viewedId),
      getProfileTrust(viewedId),
    ]);
    setProfile(p.data);
    setError(p.error);
    setWork(stories.data);
    setProjects(projects.data ?? []);
    setTrust(t.data);
    // Profiles carry no city of their own, so the one on their most recent
    // open project stands in. It is the city they are actually working in,
    // which is the thing a reader wants to know anyway.
    setCity(projects.data?.find((pr) => pr.location)?.location ?? null);
    setLoading(false);
  }, [viewedId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Your own profile is the Profile tab, which can edit. Landing here from a
     credit on your own work would otherwise be a dead end that looks broken. */
  useEffect(() => {
    if (me && viewedId && me === viewedId) router.replace("/(tabs)/profile");
  }, [me, viewedId, router]);

  const links = useMemo(
    () =>
      [
        profile?.reel_url ? { label: "Reel / portfolio", url: profile.reel_url } : null,
        profile?.instagram_url ? { label: "Instagram", url: profile.instagram_url } : null,
        profile?.linkedin_url ? { label: "LinkedIn", url: profile.linkedin_url } : null,
      ].filter((l): l is { label: string; url: string } => !!l),
    [profile]
  );

  const roles = useMemo(() => {
    const out = [profile?.role, ...(profile?.skills ?? [])].filter(
      (r): r is string => !!r && !!r.trim()
    );
    return [...new Set(out)].slice(0, 4);
  }, [profile]);

  const header = (
    <View style={styles.header}>
      <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
        <ArrowLeft size={22} color={colors.text} />
      </Pressable>
      {viewedId && viewedId !== me ? (
        <Pressable
          hitSlop={12}
          accessibilityLabel="Report this person"
          onPress={() =>
            router.push({ pathname: "/report/[kind]/[id]", params: { kind: "user", id: viewedId } })
          }
        >
          <Flag size={18} color={colors.iconFaint} />
        </Pressable>
      ) : null}
    </View>
  );

  const openPerson = (id?: string) => {
    if (!id || id === viewedId) return;
    router.push({ pathname: "/profile/[userId]", params: { userId: id } });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {header}
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {header}
        <View style={styles.loading}>
          <ErrorBanner message={error || "We couldn't load this profile."} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.identity}>
          <Avatar creator={{ name: profile.name, avatar_url: profile.avatar_url }} size="xl" />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={2}>
              {profile.name}
            </Text>
            {city ? (
              <View style={styles.cityRow}>
                <MapPin size={13} color={colors.iconFaint} strokeWidth={1.8} />
                <Text style={styles.city} numberOfLines={1}>
                  {city}
                </Text>
              </View>
            ) : null}
            {trust && trust.review_count > 0 && trust.avg_rating != null ? (
              <View style={styles.ratingRow}>
                <Stars rating={trust.avg_rating} />
                <Text style={styles.ratingText}>
                  {trust.avg_rating.toFixed(1)} · {trust.review_count} review
                  {trust.review_count === 1 ? "" : "s"}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.messageBtn, pressed && { opacity: 0.85 }]}
          onPress={() =>
            router.push({
              pathname: "/message/[userId]",
              params: { userId: profile.user_id, origin: "profile" },
            })
          }
          accessibilityRole="button"
        >
          <MessageCircle size={18} color={colors.onAccent} />
          <Text style={styles.messageText}>Message {profile.name.split(" ")[0]}</Text>
        </Pressable>

        {roles.length ? (
          <View style={styles.roles}>
            {roles.map((r) => (
              <Chip key={r} label={r} size="sm" />
            ))}
          </View>
        ) : null}

        {profile.bio?.trim() ? <Text style={styles.bio}>{profile.bio.trim()}</Text> : null}

        {links.length ? (
          <View style={styles.links}>
            {links.map((l) => (
              <Pressable
                key={l.label}
                style={({ pressed }) => [styles.linkChip, pressed && { opacity: 0.7 }]}
                onPress={() => Linking.openURL(l.url).catch(() => {})}
                accessibilityRole="link"
              >
                <Link2 size={14} color={colors.brandText} />
                <Text style={styles.linkText}>{l.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {profile.portfolio_urls?.length ? (
          <View style={styles.block}>
            <View style={styles.grid}>
              {profile.portfolio_urls.map((url, i) => (
                <Image
                  key={`${url}-${i}`}
                  source={{ uri: sized(url, TILE, TILE) }}
                  style={styles.tile}
                  contentFit="cover"
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.eyebrow}>Work</Text>
          {work.length === 0 ? (
            <Text style={styles.muted}>Nothing yet.</Text>
          ) : (
            work.map((w) => {
              /* Everyone on it except the person whose page this is. Without
                 the exclusion a piece someone else credited you on reads
                 "with <you>", which is the one name the reader already has. */
              const names = [
                ...(w.author_id === viewedId ? [] : [w.author.name]),
                ...w.credits
                  .filter((c) => (c.user_id ? c.user_id !== viewedId : c.name !== profile.name))
                  .map((c) => c.name),
              ].filter(Boolean);
              return (
                <Pressable
                  key={w.id}
                  onPress={() => router.push({ pathname: "/story/[id]", params: { id: w.id } })}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                >
                  {w.media_urls[0] ? (
                    <Image
                      source={{ uri: sized(w.media_urls[0], 44, 44) }}
                      style={styles.thumb}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {w.title}
                    </Text>
                    {names.length ? (
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        with {names.slice(0, 3).join(", ")}
                      </Text>
                    ) : null}
                  </View>
                  {storyDate(w) ? (
                    <Text style={[styles.rowWhen, styles.rowWhenWrap]}>{storyDate(w)}</Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>

        {projects.length ? (
          <View style={styles.block}>
            <Text style={styles.eyebrow}>Open now</Text>
            {projects.map((pr) => (
              <Pressable
                key={pr.id}
                onPress={() => router.push({ pathname: "/post/[id]", params: { id: pr.id } })}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              >
                {pr.media_urls?.[0] ? (
                  <Image
                    source={{ uri: sized(pr.media_urls[0], 44, 44) }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {pr.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {projectDates(pr) ?? pr.location ?? "Open project"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.eyebrow}>Past collabs</Text>
          {!trust?.past_collabs.length ? (
            <Text style={styles.muted}>None confirmed yet. One shows here once both people review each other.</Text>
          ) : (
            trust.past_collabs.map((c) => (
              <Pressable
                key={c.match_id}
                onPress={() => openPerson(c.with.user_id)}
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
            <Text style={styles.muted}>No reviews yet. They appear once both people on a collab have written one.</Text>
          ) : (
            trust.reviews.map((r) => (
              <View key={r.id} style={styles.review}>
                <Pressable style={styles.reviewHead} onPress={() => openPerson(r.reviewer.user_id)}>
                  <Avatar creator={r.reviewer} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{r.reviewer.name}</Text>
                    <Text style={styles.rowWhen}>{monthYear(r.created_at)}</Text>
                  </View>
                  <Stars rating={r.rating} size={11} />
                </Pressable>
                {r.body ? <Text style={styles.reviewBody}>{r.body}</Text> : null}
                {r.tags.length ? (
                  <View style={styles.roles}>
                    {r.tags.map((t) => (
                      <Chip key={t} label={t} size="sm" />
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  scroll: { paddingHorizontal: GUTTER, paddingBottom: spacing.xxxl },

  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  name: { ...typography.display2, color: colors.text },
  cityRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  city: { ...typography.caption, color: colors.textSecondary },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  ratingText: { ...typography.caption, color: colors.text },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    marginTop: spacing.lg,
  },
  messageText: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.onAccent },
  links: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
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
  review: {
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  reviewBody: { ...typography.body, color: colors.text },

  roles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  bio: { ...typography.body, color: colors.textSecondary, marginTop: spacing.lg },

  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  eyebrow: { ...typography.eyebrow, color: colors.textSecondary },
  muted: { ...typography.caption, color: colors.textSecondary },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: TILE,
    aspectRatio: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSunken,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowWhenWrap: { alignSelf: "flex-start", paddingTop: 2 },
  rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  rowWhen: { ...typography.micro, color: colors.textTertiary },
  thumb: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.bg },
  thumbEmpty: { backgroundColor: colors.surfaceSunken },
});
