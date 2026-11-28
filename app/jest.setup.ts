import { TextDecoder, TextEncoder } from "node:util";
import { ReadableStream } from "node:stream/web";
Object.assign(globalThis, { TextDecoder, TextEncoder, ReadableStream });
jest.mock("expo/fetch", () => ({
  fetch: jest.fn(async () => {
    throw new Error("Unexpected network request in test");
  }),
}));
jest.mock("expo-secure-store", () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
});
jest.mock("expo-sqlite/kv-store", () => {
  const values = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (key: string) => values.get(key) ?? null,
      setItemSync: (key: string, value: string) => {values.set(key,value);},
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: async (key: string) => {
        values.delete(key);
      },
    },
  };
});
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "vi" }],
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));
