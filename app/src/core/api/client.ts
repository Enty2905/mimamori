import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.101.21:8080';

const TOKEN_KEY = 'mimamori_jwt_token';

// In-memory token cache for fast access and web/fallback support
let cachedToken: string | null = null;

export const tokenStorage = {
  async getToken(): Promise<string | null> {
    if (cachedToken) return cachedToken;
    try {
      if (Platform.OS === 'web') {
        cachedToken = localStorage.getItem(TOKEN_KEY);
      } else {
        cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      }
      return cachedToken;
    } catch {
      return cachedToken;
    }
  },

  async setToken(token: string): Promise<void> {
    cachedToken = token;
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch {
      // Ignored if storage fails
    }
  },

  async clearToken(): Promise<void> {
    cachedToken = null;
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch {
      // Ignored
    }
  },
};

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await tokenStorage.getToken();
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const text = await response.text();
    let json: ApiResponse<T>;
    try {
      json = text ? JSON.parse(text) : { success: response.ok, message: response.statusText, data: null as any };
    } catch {
      json = {
        success: response.ok,
        message: text || response.statusText,
        data: null as any,
      };
    }

    if (!response.ok) {
      throw new Error(json.message || `Request failed with status ${response.status}`);
    }

    return json;
  } catch (error: any) {
    throw new Error(error.message || 'Không thể kết nối đến máy chủ Mimamori');
  }
}

