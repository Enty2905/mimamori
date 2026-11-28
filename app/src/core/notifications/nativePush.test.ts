import { isRunningInExpoGo } from "expo";
import { getNativePush } from "./nativePush";

const mockLoadApp = jest.fn();
const mockLoadMessaging = jest.fn();
const mockApp = {};
const mockMessaging = {};
jest.mock("expo", () => ({ isRunningInExpoGo: jest.fn() }));
jest.mock("@react-native-firebase/app", () => {
  mockLoadApp();
  return { getApp: () => mockApp };
});
jest.mock("@react-native-firebase/messaging", () => {
  mockLoadMessaging();
  return { getMessaging: () => mockMessaging };
});

test("Expo Go never evaluates the unavailable Firebase native modules", () => {
  jest.mocked(isRunningInExpoGo).mockReturnValue(true);
  expect(getNativePush()).toBeNull();
  expect(mockLoadApp).not.toHaveBeenCalled();
  expect(mockLoadMessaging).not.toHaveBeenCalled();
});

test("development builds retain native Firebase messaging", () => {
  jest.mocked(isRunningInExpoGo).mockReturnValue(false);
  expect(getNativePush()?.messaging).toBe(mockMessaging);
  expect(mockLoadApp).toHaveBeenCalledTimes(1);
  expect(mockLoadMessaging).toHaveBeenCalledTimes(1);
});
