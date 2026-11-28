import { create } from "zustand";
import {getNativeNotifications} from "./nativeNotifications";
import * as Crypto from "expo-crypto";
import Storage from "expo-sqlite/kv-store";
import { Platform } from "react-native";
import { getNativePush } from "./nativePush";
import { careApi } from "../api/careApi";
import { ApiError } from "../api/client";
import { sessionTokens } from "../storage/sessionTokens";
import { cachedDoses, cacheDoses } from "../storage/medicationStore";
import { LocalReminder, planReminders, reminderId } from "./reconcile";
import i18n from "../localization/i18n";
let synchronization: Promise<void> | null = null;
export async function deviceId() {
  let id = await Storage.getItem("mimamori.deviceId");
  if (!id) {
    id = Crypto.randomUUID();
    await Storage.setItem("mimamori.deviceId", id);
  }
  return id;
}
export const useReminderStatus = create<{
  status: "off" | "ready" | "limited";
  enable: () => Promise<void>;
}>((set) => ({
  status: "off",
  enable: async () => {
    const Notifications=getNativeNotifications();
    if(!Notifications){set({status:"limited"});return;}
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        set({ status: "off" });
        return;
      }
      const session = await sessionTokens.read();
      const registered = await registerPushToken();
      if (session?.role === "ELDERLY") await synchronizeReminders();
      else set({ status: registered ? "ready" : "limited" });
    } catch {
      set({ status: "limited" });
    }
  },
}));
export async function clearLocalReminders(owner?: number) {
  const Notifications=getNativeNotifications();if(!Notifications)return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(
        (item) =>
          item.identifier.startsWith("mimamori-dose-") &&
          (owner === undefined ||
            String(item.content.data?.ownerId) === String(owner)),
      )
      .map((item) =>
        Notifications.cancelScheduledNotificationAsync(item.identifier),
      ),
  );
  useReminderStatus.setState({ status: "off" });
}
async function publishMirrors(owner: number) {
  const Notifications=getNativeNotifications();if(!Notifications)return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ids = scheduled
      .filter(
        (item) =>
          item.identifier.startsWith("mimamori-dose-") &&
          String(item.content.data?.ownerId) === String(owner),
      )
      .map((item) => String(item.content.data?.occurrenceId || ""))
      .filter(Boolean);
    await careApi.mirrors(await deviceId(), ids.slice(0, 48), owner);
  } catch {
    /* Remote fallback remains available without a mirror receipt. */
  }
}
export async function synchronizeReminders() {
  if (synchronization) {
    await synchronization;
    return;
  }
  synchronization = (async () => {
    const Notifications=getNativeNotifications();if(!Notifications){useReminderStatus.setState({status:"limited"});return;}
    const session = await sessionTokens.read();
    if (!session || session.role !== "ELDERLY") return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      await clearLocalReminders(session.userId);
      await publishMirrors(session.userId);
      return;
    }
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("medication", {
        name: i18n.t("medication"),
        importance: Notifications.AndroidImportance.HIGH,
      });
    let doses;
    try {
      doses = await careApi.upcoming();
      await cacheDoses(session.userId, "upcoming", doses);
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        (error.status !== 0 && error.status < 500)
      ) {
        await clearLocalReminders(session.userId);
        await publishMirrors(session.userId);
        return;
      }
      doses = (await cachedDoses(session.userId, "upcoming"))?.items;
      if (!doses) {
        useReminderStatus.setState({ status: "limited" });
        return;
      }
    }
    if ((await sessionTokens.read())?.userId !== session.userId) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing: LocalReminder[] = scheduled
      .filter((item) => item.identifier.startsWith("mimamori-dose-"))
      .map((item) => ({
        id: item.identifier,
        ownerId: String(item.content.data?.ownerId || ""),
        occurrenceId: String(item.content.data?.occurrenceId || ""),
        scheduledAt: String(item.content.data?.scheduledAt || ""),
      }));
    const plan = planReminders(session.userId, doses, existing, Date.now());
    for (const id of plan.cancel)
      await Notifications.cancelScheduledNotificationAsync(id);
    let limited = plan.limited;
    for (const dose of plan.schedule) {
      if ((await sessionTokens.read())?.userId !== session.userId) return;
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: reminderId(dose.occurrenceId),
          content: {
            title: i18n.t("medication"),
            body: i18n.t("viewSchedule"),
            data: {
              ownerId: String(session.userId),
              doseId: String(dose.id),
              occurrenceId: dose.occurrenceId,
              scheduledAt: dose.scheduledAt,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(dose.scheduledAt),
            channelId: "medication",
          },
        });
      } catch {
        limited = true;
      }
    }
    if ((await sessionTokens.read())?.userId !== session.userId) {
      await clearLocalReminders(session.userId);
      return;
    }
    useReminderStatus.setState({ status: limited ? "limited" : "ready" });
    await publishMirrors(session.userId);
  })()
    .catch(() => {
      useReminderStatus.setState({ status: "limited" });
    })
    .finally(() => {
      synchronization = null;
    });
  return synchronization;
}
export async function registerPushToken() {
  const Notifications=getNativeNotifications();if(!Notifications)return false;
  const session = await sessionTokens.read();
  if (!session) return false;
  try {
    const push = getNativePush();
    if (!push) return false;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return false;
    const token = await push.api.getToken(push.messaging);
    if ((await sessionTokens.read())?.userId !== session.userId) return false;
    await careApi.registerDevice(await deviceId(), token, Platform.OS);
    await publishMirrors(session.userId);
    return true;
  } catch {
    return false;
  }
}
