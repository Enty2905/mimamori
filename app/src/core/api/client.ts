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

export interface ApiClientOptions extends RequestInit {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 25000;

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function apiClient<T = any>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers: customHeaders,
    signal: externalSignal,
    ...fetchOptions
  } = options;

  const token = await tokenStorage.getToken();
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(customHeaders as Record<string, string>),
  };

  if (isFormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  let timedOut = false;

  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  const onExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  if (isFormData && typeof XMLHttpRequest !== 'undefined') {
    return new Promise<ApiResponse<T>>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const method = (fetchOptions.method || 'POST').toUpperCase();
      xhr.open(method, url);
      if (timeoutMs > 0) {
        xhr.timeout = timeoutMs;
      }
      Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'content-type' && value !== undefined) {
          xhr.setRequestHeader(key, value);
        }
      });

      const cleanupAbort = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        if (externalSignal) {
          externalSignal.removeEventListener('abort', onExternalAbort);
        }
      };

      const abortXhr = () => {
        try {
          xhr.abort();
        } catch {
          // Ignore
        }
      };
      controller.signal.addEventListener('abort', abortXhr, { once: true });

      xhr.onload = () => {
        cleanupAbort();
        const text = xhr.responseText || '';
        const ok = xhr.status >= 200 && xhr.status < 300;
        let json: ApiResponse<T>;
        try {
          json = text
            ? JSON.parse(text)
            : { success: ok, message: xhr.statusText || '', data: null as any };
        } catch {
          json = {
            success: ok,
            message: text || xhr.statusText || '',
            data: null as any,
          };
        }

        if (!ok) {
          reject(new HttpError(json.message || `Yêu cầu thất bại (mã lỗi ${xhr.status})`, xhr.status));
          return;
        }
        resolve(json);
      };

      xhr.ontimeout = () => {
        cleanupAbort();
        reject(new Error('Kết nối tới máy chủ mất quá nhiều thời gian. Ông/bà vui lòng thử lại nhé.'));
      };

      xhr.onabort = () => {
        cleanupAbort();
        if (timedOut) {
          reject(new Error('Kết nối tới máy chủ mất quá nhiều thời gian. Ông/bà vui lòng thử lại nhé.'));
        } else {
          reject(new Error('Yêu cầu đã bị hủy.'));
        }
      };

      xhr.onerror = () => {
        cleanupAbort();
        reject(
          new Error(
            'Không có kết nối mạng hoặc không thể kết nối tới máy chủ Mimamori. Ông/bà vui lòng kiểm tra lại mạng nhé.'
          )
        );
      };

      xhr.send(fetchOptions.body as any);
    });
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    const text = await response.text();
    let json: ApiResponse<T>;
    try {
      json = text
        ? JSON.parse(text)
        : { success: response.ok, message: response.statusText, data: null as any };
    } catch {
      json = {
        success: response.ok,
        message: text || response.statusText,
        data: null as any,
      };
    }

    if (!response.ok) {
      throw new HttpError(json.message || `Yêu cầu thất bại (mã lỗi ${response.status})`, response.status);
    }

    return json;
  } catch (error: any) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (timedOut) {
      throw new Error('Kết nối tới máy chủ mất quá nhiều thời gian. Ông/bà vui lòng thử lại nhé.');
    }
    if (error?.name === 'AbortError') {
      throw new Error('Yêu cầu đã bị hủy.');
    }
    throw new Error(
      'Không có kết nối mạng hoặc không thể kết nối tới máy chủ Mimamori. Ông/bà vui lòng kiểm tra lại mạng nhé.'
    );
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

