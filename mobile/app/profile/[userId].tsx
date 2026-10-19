import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Flag, MapPin, MessageCircle } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { HeartButton } from "@/components/HeartButton";
import {
  ProfileAbout,
  ProfileTrustSections,
  RatingLine,
} from "@/components/ProfileSections";
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
            <RatingLine trust={trust} />
          </View>
        </View>

        {profile.user_id !== me ? (
          <View style={styles.actions}>
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
            <HeartButton kind="profile" targetId={profile.user_id} ownerId={profile.user_id} label />
          </View>
        ) : null}

        <ProfileAbout profile={profile} />

        <View style={styles.block}>
          <Text style={styles.eyebrow}>Showcase</Text>
          <Text style={styles.hint}>Things {profile.name.split(" ")[0]} has made, and who with.</Text>
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
            <Text style={styles.eyebrow}>Projects</Text>
            <Text style={styles.hint}>Open now, and who they&apos;re looking for.</Text>
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

        <ProfileTrustSections trust={trust} onOpenPerson={openPerson} />
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
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  messageBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  messageText: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.onAccent },


  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  eyebrow: { ...typography.eyebrow, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textTertiary, marginTop: -4 },
  muted: { ...typography.caption, color: colors.textSecondary },


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
