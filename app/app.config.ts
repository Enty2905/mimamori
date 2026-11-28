import type { ConfigContext, ExpoConfig } from "expo/config";
import { existsSync } from "node:fs";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Mimamori AI",
  slug: "mimamori",
  version: "0.1.0",
  orientation: "portrait",
  platforms: ["android", "ios"],
  scheme: "mimamori",
  userInterfaceStyle: "light",
  icon: "./assets/images/icon.png",
  ios: {
    bundleIdentifier: "com.mimamori.app",
    icon: "./assets/expo.icon",
    supportsTablet: true,
    googleServicesFile: existsSync("./GoogleService-Info.plist")
      ? "./GoogleService-Info.plist"
      : undefined,
  },
  android: {
    package: "com.mimamori.app",
    allowBackup: false,
    googleServicesFile: existsSync("./google-services.json")
      ? "./google-services.json"
      : undefined,
    permissions: [
      "POST_NOTIFICATIONS",
      "SCHEDULE_EXACT_ALARM",
      "RECEIVE_BOOT_COMPLETED",
    ],
    adaptiveIcon: {
      backgroundColor: "#F8F5EF",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "./plugins/with-short-cmake-paths.cjs",
    "expo-router",
    "expo-dev-client",
    "expo-font",
    "expo-secure-store",
    "expo-sqlite",
    "expo-status-bar",
    ["expo-build-properties", {
      ios: { useFrameworks: "static" },
      android: { usesCleartextTraffic: process.env.MIMAMORI_LOCAL_BUILD === '1' },
    }],
    [
      "expo-notifications",
      {
        defaultChannel: "medication",
        enableBackgroundRemoteNotifications: true,
      },
    ],
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
    "@react-native-firebase/crashlytics",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F8F5EF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
