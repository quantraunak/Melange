import { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { colors, fonts, spacing, typography } from "@/lib/theme";

const { width: W, height: H } = Dimensions.get("window");

/**
 * A photo, big. Tap any photo on a profile, a project or a piece of work and
 * it opens here, full screen on black, swipeable through the rest of the set.
 * The whole frame, uncropped: the grids crop to fit, this is where you see
 * what was actually shot.
 */
export function PhotoViewer({
  photos,
  index,
  onClose,
}: {
  photos: string[];
  /** Which photo to open on; null keeps the viewer closed. */
  index: number | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<string>>(null);
  const [current, setCurrent] = useState(index ?? 0);

  useEffect(() => {
    if (index != null) setCurrent(index);
  }, [index]);

  return (
    <Modal visible={index != null} transparent={false} animationType="fade" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <FlatList
          ref={list}
          data={photos}
          keyExtractor={(u, i) => `${i}-${u}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / W))}
          renderItem={({ item }) => (
            <Pressable style={styles.page} onPress={onClose} accessibilityLabel="Close photo">
              <Image source={{ uri: item }} style={styles.img} contentFit="contain" transition={120} />
            </Pressable>
          )}
        />
        <View style={[styles.top, { top: insets.top + spacing.sm }]}>
          <Text style={styles.count}>
            {photos.length > 1 ? `${current + 1} / ${photos.length}` : ""}
          </Text>
          <Pressable onPress={onClose} hitSlop={14} accessibilityLabel="Close" style={styles.close}>
            <X size={24} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  page: { width: W, height: H, alignItems: "center", justifyContent: "center" },
  img: { width: W, height: H },
  top: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  count: { ...typography.caption, fontFamily: fonts.semibold, color: colors.white },
  close: { padding: 4 },
});
