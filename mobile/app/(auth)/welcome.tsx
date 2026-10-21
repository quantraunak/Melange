import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { colors, fonts, radii, typography } from "@/lib/theme";

const { width } = Dimensions.get("window");

type Slide = {
  key: string;
  /** Small-caps step label, set like a flyer. */
  step: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: "intro",
    step: "Melange",
    title: "Find people to make things with.",
    body:
      "Photographers, models, musicians, filmmakers and dancers in your city, finding each other through the work.",
  },
  {
    key: "swipe",
    step: "01 · Projects",
    title: "Post a project. Swipe to join one.",
    body:
      "Say what you're making and who you need on it. Swipe right on the ones you want in on. Nobody's inbox fills up.",
  },
  {
    key: "match",
    step: "02 · Hands up",
    title: "Hands up first, then you talk.",
    body:
      "See who liked your project or hearted your work, and write back. Cold messages need a real profile and are capped at five a day.",
  },
  {
    key: "ready",
    step: "03 · Showcase",
    title: "Show what you made.",
    body:
      "Post the finished shoot and credit everyone who made it. Sign up takes a minute.",
  },
];

export default function Welcome() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setPage(Math.round(x / width));
  };

  const next = () => {
    if (page < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: page + 1, animated: true });
    } else {
      router.push("/(auth)/signup");
    }
  };

  const renderItem: ListRenderItem<Slide> = ({ item }) => (
    <View style={[styles.slide, { width }]}>
      <Text style={styles.step}>{item.step}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Logo size={32} />
        <View style={{ flex: 1 }} />
        <Text style={styles.skip} onPress={() => router.push("/(auth)/login")}>
          Sign in
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={next}
        >
          <Text style={{ ...typography.headline, color: colors.onBrand }}>
            {page === SLIDES.length - 1 ? "Get started" : "Next"}
          </Text>
        </Button>
        <Text style={styles.foot} onPress={() => router.push("/(auth)/login")}>
          Already have an account? <Text style={{ fontFamily: fonts.semibold }}>Sign in</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  skip: { ...typography.bodyStrong, color: colors.brandText },
  slide: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  step: { ...typography.eyebrow, marginBottom: 16 },
  title: { ...typography.display1, marginBottom: 14 },
  body: { ...typography.body, color: colors.textSecondary, maxWidth: 340 },
  dots: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 16,
    height: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.lineStrong,
  },
  dotActive: {
    backgroundColor: colors.text,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  foot: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
});
