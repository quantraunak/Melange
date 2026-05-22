import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { registerPushToken } from "./db";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Asks for push permission and uploads the Expo push token to Supabase.
 * Returns the token string (or null if denied / unsupported / simulator).
 */
export async function registerForPushAsync(userId: string): Promise<string | null> {
  try {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    const tokenRes = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenRes.data;
    if (token) {
      await registerPushToken(userId, token, Platform.OS as "ios" | "android");
    }
    return token;
  } catch {
    return null;
  }
}
