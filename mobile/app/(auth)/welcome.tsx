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
import { colors } from "@/lib/theme";

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
    icon: <Logo size={96} stroke={colors.accent} />,
    title: "Welcome to Melange",
    body:
      "The home for creative collaborations — photographers, models, MUAs, stylists, and designers finding each other.",
  },
  {
    key: "swipe",
    icon: <Sparkles size={72} color="#fde68a" />,
    title: "Post & Swipe",
    body:
      "Share what you're working on. Swipe through other creatives' projects to find the right people for yours.",
  },
  {
    key: "match",
    icon: <Heart size={72} color="#fda4af" />,
    title: "Match & Message",
    body:
      "When two people like each other's posts, you match instantly. Chat in realtime to plan the collaboration.",
  },
  {
    key: "ready",
    icon: <MessageCircle size={72} color="#a5b4fc" />,
    title: "Let's create",
    body:
      "Sign up in under a minute. You can always edit your profile, projects, and notification preferences later.",
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
          style={{ backgroundColor: colors.white }}
          onPress={next}
        >
          <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 16 }}>
            {page === SLIDES.length - 1 ? "Get started" : "Next"}
          </Text>
        </Button>
        <Text style={styles.foot} onPress={() => router.push("/(auth)/login")}>
          Already have an account? <Text style={{ fontWeight: "700" }}>Sign in</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  topBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skip: {
    color: "#bfdbfe",
    fontWeight: "600",
    fontSize: 14,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    marginBottom: 32,
  },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  body: {
    color: "#dbeafe",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.white,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  foot: {
    color: "#bfdbfe",
    fontSize: 13,
    textAlign: "center",
  },
});
