import "react-native-gesture-handler";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

import { AuthProvider, useAuth } from "@/lib/auth";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    SplashScreen.hideAsync().catch(() => {});

    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) {
      router.replace("/(auth)/welcome");
    } else if (session && inAuth) {
      router.replace("/(tabs)/connect");
    }
  }, [loading, session, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#f3f4f6" } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[matchId]" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="post/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="post/edit/[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="post/[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="report/[kind]/[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="account/blocked" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="account/delete" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
