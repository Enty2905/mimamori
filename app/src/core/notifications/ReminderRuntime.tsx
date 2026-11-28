import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import {getNativeNotifications} from "./nativeNotifications";
import type {NotificationResponse} from "expo-notifications";
import { getNativePush } from "./nativePush";
import { useAuthStore } from "../auth/useAuthStore";
import { synchronizeConfirmations } from "../../features/medication/queries";
import {
  clearLocalReminders,
  registerPushToken,
  synchronizeReminders,
} from "./runtime";
import { handleReminderPush } from "./background";
const Notifications=getNativeNotifications();
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export function ReminderRuntime() {
  const owner = useAuthStore((state) => state.userId);
  const role = useAuthStore((state) => state.role);
  const router = useRouter();
  const previousOwner = useRef<number | null>(null);
  useEffect(() => {
    if (previousOwner.current !== null && previousOwner.current !== owner)
      void clearLocalReminders(previousOwner.current).catch(() => {});
    previousOwner.current = owner;
  }, [owner]);
  useEffect(() => {
    if(!Notifications){
      const sync=()=>{if(owner)void synchronizeConfirmations(owner).catch(()=>{});};
      sync();
      const state=AppState.addEventListener('change',value=>{if(value==='active')sync();});
      const timer=setInterval(sync,60_000);
      return ()=>{clearInterval(timer);state.remove();};
    }
    let live = true;
    let queued = false;
    const sync = async () => {
      if (!live || !owner || queued) return;
      queued = true;
      try {
        await synchronizeConfirmations(owner).catch(() => {});
        if (live && role === "ELDERLY") await synchronizeReminders();
        if (live) await registerPushToken();
      } finally {
        queued = false;
      }
    };
    void sync();
    const state = AppState.addEventListener("change", (value) => {
      if (value === "active") void sync();
    });
    const timer = setInterval(() => {
      void sync();
    }, 60_000);
    const routeData = (data: Record<string, unknown>) => {
      if (String(data.ownerId) !== String(useAuthStore.getState().userId))
        return;
      if (typeof data.doseId === "string" && /^\d+$/.test(data.doseId))
        router.push({ pathname: "/dose/[id]", params: { id: data.doseId } });
      else if (data.alertId) router.push("/alerts");
    };
    const route = (response: NotificationResponse) =>
      routeData(response.notification.request.content.data || {});
    const notifications =
      Notifications.addNotificationResponseReceivedListener(route);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (live && response) route(response);
      })
      .catch(() => {});
    let offToken = () => {};
    let offMessage = () => {};
    let offOpened = () => {};
    try {
      const push = getNativePush();
      if (push) {
        const { api, messaging } = push;
        offToken = api.onTokenRefresh(messaging, () => {
          void registerPushToken();
        });
        offMessage = api.onMessage(messaging, (message) =>
          handleReminderPush(message.data),
        );
        offOpened = api.onNotificationOpenedApp(messaging, (message) => {
          if (live) routeData(message.data || {});
        });
        void api
          .getInitialNotification(messaging)
          .then((message) => {
            if (live && message) routeData(message.data || {});
          })
          .catch(() => {});
      }
    } catch {
      /* No native provider configured. */
    }
    return () => {
      live = false;
      clearInterval(timer);
      state.remove();
      notifications.remove();
      offToken();
      offMessage();
      offOpened();
    };
  }, [owner, role, router]);
  return null;
}
