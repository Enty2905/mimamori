import { z } from "zod";
import { requestData, apiResponse } from "./client";
import { consumeEventStream } from "./sse";
const conversationSchema = z.object({ id: z.number(), title: z.string() });
export const messageSchema = z.object({
  id: z.number(),
  sender: z.enum(["USER", "AI", "ASSISTANT", "SYSTEM"]),
  content: z.string(),
  createdAt: z.string(),
});
export type ChatMessage = z.infer<typeof messageSchema>;
export const conversationApi = {
  active: (signal?: AbortSignal) =>
    requestData("/api/conversations/active", conversationSchema, { signal }),
  messages: (id: number, signal?: AbortSignal) =>
    requestData(`/api/conversations/${id}/messages`, z.array(messageSchema), {
      signal,
    }),
  send: (id: number, content: string, requestId: string) =>
    requestData(`/api/conversations/${id}/messages`, messageSchema, {
      method: "POST",
      body: JSON.stringify({ content, requestId }),
    }),
  stream: async (
    id: number,
    content: string,
    requestId: string,
    onDelta: (text: string) => void,
    signal: AbortSignal,
  ) =>
    consumeEventStream(
      await apiResponse(`/api/conversations/${id}/messages/stream`, {
        method: "POST",
        headers: { Accept: "text/event-stream" },
        body: JSON.stringify({ content, requestId }),
        signal,
      }),
      messageSchema,
      onDelta,
      signal,
    ),
};
