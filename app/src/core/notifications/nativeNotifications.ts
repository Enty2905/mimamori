/* eslint-disable @typescript-eslint/no-require-imports -- Load native providers only after the Expo Go guard. */
import {isRunningInExpoGo} from 'expo';
export function getNativeNotifications(): typeof import('expo-notifications') | null {
  if(isRunningInExpoGo())return null;
  return require('expo-notifications') as typeof import('expo-notifications');
}
