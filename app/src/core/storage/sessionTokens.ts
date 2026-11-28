import * as SecureStore from "expo-secure-store";
import { z } from "zod";
const schema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  userId: z.number().int().positive(),
  role: z.enum(["ELDERLY", "CAREGIVER"]),
});
export type SessionBundle = z.infer<typeof schema>;
const KEY = "mimamori.session.v2";
let cached: SessionBundle | null | undefined;
let epoch = 0;
let writes: Promise<unknown> = Promise.resolve();
function write<T>(operation: () => Promise<T>) {
  const result = writes.catch(() => {}).then(operation);
  writes = result;
  return result;
}
export const sessionTokens = {
  async read(): Promise<SessionBundle | null> {
    if (cached !== undefined) return cached;
    await writes.catch(() => {});
    const version = epoch;
    const raw = await SecureStore.getItemAsync(KEY);
    if (version !== epoch) return cached ?? null;
    try {
      cached = raw ? schema.parse(JSON.parse(raw)) : null;
    } catch {
      cached = null;
      await SecureStore.deleteItemAsync(KEY);
    }
    return cached;
  },
  async save(bundle: SessionBundle) {
    const version = ++epoch;
    const valid = schema.parse(bundle);
    await write(async () => {
      if (version !== epoch) return;
      await SecureStore.setItemAsync(KEY, JSON.stringify(valid));
      if (version === epoch) cached = valid;
    });
  },
  async replace(expectedRefresh: string, bundle: SessionBundle) {
    const version = epoch;
    const current = await this.read();
    if (current?.refreshToken !== expectedRefresh || version !== epoch)
      return false;
    return write(async () => {
      if (version !== epoch || cached?.refreshToken !== expectedRefresh)
        return false;
      const valid = schema.parse(bundle);
      await SecureStore.setItemAsync(KEY, JSON.stringify(valid));
      if (version !== epoch) return false;
      cached = valid;
      return true;
    });
  },
  async clear() {
    epoch++;
    cached = null;
    await write(async () => {
      await SecureStore.deleteItemAsync(KEY);
      await SecureStore.deleteItemAsync("mimamori_jwt_token");
    });
  },
};
