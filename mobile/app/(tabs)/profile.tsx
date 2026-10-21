import { useCallback, useEffect, useMemo, useState } from "react";
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
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ImageIcon, Camera, Pencil, Settings as SettingsIcon } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { IdentityLine } from "@/components/IdentityLine";
import { ScreenTitle } from "@/components/ScreenTitle";
import {
  ProfileAbout,
  ProfileTrustSections,
  RatingLine,
} from "@/components/ProfileSections";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Input } from "@/components/ui/Input";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { sized } from "@/lib/imageUrl";
import { useBarTop } from "./_layout";
import { useAuth } from "@/lib/auth";
import {
  getCredits,
  getMyPosts,
  getProfile,
  getProfileTrust,
  projectDates,
  projectRoles,
  updateProfile,
  uploadFile,
  type CollabPost,
  type Credit,
  type Profile,
  type ProfileTrust,
} from "@/lib/db";
import { getStoriesForUser, storyDate, type StoryWithAuthor } from "@/lib/stories";
import { formatRecordDate } from "@/lib/format";
import { redeemInvite } from "@/lib/scenes";


export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const barTop = useBarTop();
  const { userId, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myPosts, setMyPosts] = useState<CollabPost[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [stories, setStories] = useState<StoryWithAuthor[]>([]);
  const [trust, setTrust] = useState<ProfileTrust | null>(null);
  const [uploading, setUploading] = useState(false);
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
      trustRes,
    ] = await Promise.all([
      getProfile(userId),
      getMyPosts(userId),
      getCredits(userId),
      getStoriesForUser(userId),
      getProfileTrust(userId),
    ]);
    if (profileData) {
      setProfile(profileData);
    } else {
      setLoadError(profileErr || "We couldn't load your profile.");
    }
    setMyPosts(postsData || []);
    setCredits(creditData || []);
    setStories(storyRes.data);
    setTrust(trustRes.data);
    setLoading(false);
  }, [userId]);

  // Back from Edit profile with a new handle or scene, the header should say so.
  useFocusEffect(
    useCallback(() => {
      if (!loading) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  /* Work and Your projects are one split of the same material, decided here,
     so nothing can land in both.

       Work          what you made. A story you recorded, or a credit a
                     review backs. Finished, and always with someone.
       Your projects what you have open. Posts you own, still looking.

     The split holds by construction rather than by filtering: a post you own
     can never reach Work, because a story is a story and a credit is on the
     project of the person who credited you. Work used to be built partly out
     of bare matches, which is how your own open call ended up listed under
     both. Matching is not making something; that row lives on Matches. */
  const { work, projects } = useMemo(() => {
    const made = [
      ...stories.map((st) => {
        const names = st.credits.map((c) => c.name).filter(Boolean);
        return {
          key: `story-${st.id}`,
          image: st.media_urls[0] ?? null,
          title: st.title,
          with: names.length ? `with ${names.slice(0, 3).join(", ")}` : null,
          when: storyDate(st),
          sort: st.happened_on ?? st.created_at,
          onPress: () =>
            router.push({ pathname: "/story/[id]", params: { id: st.id } }),
        };
      }),
      ...credits.map((c) => ({
        key: `credit-${c.match_id}`,
        image: c.image,
        title: c.title,
        with: `with ${c.with_name}`,
        when: formatRecordDate(c.date),
        sort: c.date,
        onPress: undefined,
      })),
    ].sort((a, b) => String(b.sort).localeCompare(String(a.sort)));

    return { work: made, projects: myPosts };
  }, [stories, credits, myPosts, router]);

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
        <ScreenTitle
          title="You"
          right={
            <Pressable
              hitSlop={12}
              onPress={() => router.push("/account/settings")}
              accessibilityLabel="Settings"
              style={styles.settingsBtn}
            >
              <SettingsIcon size={18} color={colors.brandText} />
            </Pressable>
          }
        />

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
            {profile.role && profile.role !== "other" ? (
              <Text style={styles.profileRole} numberOfLines={1}>{profile.role}</Text>
            ) : null}
            <IdentityLine founding={profile.founding} scene={profile.scene} handle={profile.handle} />
            <RatingLine trust={trust} />
            <Pressable
              onPress={() => router.push("/account/edit-profile")}
              hitSlop={12}
              style={styles.editLink}
            >
              <Text style={styles.sectionAction}>Edit profile</Text>
            </Pressable>
          </View>
        </View>

        {/* Profile: about you. Everyone sees exactly this on your page. */}
        <ProfileAbout
          profile={profile}
          emptyHint="Add what you do, what you're looking for, a bio, your Instagram and photos in Edit profile."
        />

        {/* One section. A credit, a story and an uploaded image were three
            sections split by where the row came from — match, story or
            upload — which is plumbing, not a distinction anyone makes about
            their own work. */}
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>Showcase</Text>
            <Pressable onPress={() => router.push("/story/new")} hitSlop={12}>
              <Text style={styles.sectionAction}>Add</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>
            Past work you made with people. It shows on Explore too, so others get ideas and find you.
          </Text>

          {work.length === 0 ? <Text style={styles.muted}>Nothing here yet.</Text> : null}

          {work.map((w) => (
            <Pressable
              key={w.key}
              onPress={w.onPress}
              disabled={!w.onPress}
              style={({ pressed }) => [styles.listRow, pressed && w.onPress && { opacity: 0.6 }]}
            >
              {w.image ? (
                /* Through sized(): this row thumb is 44x44pt, and the seeded
                   story heroes are stored 1200x1600, so the raw URL fetched
                   ~1.9 MP to draw 0.017 MP. The other screens already call
                   sized() here (profile/[userId].tsx:334) — this one was
                   missed. Supabase uploads still come back untouched; see
                   imageUrl.ts for why. */
                <Image source={{ uri: sized(w.image, 44, 44) }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <ImageIcon size={16} color={colors.iconFaint} strokeWidth={1.6} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {w.title}
                </Text>
                {w.with ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {w.with}
                  </Text>
                ) : null}
              </View>
              {w.when ? <Text style={styles.rowWhen}>{w.when}</Text> : null}
            </Pressable>
          ))}

        </View>

        {/* My projects */}
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>Projects</Text>
            <Pressable onPress={() => router.push("/post/new")} hitSlop={12}>
              <Text style={styles.sectionAction}>Post</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>What you&apos;re making now and who you&apos;re looking for.</Text>
          {projects.length === 0 ? (
            <Text style={styles.muted}>Nothing open.</Text>
          ) : (
            projects.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
                onPress={() => router.push({ pathname: "/post/[id]", params: { id: p.id } })}
                accessibilityHint="Shows the project the way other people see it"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {projectDates(p) ?? formatRecordDate(p.created_at)}
                    {projectRoles(p).length ? ` · ${projectRoles(p).slice(0, 3).join(", ")}` : ""}
                    {p.is_active ? "" : " · inactive"}
                  </Text>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => router.push({ pathname: "/post/edit/[id]", params: { id: p.id } })}
                  accessibilityLabel={`Edit ${p.title}`}
                >
                  <Pencil size={16} color={colors.iconFaint} />
                </Pressable>
              </Pressable>
            ))
          )}
        </View>

        <ProfileTrustSections
          trust={trust}
          onOpenPerson={(id) => id && router.push({ pathname: "/profile/[userId]", params: { userId: id } })}
        />

        {/* Account & safety, Events and Sign out used to end the page while
            the gear sat in the header: two homes for one thing. They are
            behind the gear. A founding code is the one quiet extra: it only
            adds the ✦ now that anyone can sign up, so it sits last and goes
            away once you have the mark. */}
        {profile.founding ? null : <FoundingCodeRow onRedeemed={load} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * "Have a founding code?" — one row, which opens into a field in place.
 * redeem_invite is awaited and its error shown as the server worded it
 * ("You've already used a code."), because those messages are the only way
 * someone learns why a code didn't take.
 */
function FoundingCodeRow({ onRedeemed }: { onRedeemed: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const redeem = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await redeemInvite(code);
    if (error || !data) {
      setBusy(false);
      setErr(error ?? "That code didn't go through.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // The reload brings back founding = true, which unmounts this row and
    // puts the ✦ in the header: that is the confirmation.
    await onRedeemed();
    setBusy(false);
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={[styles.block, styles.codeRow]}
        accessibilityRole="button"
      >
        <Text style={styles.sectionAction}>Have a founding code?</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.block}>
      <View style={styles.codeForm}>
        <Input
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="MEL-XXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          autoFocus
          returnKeyType="go"
          onSubmitEditing={redeem}
          accessibilityLabel="Founding code"
          containerStyle={{ flex: 1 }}
        />
        <Button title="Use" variant="primary" loading={busy} disabled={!code.trim()} onPress={redeem} />
      </View>
      {err ? <ErrorBanner message={err} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading:{ flex: 1, alignItems: "center", justifyContent: "center" },
  loadingError: { gap: 12, paddingHorizontal: 24 },
  /* One gutter, one rhythm. Sections are separated by space and a rule, not
     by nesting a white card inside a grey one. */
  scroll: { paddingHorizontal: GUTTER, gap: 0 },

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
  editLink: { alignSelf: "flex-start", marginTop: spacing.sm },

  /* A section: a rule, an eyebrow, then content directly on the ground. */
  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  blockFirst: { marginTop: 0 },
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeRow: { paddingBottom: spacing.sm },
  codeForm: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { ...typography.eyebrow, color: colors.textSecondary },
  sectionAction: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
  sectionCount: { ...typography.caption, color: colors.textTertiary },
  sectionHint: { ...typography.caption, color: colors.textTertiary, marginTop: -4 },

  /* Every list row in this screen is the same row. */
  listRow: {
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
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  muted: { ...typography.caption, color: colors.textSecondary },

});
