import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import { useRouter } from "expo-router";
import {
  Camera,
  ChevronRight,
  LogOut,
  Pencil,
  ShieldOff,
  Trash2,
  UserX,
} from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import {
  getMyPosts,
  getProfile,
  updateProfile,
  uploadFile,
  type CollabPost,
  type Profile,
} from "@/lib/db";

export default function ProfileScreen() {
  const router = useRouter();
  const { userId, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myPosts, setMyPosts] = useState<CollabPost[]>([]);
  const [form, setForm] = useState({
    name: "",
    role: "",
    bio: "",
    currentProject: "",
    skills: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: profileData }, { data: postsData }] = await Promise.all([
      getProfile(userId),
      getMyPosts(userId),
    ]);
    if (profileData) {
      setProfile(profileData);
      setForm({
        name: profileData.name || "",
        role: profileData.role || "",
        bio: profileData.bio || "",
        currentProject: profileData.current_project || "",
        skills: profileData.skills?.join(", ") || "",
      });
    }
    setMyPosts(postsData || []);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const skillsArr = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const { error: err } = await updateProfile(userId, {
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      bio: form.bio.trim() || undefined,
      current_project: form.currentProject.trim() || undefined,
      skills: skillsArr.length ? skillsArr : undefined,
    });
    setSaving(false);
    if (err) setError(err);
    else {
      setSavedMsg("Profile saved.");
      await load();
      setTimeout(() => setSavedMsg(null), 2000);
    }
  };

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
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
            <Text style={styles.profileName}>{profile.name}</Text>
            {profile.role ? <Text style={styles.profileRole}>{profile.role}</Text> : null}
            <Text style={styles.profileHint}>Tap to change avatar</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.section}>
          <Field label="Name">
            <Input value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
          </Field>
          <Field label="Role">
            <Input
              value={form.role}
              onChangeText={(t) => setForm({ ...form, role: t })}
              placeholder="e.g. Photographer"
            />
          </Field>
          <Field label="Skills" hint="Comma-separated">
            <Input
              value={form.skills}
              onChangeText={(t) => setForm({ ...form, skills: t })}
              placeholder="e.g. Portrait, Lighting, Posing"
            />
          </Field>
          <Field label="Bio">
            <TextArea
              value={form.bio}
              onChangeText={(t) => setForm({ ...form, bio: t })}
              numberOfLines={4}
              placeholder="A short bio about your work."
            />
          </Field>
          <Field label="Current project">
            <Input
              value={form.currentProject}
              onChangeText={(t) => setForm({ ...form, currentProject: t })}
              placeholder="What you're working on right now"
            />
          </Field>

          <ErrorBanner message={error} />
          {savedMsg ? (
            <View style={styles.success}>
              <Text style={styles.successText}>{savedMsg}</Text>
            </View>
          ) : null}

          <Button title="Save profile" variant="primary" loading={saving} onPress={onSave} />
        </View>

        {/* My Posts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your posts</Text>
          {myPosts.length === 0 ? (
            <Text style={styles.muted}>You haven't created a post yet.</Text>
          ) : (
            myPosts.map((p) => (
              <Pressable
                key={p.id}
                style={styles.postRow}
                onPress={() =>
                  router.push({ pathname: "/post/edit/[id]", params: { id: p.id } })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.postTitle} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text style={styles.postMeta} numberOfLines={1}>
                    {new Date(p.created_at).toLocaleDateString()}
                    {p.is_active ? "" : " · inactive"}
                  </Text>
                </View>
                <Pencil size={16} color={colors.textSubtle} />
              </Pressable>
            ))
          )}
        </View>

        {/* Account & safety */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account & safety</Text>

          <Pressable style={styles.linkRow} onPress={() => router.push("/account/blocked")}>
            <ShieldOff size={18} color={colors.textMuted} />
            <Text style={styles.linkRowText}>Blocked users</Text>
            <ChevronRight size={16} color={colors.textSubtle} />
          </Pressable>

          <Pressable style={styles.linkRow} onPress={onSignOut}>
            <LogOut size={18} color={colors.textMuted} />
            <Text style={styles.linkRowText}>Sign out</Text>
            <ChevronRight size={16} color={colors.textSubtle} />
          </Pressable>

          <Pressable
            style={[styles.linkRow, { borderColor: "#fecaca" }]}
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
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  avatarBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarWrap: { position: "relative" },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.card,
  },
  profileName: { fontSize: 18, fontWeight: "800", color: colors.text },
  profileRole: { fontSize: 13, color: colors.textMuted },
  profileHint: { fontSize: 11, color: colors.textSubtle, marginTop: 4 },

  section: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  muted: { color: colors.textSubtle, fontSize: 13 },
  success: {
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  successText: { color: "#15803d", fontSize: 13, fontWeight: "600" },

  postRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  postTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  postMeta: { color: colors.textSubtle, fontSize: 11, marginTop: 2 },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  linkRowText: { flex: 1, color: colors.text, fontWeight: "600", fontSize: 14 },
});
