import * as Notifications from "expo-notifications";
import { handleReminderPush } from "./background";
import { sessionTokens } from "../storage/sessionTokens";
import { careApi } from "../api/careApi";
import { ApiError } from "../api/client";
import { cachedDoses, queuedConfirmations } from "../storage/medicationStore";
import { Dose } from "../api/contracts";
jest.mock("expo",()=>({isRunningInExpoGo:()=>false}));
jest.mock("@react-native-firebase/app", () => ({ getApp: () => ({}) }));
jest.mock("@react-native-firebase/messaging", () => ({
  getMessaging: () => ({}),
  setBackgroundMessageHandler: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  getPresentedNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));
jest.mock("../storage/medicationStore", () => ({
  cachedDoses: jest.fn(),
  queuedConfirmations: jest.fn(async () => []),
}));
const data = {
  ownerId: "1",
  type: "REMINDER",
  doseId: "3",
  occurrenceId: "synthetic-dose",
};
const dose: Dose = {
  id: 3,
  occurrenceId: data.occurrenceId,
  medicationId: 1,
  medicationName: "Synthetic health text",
  dosage: "Synthetic",
  scheduledTime: "2026-11-09T08:00:00",
  scheduledAt: new Date(Date.now() + 60000).toISOString(),
  timeZone: "Asia/Tokyo",
  status: "PENDING",
  canceled: false,
};
beforeEach(async () => {
  jest.clearAllMocks();
  await sessionTokens.save({
    accessToken: "synthetic",
    refreshToken: "synthetic-refresh",
    userId: 1,
    role: "ELDERLY",
  });
  jest.mocked(queuedConfirmations).mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());
test("another account cannot display or fetch the reminder", async () => {
  const api = jest.spyOn(careApi, "dose");
  await handleReminderPush({ ...data, ownerId: "2" });
  expect(api).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
test("authorization rejection never falls back to cached health data", async () => {
  jest.spyOn(careApi, "dose").mockRejectedValue(new ApiError(403, "FORBIDDEN"));
  await handleReminderPush(data);
  expect(cachedDoses).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
test("offline reminder uses an owned cached schedule and routing-only notification", async () => {
  jest
    .spyOn(careApi, "dose")
    .mockRejectedValue(new ApiError(0, "NETWORK_UNAVAILABLE"));
  jest
    .mocked(cachedDoses)
    .mockResolvedValue({ items: [dose], updatedAt: new Date().toISOString() });
  await handleReminderPush(data);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      identifier: "mimamori-dose-" + data.occurrenceId,
      content: expect.objectContaining({
        data: { ownerId: "1", doseId: "3", occurrenceId: data.occurrenceId },
      }),
    }),
  );
  expect(
    JSON.stringify(
      jest.mocked(Notifications.scheduleNotificationAsync).mock.calls,
    ),
  ).not.toContain(dose.medicationName);
});
test("already confirmed occurrences never display a reminder", async () => {
  jest.spyOn(careApi, "dose").mockResolvedValue({ ...dose, status: "TAKEN" });
  await handleReminderPush(data);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
