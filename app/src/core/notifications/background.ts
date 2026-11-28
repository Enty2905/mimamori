import { getNativePush } from "./nativePush";
import {getNativeNotifications} from "./nativeNotifications";
import { sessionTokens } from "../storage/sessionTokens";
import { reminderId } from "./reconcile";
import i18n from "../localization/i18n";
import { careApi } from "../api/careApi";
import { ApiError } from "../api/client";
import { cachedDoses, queuedConfirmations } from "../storage/medicationStore";
export async function handleReminderPush(
  data: Record<string, string | object> | undefined,
) {
  const Notifications=getNativeNotifications();if(!Notifications)return;
  const session = await sessionTokens.read();
  if (
    !session ||
    data?.ownerId !== String(session.userId) ||
    data?.type !== "REMINDER" ||
    typeof data.occurrenceId !== "string" ||
    typeof data.doseId !== "string"
  )
    return;
  if (!/^\d+$/.test(data.doseId) || !Number.isSafeInteger(Number(data.doseId)))
    return;
  if (
    (await queuedConfirmations(session.userId)).some(
      (item) => item.occurrence_id === data.occurrenceId,
    )
  )
    return;
  let dose;
  try {
    dose = await careApi.dose(Number(data.doseId));
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      (error.status !== 0 && error.status < 500)
    )
      return;
    dose = (await cachedDoses(session.userId, "upcoming"))?.items.find(
      (item) => item.occurrenceId === data.occurrenceId,
    );
  }
  if (
    !dose ||
    dose.canceled ||
    dose.status !== "PENDING" ||
    dose.occurrenceId !== data.occurrenceId ||
    Date.parse(dose.scheduledAt) + 7200000 < Date.now() ||
    (await sessionTokens.read())?.userId !== session.userId
  )
    return;
  const id = reminderId(data.occurrenceId);
  const presented = await Notifications.getPresentedNotificationsAsync();
  if (presented.some((item) => item.request.identifier === id)) return;
  // A remote reminder and its local mirror share one stable OS notification identity.
  await Notifications.cancelScheduledNotificationAsync(id);
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: i18n.t("medication"),
      body: i18n.t("viewSchedule"),
      data: {
        ownerId: data.ownerId,
        doseId: data.doseId,
        occurrenceId: data.occurrenceId,
      },
    },
    trigger: null,
  });
}
try {
  const push = getNativePush();
  if (push)
    push.api.setBackgroundMessageHandler(push.messaging, (message) =>
      handleReminderPush(message.data),
    );
} catch {
  /* Native Firebase configuration is optional for local reminders. */
}
