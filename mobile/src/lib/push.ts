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

export type PushPermission = "granted" | "denied" | "undetermined";

/** What iOS currently thinks, without asking the user anything. */
export async function getPushPermission(): Promise<PushPermission> {
  try {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return "denied";
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === "granted") return "granted";
    if (status === "undetermined" || canAskAgain) return "undetermined";
    return "denied";
  } catch {
    return "denied";
  }
}

/**
 * Asks for push permission and uploads the Expo push token to Supabase.
 * Returns the token string (or null if denied / unsupported / simulator).
 *
 * `prompt` gates the one irreversible part. iOS lets an app raise the system
 * notification dialog exactly once — a "Don't Allow" there is permanent and
 * takes match and message notifications with it. So the app-wide bootstrap
 * calls this with prompt:false (register silently if permission already
 * exists, otherwise do nothing), and only a deliberate tap on the priming
 * card, where the person has just been told what the notifications are for,
 * passes prompt:true.
 */
export async function registerForPushAsync(
  userId: string,
  { prompt = false }: { prompt?: boolean } = {}
): Promise<string | null> {
  try {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") {
      if (!prompt) return null;
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
