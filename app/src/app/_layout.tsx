import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import { requireOptionalNativeModule } from 'expo';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';

export default function RootLayout() {
  useEffect(() => {
    // 1. Load saved font size preferences globally
    useAccessibilityStore.getState().loadSavedSettings();

    // 2. Hide floating Expo dev tools gear button if present
    try {
      const DevMenuPreferences = requireOptionalNativeModule('DevMenuPreferences');
      DevMenuPreferences?.setPreferencesAsync({
        showFloatingActionButton: false,
      });
    } catch {
      // Ignored if not running in an environment with DevMenuPreferences
    }
  }, []);

  return <Slot />;
}
