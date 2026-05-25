import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Star } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { REVIEW_TAGS, submitCollabReview } from "@/lib/reviews";

export default function ReviewScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const { matches } = useMatches();

  const match = useMemo(() => matches.find((m) => m.id === matchId), [matches, matchId]);
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!match || !userId) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Match not found</Text>
      </SafeAreaView>
    );
  }

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await submitCollabReview(
      match.id,
      userId,
      match.other_user_id,
      rating,
      tags,
      body
    );
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    Alert.alert("Review submitted", "It will show on their profile once they review you too.");
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={colors.brandText} />
        </Pressable>
        <Text style={styles.title}>Review {match.other_creator.name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          Hidden until they review you too — prevents retaliation.
        </Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)}>
              <Star
                size={32}
                color={n <= rating ? "#f59e0b" : colors.textFaint}
                fill={n <= rating ? "#f59e0b" : "transparent"}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.tags}>
          {REVIEW_TAGS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() =>
                  setTags((prev) =>
                    on ? prev.filter((t) => t !== tag) : prev.length < 2 ? [...prev, tag] : prev
                  )
                }
                style={[styles.tag, on && styles.tagOn]}
              >
                <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextArea
          value={body}
          onChangeText={setBody}
          placeholder="Optional note about the collab"
          numberOfLines={4}
        />

        <ErrorBanner message={error} />
        <Button title="Submit review" variant="primary" loading={busy} onPress={onSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.brandText, flex: 1 },
  scroll: { padding: 16, gap: 16 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  stars: { flexDirection: "row", justifyContent: "center", gap: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagOn: { backgroundColor: "#ede9fe", borderColor: colors.accent },
  tagText: { fontSize: 12, color: colors.textMuted },
  tagTextOn: { color: colors.accent, fontWeight: "600" },
});
