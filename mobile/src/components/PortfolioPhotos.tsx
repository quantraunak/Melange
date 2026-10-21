import { useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Image, Pressable, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Plus, X } from "lucide-react-native";

import { colors, GUTTER, radii, spacing } from "@/lib/theme";
import { PORTFOLIO_MAX_IMAGES, updatePortfolio, uploadFile } from "@/lib/db";

/** Three columns inside the screen gutter. */
const TILE = (Dimensions.get("window").width - GUTTER * 2 - spacing.sm * 2) / 3;

/**
 * The profile photo grid: add from the library, tap a photo to remove it.
 *
 * Photos are files, so they save as they're picked rather than on a Save
 * button. Shared by Edit profile and the after-signup photos step, so the
 * two can't drift into different upload rules.
 *
 * `photos` is the list as the server has it; `onChange` is called only after
 * profiles.portfolio_urls has been written, so the grid never shows a photo
 * the profile doesn't actually have.
 */
export function PortfolioPhotos({
  userId,
  photos,
  onChange,
  onError,
  emptySlots = 1,
}: {
  userId: string;
  photos: string[];
  onChange: (next: string[]) => void;
  onError: (message: string | null) => void;
  /** How many empty add tiles to show: 3 on the signup step reads as "three". */
  emptySlots?: number;
}) {
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (busy) return;
    if (photos.length >= PORTFOLIO_MAX_IMAGES) {
      Alert.alert("Photos full", `Up to ${PORTFOLIO_MAX_IMAGES} photos.`);
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
      selectionLimit: PORTFOLIO_MAX_IMAGES - photos.length,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;

    setBusy(true);
    onError(null);
    const uploaded: string[] = [];
    for (const asset of result.assets) {
      const { url, error } = await uploadFile(userId, "posts", asset.uri, asset.mimeType || "image/jpeg", {
        width: asset.width,
        height: asset.height,
      });
      if (error || !url) {
        onError(error || "Upload failed.");
        break;
      }
      uploaded.push(url);
    }
    // Whatever did upload is kept, even if a later one failed.
    if (uploaded.length) {
      const next = [...photos, ...uploaded].slice(0, PORTFOLIO_MAX_IMAGES);
      const { error } = await updatePortfolio(userId, next);
      if (error) onError(error);
      else onChange(next);
    }
    setBusy(false);
  };

  const remove = (idx: number) => {
    Alert.alert("Remove photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const next = photos.filter((_, i) => i !== idx);
          setBusy(true);
          const { error } = await updatePortfolio(userId, next);
          setBusy(false);
          if (error) onError(error);
          else onChange(next);
        },
      },
    ]);
  };

  const room = PORTFOLIO_MAX_IMAGES - photos.length;
  const addTiles = Math.min(room, Math.max(1, emptySlots - photos.length));

  return (
    <View style={styles.grid}>
      {photos.map((url, idx) => (
        <Pressable
          key={`${url}-${idx}`}
          style={styles.tile}
          onPress={() => remove(idx)}
          disabled={busy}
          accessibilityLabel="Remove photo"
        >
          <Image source={{ uri: url }} style={styles.tileImg} />
          <View style={styles.tileRemove}>
            <X size={12} color={colors.white} />
          </View>
        </Pressable>
      ))}
      {Array.from({ length: room > 0 ? addTiles : 0 }, (_, i) => (
        <Pressable
          key={`add-${i}`}
          style={[styles.tile, styles.tileAdd]}
          onPress={add}
          disabled={busy}
          accessibilityLabel="Add photos"
        >
          {busy && i === 0 ? (
            <ActivityIndicator color={colors.textTertiary} />
          ) : (
            <Plus size={22} color={colors.textTertiary} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: TILE,
    aspectRatio: 1,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  tileImg: { width: "100%", height: "100%" },
  tileAdd: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  tileRemove: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
});
