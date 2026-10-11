import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BookOpen,
  CalendarDays,
  Camera,
  ChevronRight,
  LogOut,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  ShieldOff,
  Trash2,
} from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { useBarTop } from "./_layout";
import { useAuth } from "@/lib/auth";
import {
  getCredits,
  getMyPosts,
  getProfile,
  PORTFOLIO_MAX_IMAGES,
  projectDates,
  projectRoles,
  updatePortfolio,
  updateProfile,
  uploadFile,
  type CollabPost,
  type Credit,
  type Profile,
} from "@/lib/db";
import { getStoriesForUser, storyDate, type StoryWithAuthor } from "@/lib/stories";


export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const barTop = useBarTop();
  const { userId, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myPosts, setMyPosts] = useState<CollabPost[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [work, setWork] = useState<StoryWithAuthor[]>([]);
  const [uploading, setUploading] = useState(false);
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);
    const [
      { data: profileData, error: profileErr },
      { data: postsData },
      { data: creditData },
      storyRes,
    ] = await Promise.all([
      getProfile(userId),
      getMyPosts(userId),
      getCredits(userId),
      getStoriesForUser(userId),
    ]);
    if (profileData) {
      setProfile(profileData);
    } else {
      setLoadError(profileErr || "We couldn't load your profile.");
    }
    setMyPosts(postsData || []);
    setCredits(creditData || []);
    setWork(storyRes.data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onChangeAvatar = async () => {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo permission denied", "Enable photo access in Settings to change your avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    setError(null);
    const asset = result.assets[0];
    const { url, error: uploadErr } = await uploadFile(
      userId,
      "avatars",
      asset.uri,
      asset.mimeType || "image/jpeg"
    );
    if (uploadErr || !url) {
      setUploading(false);
      setError(uploadErr || "Avatar upload failed.");
      return;
    }
    const { error: updateErr } = await updateProfile(userId, { avatar_url: url });
    setUploading(false);
    if (updateErr) setError(updateErr);
    else await load();
  };

  const onAddPortfolio = async () => {
    if (!userId || !profile) return;
    const current = profile.portfolio_urls ?? [];
    if (current.length >= PORTFOLIO_MAX_IMAGES) {
      Alert.alert("Portfolio full", `You can add up to ${PORTFOLIO_MAX_IMAGES} images.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo permission denied", "Enable photo access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: PORTFOLIO_MAX_IMAGES - current.length,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;

    setPortfolioBusy(true);
    setError(null);
    const uploaded: string[] = [];
    for (const asset of result.assets) {
      const { url, error: upErr } = await uploadFile(
        userId,
        "posts",
        asset.uri,
        asset.mimeType || "image/jpeg"
      );
      if (upErr || !url) {
        setError(upErr || "Upload failed.");
        break;
      }
      uploaded.push(url);
    }
    if (uploaded.length > 0) {
      const { error: updErr } = await updatePortfolio(userId, [...current, ...uploaded]);
      if (updErr) setError(updErr);
      else await load();
    }
    setPortfolioBusy(false);
  };

  const onRemovePortfolio = (idx: number) => {
    if (!userId || !profile) return;
    Alert.alert("Remove image?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const next = (profile.portfolio_urls ?? []).filter((_, i) => i !== idx);
          setPortfolioBusy(true);
          const { error: err } = await updatePortfolio(userId, next);
          setPortfolioBusy(false);
          if (err) setError(err);
          else await load();
        },
      },
    ]);
  };

  const onSignOut = async () => {
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  if (!profile) {
    if (loading) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
        </View>
      );
    }
    return (
      <View style={[styles.loading, styles.loadingError]}>
        <ErrorBanner message={loadError || "We couldn't load your profile."} />
        <Button title="Try again" variant="primary" onPress={load} />
        <Button title="Sign out" variant="outline" onPress={onSignOut} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: barTop + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Settings lives here now that Discover is full bleed and has no header. */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>You</Text>
          <Pressable
            hitSlop={12}
            onPress={() => router.push("/account/settings")}
            accessibilityLabel="Settings"
            style={styles.settingsBtn}
          >
            <SettingsIcon size={18} color={colors.brandText} />
          </Pressable>
        </View>

        {error ? (
          <View style={{ marginTop: spacing.md }}>
            <ErrorBanner message={error} />
          </View>
        ) : null}

        {/* Avatar */}
        <View style={styles.avatarBlock}>
          <Pressable onPress={onChangeAvatar} disabled={uploading} style={styles.avatarWrap}>
            <Avatar
              creator={{ name: profile.name, avatar_url: profile.avatar_url }}
              size="xl"
            />
            <View style={styles.cameraBadge}>
              {uploading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Camera size={14} color={colors.white} />
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
            {profile.role ? (
              <Text style={styles.profileRole} numberOfLines={1}>{profile.role}</Text>
            ) : null}
            <Text style={styles.profileHint}>
              {credits.length === 0
                ? "No credits yet"
                : `${credits.length} ${credits.length === 1 ? "credit" : "credits"} through Melange`}
            </Text>
            <Pressable
              onPress={() => router.push("/account/edit-profile")}
              hitSlop={12}
              style={styles.editLink}
            >
              <Text style={styles.sectionAction}>Edit profile</Text>
            </Pressable>
          </View>
        </View>

        {/* One header pattern for every section below: an eyebrow on the
            left, one plain text action on the right. No pills, no icons, no
            second colour — the screen used to carry three different answers
            to this within 400pt of scroll. */}

        {/* Credits */}
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>Credits</Text>
          </View>
          {credits.length === 0 ? (
            <Text style={styles.muted}>
              Apply to a project. When they pick you too and you work together, it lands here.
            </Text>
          ) : (
            <View>
              {credits.map((c) => (
                <View key={c.match_id} style={styles.listRow}>
                  <View style={[styles.creditDot, c.confirmed && styles.creditDotOn]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {c.title}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {c.role ? `${c.role} · ` : ""}with {c.with_name}
                      {c.confirmed ? "" : " · pending review"}
                    </Text>
                  </View>
                  <Text style={styles.rowWhen}>
                    {new Date(c.date.length === 10 ? `${c.date}T12:00:00` : c.date).toLocaleDateString([], {
                      month: "short",
                      year: "2-digit",
                    })}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Work — stories you wrote, and stories that credit you. */}
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>Work</Text>
            <Pressable
              onPress={() => router.push("/story/new")}
              hitSlop={12}
              accessibilityLabel="Post a story"
            >
              <Text style={styles.sectionAction}>Add</Text>
            </Pressable>
          </View>
          {work.length === 0 ? (
            <Text style={styles.muted}>
              Post something you already made. It does not have to be recent, and your
              collaborators do not have to be on Melange.
            </Text>
          ) : (
            <View>
              {work.map((s) => {
                const when = storyDate(s);
                const mine = s.author_id === userId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push({ pathname: "/story/[id]", params: { id: s.id } })}
                    style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
                  >
                    {s.media_urls[0] ? (
                      <Image source={{ uri: s.media_urls[0] }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]}>
                        <BookOpen size={16} color={colors.iconFaint} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {s.title}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {mine ? "You posted this" : `Credited by ${s.author.name}`}
                        {s.credits.length ? ` · ${s.credits.length + 1} people` : ""}
                      </Text>
                    </View>
                    {when ? <Text style={styles.rowWhen}>{when}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Portfolio. The add target is the first tile of the grid, not a
            dashed dropzone — nothing is ever dragged onto a phone. */}
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <Text style={styles.sectionCount}>
              {(profile.portfolio_urls?.length ?? 0)}/{PORTFOLIO_MAX_IMAGES}
            </Text>
          </View>
          <View style={styles.grid}>
            {(profile.portfolio_urls?.length ?? 0) < PORTFOLIO_MAX_IMAGES ? (
              <Pressable
                style={[styles.tile, styles.tileAdd]}
                onPress={onAddPortfolio}
                disabled={portfolioBusy}
                accessibilityLabel="Add portfolio images"
              >
                {portfolioBusy ? (
                  <ActivityIndicator color={colors.textTertiary} />
                ) : (
                  <Plus size={22} color={colors.textTertiary} />
                )}
              </Pressable>
            ) : null}
            {(profile.portfolio_urls ?? []).map((url, idx) => (
              <View key={`${url}-${idx}`} style={styles.tile}>
                <Image source={{ uri: url }} style={styles.tileImg} />
                <Pressable
                  style={styles.tileRemove}
                  onPress={() => onRemovePortfolio(idx)}
                  disabled={portfolioBusy}
                  hitSlop={6}
                >
                  <Text style={styles.tileRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {/* My projects */}
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>Your projects</Text>
            <Pressable onPress={() => router.push("/post/new")} hitSlop={12}>
              <Text style={styles.sectionAction}>Post</Text>
            </Pressable>
          </View>
          {myPosts.length === 0 ? (
            <Text style={styles.muted}>No projects posted yet.</Text>
          ) : (
            myPosts.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
                onPress={() =>
                  router.push({ pathname: "/post/edit/[id]", params: { id: p.id } })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {projectDates(p) ?? new Date(p.created_at).toLocaleDateString()}
                    {projectRoles(p).length ? ` · ${projectRoles(p).slice(0, 3).join(", ")}` : ""}
                    {p.is_active ? "" : " · inactive"}
                  </Text>
                </View>
                <Pencil size={16} color={colors.iconFaint} />
              </Pressable>
            ))
          )}
        </View>

        {/* Account & safety */}
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>Account & safety</Text>
          </View>

          <Pressable style={styles.linkRow} onPress={() => router.push("/events")}>
            <CalendarDays size={18} color={colors.iconFaint} />
            <Text style={styles.linkRowText}>Events</Text>
            <ChevronRight size={16} color={colors.iconFaint} />
          </Pressable>

          <Pressable style={styles.linkRow} onPress={() => router.push("/account/blocked")}>
            <ShieldOff size={18} color={colors.iconFaint} />
            <Text style={styles.linkRowText}>Blocked users</Text>
            <ChevronRight size={16} color={colors.iconFaint} />
          </Pressable>

          <Pressable style={styles.linkRow} onPress={onSignOut}>
            <LogOut size={18} color={colors.iconFaint} />
            <Text style={styles.linkRowText}>Sign out</Text>
            <ChevronRight size={16} color={colors.iconFaint} />
          </Pressable>

          <Pressable
            style={[styles.linkRow, { borderColor: colors.dangerSoft }]}
            onPress={() => router.push("/account/delete")}
          >
            <Trash2 size={18} color={colors.dangerText} />
            <Text style={[styles.linkRowText, { color: colors.dangerText }]}>
              Delete account
            </Text>
            <ChevronRight size={16} color={colors.dangerText} />
          </Pressable>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingError: { gap: 12, paddingHorizontal: 24 },
  /* One gutter, one rhythm. Sections are separated by space and a rule, not
     by nesting a white card inside a grey one. */
  scroll: { paddingHorizontal: GUTTER, gap: 0 },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topBarTitle: typography.display1,
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  avatarWrap: { position: "relative" },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },
  profileName: { ...typography.title, color: colors.text },
  profileRole: { ...typography.body, color: colors.textSecondary },
  profileHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  editLink: { alignSelf: "flex-start", marginTop: spacing.sm },

  /* A section: a rule, an eyebrow, then content directly on the ground. */
  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { ...typography.eyebrow, color: colors.textSecondary },
  sectionAction: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
  sectionCount: { ...typography.caption, color: colors.textTertiary },

  /* Every list row in this screen is the same row. */
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowTitle: { ...typography.headline, color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  rowWhen: { ...typography.micro, color: colors.textTertiary },
  thumb: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.bg },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  creditDot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.lineStrong },
  creditDotOn: { backgroundColor: colors.accent },
  muted: { ...typography.caption, color: colors.textSecondary },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: "31.5%",
    aspectRatio: 1,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  tileAdd: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  tileImg: { width: "100%", height: "100%" },
  tileRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: "rgba(17,24,39,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileRemoveText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.white },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  linkRowText: { ...typography.body, flex: 1, color: colors.text },
});
