import { useState } from 'react';
import { useAuthStore, UserRole, User } from './useAuthStore';
import { useProfile } from '../../features/profile/queries';
import { queryClient } from '../api/queryClient';
import { ApiError } from '../api/client';
import i18n from '../localization/i18n';

// Profile data stays in the server cache; Zustand contains session identity only.
export function useSession() {
  const auth = useAuthStore();
  const profile = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await action(); return true; }
    catch (cause: unknown) {
      setError(i18n.t(cause instanceof ApiError && cause.status===401 ? 'invalidCredentials' : cause instanceof ApiError && cause.status===400 ? 'invalidForm' : 'error'));
      return false;
    } finally { setBusy(false); }
  }
  return {
    user: profile.data,
    userId: auth.userId,
    role: auth.role,
    isAuthenticated: auth.userId !== null,
    isLoading: !auth.ready || busy,
    profile,
    error,
    clearError: () => setError(null),
    login: (identifier: string, password: string) => perform(() => auth.login(identifier, password)),
    register: (values: { username: string; password: string; fullName: string; email: string; role: UserRole; phoneNumber?: string }) =>
      perform(() => auth.register({...values,phone:values.phoneNumber})),
    demoLogin: (role: UserRole) => perform(async () => {
      if (process.env.EXPO_PUBLIC_DEMO_MODE !== 'true') throw new ApiError(403, 'Demo disabled');
      await auth.login(role === 'ELDERLY' ? 'ong_ba' : 'con_gai', 'Password123!');
    }),
    logout: auth.logout,
    checkAuth: auth.restore,
    updateUser: (values: Partial<User>) => queryClient.setQueryData<User>(['profile', auth.userId], (current) => current ? { ...current, ...values } : current),
  };
}
