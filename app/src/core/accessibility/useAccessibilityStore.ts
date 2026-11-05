import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type FontSizeLevel = 'small' | 'standard' | 'large' | 'xlarge';

export interface FontSizeOption {
  id: FontSizeLevel;
  label: string;
  scale: number;
  sublabel: string;
  description: string;
}

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { id: 'small', label: 'Nhỏ', scale: 0.9, sublabel: '90%', description: 'Nội dung hiển thị gọn gàng' },
  { id: 'standard', label: 'Tiêu chuẩn', scale: 1.0, sublabel: '100%', description: 'Cỡ chữ mặc định hệ thống' },
  { id: 'large', label: 'Lớn', scale: 1.15, sublabel: '115%', description: 'Chữ to, dễ đọc và êm mắt' },
  { id: 'xlarge', label: 'Rất lớn', scale: 1.3, sublabel: '130%', description: 'Tối ưu cho người mắt kém' },
];

const STORAGE_KEY = 'mimamori_font_size_level';

interface AccessibilityState {
  fontSizeLevel: FontSizeLevel;
  fontScale: number;
  setFontSizeLevel: (level: FontSizeLevel) => Promise<void>;
  resetToDefault: () => Promise<void>;
  loadSavedSettings: () => Promise<void>;
  fs: (baseSize: number) => number;
}

export const useAccessibilityStore = create<AccessibilityState>((set, get) => ({
  fontSizeLevel: 'standard',
  fontScale: 1.0,

  fs: (baseSize: number) => Math.round(baseSize * get().fontScale),

  setFontSizeLevel: async (level: FontSizeLevel) => {
    const option = FONT_SIZE_OPTIONS.find((o) => o.id === level) || FONT_SIZE_OPTIONS[1];
    set({ fontSizeLevel: option.id, fontScale: option.scale });

    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEY, option.id);
      } else {
        await SecureStore.setItemAsync(STORAGE_KEY, option.id);
      }
    } catch {
      // Ignore write errors
    }
  },

  resetToDefault: async () => {
    const standard = FONT_SIZE_OPTIONS[1];
    set({ fontSizeLevel: 'standard', fontScale: 1.0 });

    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEY, 'standard');
      } else {
        await SecureStore.setItemAsync(STORAGE_KEY, 'standard');
      }
    } catch {
      // Ignore
    }
  },

  loadSavedSettings: async () => {
    try {
      let savedLevel: string | null = null;
      if (Platform.OS === 'web') {
        savedLevel = localStorage.getItem(STORAGE_KEY);
      } else {
        savedLevel = await SecureStore.getItemAsync(STORAGE_KEY);
      }

      if (savedLevel && (savedLevel === 'small' || savedLevel === 'standard' || savedLevel === 'large' || savedLevel === 'xlarge')) {
        const option = FONT_SIZE_OPTIONS.find((o) => o.id === savedLevel);
        if (option) {
          set({ fontSizeLevel: option.id, fontScale: option.scale });
        }
      }
    } catch {
      // Use defaults if load fails
    }
  },
}));

