/* eslint-disable @typescript-eslint/no-require-imports -- Native-only modules must be loaded after the Expo Go guard. */
import { isRunningInExpoGo } from "expo";

/** Expo Go has no React Native Firebase native modules. Load them only in a native build. */
export function getNativePush() {
  if (isRunningInExpoGo()) return null;
  // Conditional require is intentional: a static import crashes Expo Go before a guard can run.
  const app =
    require("@react-native-firebase/app") as typeof import("@react-native-firebase/app");
  const api =
    require("@react-native-firebase/messaging") as typeof import("@react-native-firebase/messaging");
  return { api, messaging: api.getMessaging(app.getApp()) };
}
