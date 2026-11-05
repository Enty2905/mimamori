import { create } from 'zustand';
import { apiClient, tokenStorage } from '../api/client';

export type UserRole = 'ELDERLY' | 'CAREGIVER';

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  avatarUrl?: string | null;
  emergencyContact?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  register: (userData: {
    username: string;
    password: string;
    fullName: string;
    email: string;
    role: UserRole;
    phoneNumber?: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  demoLogin: (role: UserRole) => Promise<boolean>;
  clearError: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const trimmedIdentifier = username.trim();
      const res = await apiClient<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          usernameOrEmail: trimmedIdentifier,
          username: trimmedIdentifier,
          password: password,
        }),
      });

      if (res.success && res.data) {
        await tokenStorage.setToken(res.data.token);
        set({
          user: res.data.user,
          token: res.data.token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      }
      set({ isLoading: false, error: res.message || 'Đăng nhập không thành công' });
      return false;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Lỗi kết nối máy chủ' });
      return false;
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...userData,
          username: userData.username.trim(),
          email: userData.email.trim(),
          fullName: userData.fullName.trim(),
        }),
      });

      if (res.success && res.data) {
        await tokenStorage.setToken(res.data.token);
        set({
          user: res.data.user,
          token: res.data.token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      }
      set({ isLoading: false, error: res.message || 'Đăng ký không thành công' });
      return false;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Lỗi đăng ký' });
      return false;
    }
  },

  demoLogin: async (role: UserRole) => {
    if (role === 'ELDERLY') {
      return get().login('ong_ba', 'Password123!');
    } else {
      return get().login('con_gai', 'Password123!');
    }
  },

  logout: async () => {
    await tokenStorage.clearToken();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  updateUser: (updatedUser: Partial<User>) => {
    const current = get().user;
    if (current) {
      set({ user: { ...current, ...updatedUser } });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await tokenStorage.getToken();
      if (!token) {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const res = await apiClient<User>('/api/auth/me');
      if (res.success && res.data) {
        set({
          user: res.data,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        await tokenStorage.clearToken();
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      await tokenStorage.clearToken();
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

