import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import { AuthProvider, useAuth } from "@/lib/auth";
import { MatchesProvider } from "@/lib/matches";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || !fontsReady) return;

    // Held until the typeface is resident: the splash is a better first frame
    // than a flash of the system font reflowing into Fraunces.
    SplashScreen.hideAsync().catch(() => {});

    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) {
      router.replace("/(auth)/welcome");
    } else if (session && inAuth) {
      router.replace("/(tabs)/connect");
    }
  }, [loading, fontsReady, session, segments, router]);

  return (
    <MatchesProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[matchId]" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="post/new" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="post/edit/[id]" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="post/[id]" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="story/new" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="story/[id]" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="profile/[userId]" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="events/index" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="message/[userId]" options={{ presentation: "modal" }} />
        <Stack.Screen name="report/[kind]/[id]" options={{ presentation: "modal" }} />
        <Stack.Screen name="account/blocked" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="account/edit-profile" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="account/delete" options={{ presentation: "modal" }} />
      </Stack>
    </MatchesProvider>
  );
}

export default function RootLayout() {
  // Fraunces for display, Inter for everything else. Three weights of Inter
  // plus one of Fraunces is the whole typographic palette — see theme.ts.
  const [fontsReady] = useFonts({
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Dark glyphs suit five of seven screens; the two full-bleed photo
            screens put a white scrim under the status bar instead. */}
        <StatusBar style="dark" />
        <AuthProvider>
          <Gate fontsReady={fontsReady} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
