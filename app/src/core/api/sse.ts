import { z } from "zod";
import { ApiError } from "./client";
export class SseParser {
  private buffer = "";
  private event = "message";
  private data: string[] = [];
  feed(text: string) {
    this.buffer += text;
    if (this.buffer.length > 65536) throw new ApiError(0, "STREAM_LIMIT");
    const events: { event: string; data: string }[] = [];
    let end: number;
    while ((end = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, end).replace(/\r$/, "");
      this.buffer = this.buffer.slice(end + 1);
      if (line === "") {
        if (this.data.length)
          events.push({ event: this.event, data: this.data.join("\n") });
        this.event = "message";
        this.data = [];
        continue;
      }
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const name = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (name === "event") this.event = value;
      else if (name === "data") this.data.push(value);
      if (this.data.join("").length > 65536)
        throw new ApiError(0, "STREAM_LIMIT");
    }
    return events;
  }
}
export async function consumeEventStream<S extends z.ZodType>(
  response: Response,
  schema: S,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<z.infer<S>> {
  if (!response.ok) throw new ApiError(response.status, "STREAM_UNAVAILABLE");
  if (
    !response.headers.get("content-type")?.includes("text/event-stream") ||
    !response.body
  )
    throw new ApiError(0, "INVALID_STREAM");
  const reader = response.body.getReader();
  const parser = new SseParser();
  const decoder = new TextDecoder();
  let text = "";
  let timeout = false;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timeout = true;
    abort();
  }, 15000);
  try {
    while (true) {
      if (signal.aborted) throw new ApiError(0, "CANCELED");
      const chunk = await reader.read();
      if (chunk.done) break;
      for (const event of parser.feed(
        decoder.decode(chunk.value, { stream: true }),
      )) {
        if (signal.aborted) throw new ApiError(0, "CANCELED");
        const value: unknown = JSON.parse(event.data);
        if (event.event === "error")
          throw new ApiError(0, "STREAM_INTERRUPTED");
        if (event.event === "delta") {
          text += z.object({ text: z.string() }).parse(value).text;
          if (text.length > 16000) throw new ApiError(0, "STREAM_LIMIT");
          onDelta(text);
        }
        if (event.event === "done") return schema.parse(value);
      }
    }
    throw new ApiError(
      0,
      timeout
        ? "STREAM_TIMEOUT"
        : signal.aborted
          ? "CANCELED"
          : "INCOMPLETE_STREAM",
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
