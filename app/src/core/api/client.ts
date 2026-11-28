import { fetch } from "expo/fetch";
import { z } from "zod";
import { sessionTokens, SessionBundle } from "../storage/sessionTokens";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}
export interface RequestOptions extends RequestInit {
  sessionOwner?: number;
}
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}
const publicPaths = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
]);
let refreshFlight: Promise<SessionBundle> | null = null;
let expired: () => void = () => {};
export function onSessionExpired(handler: () => void) {
  expired = handler;
}
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown(),
});
const pairSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: z.object({ id: z.number(), role: z.enum(["ELDERLY", "CAREGIVER"]) }),
});

export function configuredBaseUrl(configured: string | undefined, development: boolean, localPreview: boolean) {
  if (!configured && !development) throw new ApiError(0, "API_NOT_CONFIGURED");
  const value = (configured || "http://10.0.2.2:18080").replace(/\/$/, "");
  let url: URL;
  try {url = new URL(value);} catch {throw new ApiError(0, "INVALID_API_URL");}
  if(url.username || url.password || url.search || url.hash || !['http:','https:'].includes(url.protocol))
    throw new ApiError(0, "INVALID_API_URL");
  const usbPreview = localPreview && url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if (!development && url.protocol !== 'https:' && !usbPreview)
    throw new ApiError(0, "HTTPS_REQUIRED");
  return value;
}
function baseUrl() {
  return configuredBaseUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__, process.env.EXPO_PUBLIC_LOCAL_PREVIEW === 'true');
}
async function wire(
  endpoint: string,
  options: RequestInit,
  accessToken?: string,
) {
  if (!endpoint.startsWith("/api/") || endpoint.includes("://"))
    throw new ApiError(0, "INVALID_API_PATH");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 12_000);
  try {
    const headers = new Headers(options.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return await fetch(baseUrl() + endpoint, {
      ...options,
      headers,
      signal: controller.signal,
      credentials: "omit",
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      options.signal?.aborted ? "CANCELED" : "NETWORK_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
async function decode(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError(response.status, "INVALID_RESPONSE");
  }
}
async function rotate(expected: SessionBundle): Promise<SessionBundle> {
  const response = await wire("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: expected.refreshToken }),
  });
  if (response.status === 401) {
    if ((await sessionTokens.read())?.refreshToken === expected.refreshToken) {
      await sessionTokens.clear();
      expired();
    }
    throw new ApiError(401, "SESSION_EXPIRED");
  }
  if (!response.ok) throw new ApiError(response.status, "REFRESH_UNAVAILABLE");
  const envelope = responseSchema.parse(await decode(response));
  const pair = pairSchema.parse(envelope.data);
  if (pair.user.id !== expected.userId)
    throw new ApiError(401, "SESSION_CHANGED");
  const bundle: SessionBundle = {
    accessToken: pair.token,
    refreshToken: pair.refreshToken,
    userId: pair.user.id,
    role: pair.user.role,
  };
  if (!(await sessionTokens.replace(expected.refreshToken, bundle)))
    throw new ApiError(401, "SESSION_CHANGED");
  return bundle;
}
export async function apiResponse(
  endpoint: string,
  options: RequestOptions = {},
): Promise<Response> {
  const isPublic = publicPaths.has(endpoint);
  const session = isPublic ? null : await sessionTokens.read();
  if (
    options.sessionOwner !== undefined &&
    session?.userId !== options.sessionOwner
  )
    throw new ApiError(401, "SESSION_CHANGED");
  let response = await wire(endpoint, options, session?.accessToken);
  if (response.status === 401 && session && !isPublic) {
    const current = await sessionTokens.read();
    if (current?.userId !== session.userId)
      throw new ApiError(401, "SESSION_CHANGED");
    let refreshed: SessionBundle;
    if (current.accessToken !== session.accessToken) refreshed = current;
    else {
      if (!refreshFlight)
        refreshFlight = rotate(session).finally(() => {
          refreshFlight = null;
        });
      refreshed = await refreshFlight;
    }
    response = await wire(endpoint, options, refreshed.accessToken); // At most one retry.
    if (
      response.status === 401 &&
      (await sessionTokens.read())?.accessToken === refreshed.accessToken
    ) {
      await sessionTokens.clear();
      expired();
    }
  }
  return response;
}
export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const response = await apiResponse(endpoint, options);
  const decoded = await decode(response);
  if (!response.ok) {
    const error = z.object({ code: z.string().optional() }).safeParse(decoded);
    throw new ApiError(
      response.status,
      error.success ? error.data.code || "REQUEST_FAILED" : "REQUEST_FAILED",
    );
  }
  const result = responseSchema.parse(decoded);
  if (!result.success) throw new ApiError(response.status, "REQUEST_FAILED");
  return result as ApiResponse<T>;
}

export async function requestData<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.infer<S>> {
  return schema.parse((await apiClient(path, options)).data);
}
