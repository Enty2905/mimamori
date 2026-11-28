import { fetch } from "expo/fetch";
import { apiClient, ApiError, onSessionExpired, configuredBaseUrl } from "./client";
import { sessionTokens } from "../storage/sessionTokens";
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
const mockedFetch = jest.mocked(fetch);
function response(
  status: number,
  data: unknown,
): Awaited<ReturnType<typeof fetch>> {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
    headers: new Headers(),
  } as unknown as Awaited<ReturnType<typeof fetch>>;
}
const initial = {
  accessToken: "synthetic-access-old",
  refreshToken: "synthetic-refresh-old",
  userId: 1,
  role: "ELDERLY" as const,
};
test('standalone USB preview allows loopback HTTP only with an explicit preview flag',()=>{
  expect(configuredBaseUrl('http://127.0.0.1:18080',false,true)).toBe('http://127.0.0.1:18080');
  expect(()=>configuredBaseUrl('http://127.0.0.1:18080',false,false)).toThrow('HTTPS_REQUIRED');
  expect(()=>configuredBaseUrl('http://example.com',false,true)).toThrow('HTTPS_REQUIRED');
  expect(configuredBaseUrl('https://example.com',false,false)).toBe('https://example.com');
});
beforeEach(async () => {
  mockedFetch.mockReset();
  await sessionTokens.clear();
  await sessionTokens.save(initial);
  onSessionExpired(jest.fn());
});
test("concurrent 401s share one refresh and each retry at most once", async () => {
  let calls = 0;
  let refreshes = 0;
  mockedFetch.mockImplementation(async (input) => {
    if (String(input).endsWith("/api/auth/refresh")) {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response(200, {
        success: true,
        message: "ok",
        data: {
          token: "synthetic-access-new",
          refreshToken: "synthetic-refresh-new",
          user: { id: 1, role: "ELDERLY" },
        },
      });
    }
    calls++;
    return calls <= 2
      ? response(401, { code: "UNAUTHENTICATED" })
      : response(200, { success: true, message: "ok", data: [] });
  });
  await Promise.all([
    apiClient("/api/medications/today"),
    apiClient("/api/medications/today"),
  ]);
  expect(refreshes).toBe(1);
  expect(calls).toBe(4);
  expect((await sessionTokens.read())?.accessToken).toBe(
    "synthetic-access-new",
  );
});
test("refresh rejection clears credentials and expires the session once", async () => {
  const expired = jest.fn();
  onSessionExpired(expired);
  mockedFetch.mockResolvedValue(response(401, { code: "UNAUTHENTICATED" }));
  await expect(apiClient("/api/users/me")).rejects.toMatchObject({
    status: 401,
  });
  expect(await sessionTokens.read()).toBeNull();
  expect(expired).toHaveBeenCalledTimes(1);
  expect(mockedFetch).toHaveBeenCalledTimes(2);
});
test("network failure while refreshing preserves the session for offline use", async () => {
  mockedFetch.mockImplementation(async (input) => {
    if (String(input).endsWith("/api/auth/refresh"))
      throw new TypeError("synthetic network failure");
    return response(401, { code: "UNAUTHENTICATED" });
  });
  await expect(apiClient("/api/users/me")).rejects.toMatchObject({
    code: "NETWORK_UNAVAILABLE",
  });
  expect((await sessionTokens.read())?.refreshToken).toBe(initial.refreshToken);
});
test("persistent 401 after rotation does not cause an infinite refresh loop", async () => {
  mockedFetch.mockImplementation(async (input) =>
    String(input).endsWith("/api/auth/refresh")
      ? response(200, {
          success: true,
          message: "ok",
          data: {
            token: "synthetic-new",
            refreshToken: "synthetic-rotated",
            user: { id: 1, role: "ELDERLY" },
          },
        })
      : response(401, { code: "UNAUTHENTICATED" }),
  );
  await expect(apiClient("/api/users/me")).rejects.toBeInstanceOf(ApiError);
  expect(mockedFetch).toHaveBeenCalledTimes(3);
  expect(await sessionTokens.read()).toBeNull();
});
test("queued actions cannot attach another users session", async () => {
  await expect(
    apiClient("/api/medications/logs/2/confirm", {
      sessionOwner: 2,
      method: "POST",
    }),
  ).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  expect(mockedFetch).not.toHaveBeenCalled();
});
test("provider and arbitrary absolute URLs cannot receive the JWT", async () => {
  await expect(
    apiClient("https://example.invalid/api/users/me"),
  ).rejects.toMatchObject({ code: "INVALID_API_PATH" });
  expect(mockedFetch).not.toHaveBeenCalled();
});
