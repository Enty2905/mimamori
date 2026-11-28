import { z } from "zod";
import { SseParser, consumeEventStream } from "./sse";
const done = z.object({ id: z.number(), content: z.string() });
function streamed(parts: Uint8Array[]) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  } as Response;
}
test("parses split CRLF, comments and multiline event data", () => {
  const parser = new SseParser();
  expect(parser.feed(": ping\r\nevent: delta\r")).toEqual([]);
  expect(parser.feed("\ndata: first\r\ndata: second\r\n\r\n")).toEqual([
    { event: "delta", data: "first\nsecond" },
  ]);
});
test("reassembles split UTF-8 Vietnamese and Japanese and requires done", async () => {
  const text = "Xin chào、こんにちは";
  const payload = `event: delta\ndata: ${JSON.stringify({ text })}\n\nevent: done\ndata: ${JSON.stringify({ id: 1, content: text })}\n\n`;
  const bytes = new TextEncoder().encode(payload);
  const chunks = Array.from(bytes, (value) => Uint8Array.of(value));
  const deltas: string[] = [];
  await expect(
    consumeEventStream(
      streamed(chunks),
      done,
      (value) => deltas.push(value),
      new AbortController().signal,
    ),
  ).resolves.toEqual({ id: 1, content: text });
  expect(deltas).toEqual([text]);
});
test("EOF without completion cannot be mistaken for a successful reply", async () => {
  await expect(
    consumeEventStream(
      streamed([
        new TextEncoder().encode('event: delta\ndata: {"text":"partial"}\n\n'),
      ]),
      done,
      () => {},
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "INCOMPLETE_STREAM" });
});
test("cancellation stops before a following done event", async () => {
  const controller = new AbortController();
  await expect(
    consumeEventStream(
      streamed([
        new TextEncoder().encode(
          'event: delta\ndata: {"text":"partial"}\n\nevent: done\ndata: {"id":1,"content":"partial"}\n\n',
        ),
      ]),
      done,
      () => controller.abort(),
      controller.signal,
    ),
  ).rejects.toMatchObject({ code: "CANCELED" });
});
test("stream errors cannot be interpreted as assistant text", async () => {
  await expect(
    consumeEventStream(
      streamed([
        new TextEncoder().encode(
          'event: error\ndata: {"code":"STREAM_TIMEOUT"}\n\n',
        ),
      ]),
      done,
      () => {},
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "STREAM_INTERRUPTED" });
});
