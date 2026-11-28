import { create } from "zustand";
import {
  requestData,
  apiClient,
  onSessionExpired,
  ApiError,
} from "../api/client";
import { authSchema } from "../api/contracts";
import { sessionTokens } from "../storage/sessionTokens";
import { queryClient } from "../api/queryClient";
export type UserRole = "ELDERLY" | "CAREGIVER";
export type { User } from "../api/contracts";
interface AuthState {
  userId: number | null;
  role: UserRole | null;
  ready: boolean;
  restore: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (values: {
    username: string;
    email: string;
    fullName: string;
    password: string;
    role: UserRole;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}
async function accept(result: ReturnType<typeof authSchema.parse>) {
  await sessionTokens.save({
    accessToken: result.token,
    refreshToken: result.refreshToken,
    userId: result.user.id,
    role: result.user.role,
  });
  if ((await sessionTokens.read())?.accessToken !== result.token)
    throw new ApiError(401, "SESSION_CHANGED");
  queryClient.clear();
  queryClient.setQueryData(["profile", result.user.id], result.user);
  useAuthStore.setState({
    userId: result.user.id,
    role: result.user.role,
    ready: true,
  });
}
export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  role: null,
  ready: false,
  restore: async () => {
    try {
      const session = await sessionTokens.read();
      set({
        userId: session?.userId ?? null,
        role: session?.role ?? null,
        ready: true,
      });
    } catch {
      set({ ready: true });
    }
  },
  login: async (identifier, password) =>
    accept(
      await requestData("/api/auth/login", authSchema, {
        method: "POST",
        body: JSON.stringify({ usernameOrEmail: identifier.trim(), password }),
      }),
    ),
  register: async (values) =>
    accept(
      await requestData("/api/auth/register", authSchema, {
        method: "POST",
        body: JSON.stringify(values),
      }),
    ),
  logout: async () => {
    try {
      await apiClient("/api/auth/logout", { method: "POST" });
    } catch {
      /* Local logout still completes offline. */
    } finally {
      await sessionTokens.clear();
      queryClient.clear();
      set({ userId: null, role: null, ready: true });
    }
  },
}));
onSessionExpired(() => {
  queryClient.clear();
  useAuthStore.setState({ userId: null, role: null, ready: true });
});
