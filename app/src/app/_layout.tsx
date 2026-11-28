import React, {useEffect} from 'react';
import {Stack} from 'expo-router';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClientProvider} from '@tanstack/react-query';
import '../core/localization/i18n';
import {queryClient} from '../core/api/queryClient';
import {useAuthStore} from '../core/auth/useAuthStore';
import {useAccessibilityStore} from '../core/accessibility/useAccessibilityStore';
import {ReminderRuntime} from '../core/notifications/ReminderRuntime';
import {useThemeStore} from '../core/theme/useTheme';
export default function RootLayout() {
  const restore = useAuthStore(state=>state.restore);
  const ready = useAuthStore(state=>state.ready);
  useEffect(()=>{void restore(); void useAccessibilityStore.getState().loadSavedSettings();useThemeStore.getState().load();},[restore]);
  return <SafeAreaProvider><QueryClientProvider client={queryClient}>
    <Stack screenOptions={{headerShown:false,animation:'none'}} />
    {ready && <ReminderRuntime />}
  </QueryClientProvider></SafeAreaProvider>;
}
