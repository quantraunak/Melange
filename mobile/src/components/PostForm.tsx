import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Field } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii } from "@/lib/theme";
import { uploadFile } from "@/lib/db";

const MAX_IMAGES = 5;

export type PostFormValues = {
  title: string;
  description: string;
  lookingFor: string;
  location: string;
  compensation: string;
  mediaUrls: string[];
};

type Asset =
  | { kind: "remote"; url: string }
  | { kind: "local"; uri: string; mimeType?: string };

export function PostForm({
  userId,
  initial,
  submitLabel,
  onSubmit,
  busy,
  externalError,
}: {
  userId: string;
  initial?: Partial<PostFormValues>;
  submitLabel: string;
  busy?: boolean;
  externalError?: string | null;
  onSubmit: (values: PostFormValues) => Promise<{ error: string | null }>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [lookingFor, setLookingFor] = useState(initial?.lookingFor ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [compensation, setCompensation] = useState(initial?.compensation ?? "");

  const [assets, setAssets] = useState<Asset[]>(
    (initial?.mediaUrls ?? []).map((url) => ({ kind: "remote", url }))
  );

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const addImage = async () => {
    if (assets.length >= MAX_IMAGES) {
      Alert.alert("Limit reached", `You can add up to ${MAX_IMAGES} images per post.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo permission denied", "Enable photo access in Settings to add images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - assets.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    const newAssets: Asset[] = result.assets.map((a) => ({
      kind: "local",
      uri: a.uri,
      mimeType: a.mimeType,
    }));
    setAssets((prev) => [...prev, ...newAssets].slice(0, MAX_IMAGES));
  };

  const removeAsset = (idx: number) => {
    setAssets((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!title.trim()) return setError("Title is required.");
    if (!description.trim()) return setError("Description is required.");
    setError(null);
    setUploading(true);

    // Upload any local images, keep remote URLs.
    const finalUrls: string[] = [];
    for (const a of assets) {
      if (a.kind === "remote") {
        finalUrls.push(a.url);
      } else {
        const { url, error: upErr } = await uploadFile(
          userId,
          "posts",
          a.uri,
          a.mimeType || "image/jpeg"
        );
        if (upErr || !url) {
          setUploading(false);
          setError(upErr || "Image upload failed.");
          return;
        }
        finalUrls.push(url);
      }
    }
    setUploading(false);

    const lookingForArr = lookingFor.split(",").map((s) => s.trim()).filter(Boolean);

    const { error: submitErr } = await onSubmit({
      title: title.trim(),
      description: description.trim(),
      lookingFor: lookingForArr.join(", "),
      location: location.trim(),
      compensation: compensation.trim(),
      mediaUrls: finalUrls,
    });

    if (submitErr) setError(submitErr);
  };

  const showSpinner = uploading || busy;

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Field label="Title">
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Looking for a photographer"
        />
      </Field>

      <Field label="Description">
        <TextArea
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the collaboration, style, timeline."
          numberOfLines={5}
        />
      </Field>

      <Field label="Looking for" hint="Comma-separated">
        <Input
          value={lookingFor}
          onChangeText={setLookingFor}
          placeholder="e.g. Photographer, Model, MUA"
        />
      </Field>

      <Field label="Location">
        <Input
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. New York, NY"
        />
      </Field>

      <Field label="Compensation">
        <Input
          value={compensation}
          onChangeText={setCompensation}
          placeholder="e.g. TFP, $200/hr, Revenue share"
        />
      </Field>

      <Field label={`Images (up to ${MAX_IMAGES})`}>
        <View style={styles.images}>
          {assets.map((a, idx) => (
            <View key={`${idx}-${a.kind === "remote" ? a.url : a.uri}`} style={styles.imageThumb}>
              <Image
                source={{ uri: a.kind === "remote" ? a.url : a.uri }}
                style={{ width: "100%", height: "100%" }}
              />
              <Pressable style={styles.imageRemove} onPress={() => removeAsset(idx)} hitSlop={6}>
                <X size={14} color={colors.white} />
              </Pressable>
            </View>
          ))}
          {assets.length < MAX_IMAGES ? (
            <Pressable style={styles.imageAdd} onPress={addImage}>
              <ImagePlus size={22} color={colors.textSubtle} />
              <Text style={styles.imageAddText}>Add</Text>
            </Pressable>
          ) : null}
        </View>
      </Field>

      <ErrorBanner message={error || externalError || null} />

      <Button
        title={showSpinner ? "Saving..." : submitLabel}
        variant="primary"
        size="lg"
        loading={showSpinner}
        onPress={submit}
      />
      {uploading ? (
        <View style={styles.uploadHint}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={styles.uploadHintText}>Uploading images…</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  images: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageThumb: {
    width: 92,
    height: 92,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
    position: "relative",
  },
  imageRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  imageAdd: {
    width: 92,
    height: 92,
    borderRadius: radii.md,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  imageAddText: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "600",
  },
  uploadHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  uploadHintText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
