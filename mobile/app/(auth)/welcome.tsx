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
import { Heart, MessageCircle, Sparkles } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { colors, fonts, radii, typography } from "@/lib/theme";

const { width } = Dimensions.get("window");

type Slide = {
  key: string;
  icon: React.ReactNode;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: "intro",
    icon: <Logo size={96} />,
    title: "Find your next collaboration",
    body:
      "Photographers, models, musicians, filmmakers and dancers, matched only when you both say yes.",
  },
  {
    key: "swipe",
    icon: <Sparkles size={72} color={colors.accent} />,
    title: "Post a project. Swipe to join.",
    body:
      "Share what you're making and who you'd love on it. Swipe right on the ones you want in on. Nobody's inbox fills up.",
  },
  {
    key: "match",
    icon: <Heart size={72} color={colors.accentInk} />,
    title: "Hands up, then you talk",
    body:
      "See who liked your project or hearted your work, and write back. Cold messages need a real profile and are capped at five a day.",
  },
  {
    key: "ready",
    icon: <MessageCircle size={72} color={colors.iconFaint} />,
    title: "Credits that follow you",
    body:
      "Every collab you do through Melange becomes a credit on your profile. Sign up takes a minute.",
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
      <View style={styles.iconWrap}>{item.icon}</View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skip: { ...typography.bodyStrong, color: colors.brandText },
  slide: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    marginBottom: 32,
  },
  title: { ...typography.display1, color: colors.brand, textAlign: "center", marginBottom: 14 },
  body: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.lineStrong,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.brandText,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  foot: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
});
