import { describe, expect, it, vi } from "vitest";
import { readServerEvents } from "./serverEvents";
import { clientId } from "./id";
import { requestEventStream } from "@/core/http";
import { SESSION_EXPIRED_EVENT } from "@/core/runtime";
const encoder = new TextEncoder();
function chunks(source: string, length = 1) {
  const bytes = encoder.encode(source);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += length)
        controller.enqueue(bytes.slice(offset, offset + length));
      controller.close();
    },
  });
}
describe("authenticated server events", () => {
  it("frames UTF8, CRLF, comments, multiline data and final events across arbitrary chunks", async () => {
    const events: unknown[] = [];
    await readServerEvents(
      chunks(
        ": keepalive\r\nevent: delta\r\ndata: México 한국\r\ndata: segunda línea\r\n\r\nevent: done\ndata: {}",
      ),
      (event) => events.push(event),
    );
    expect(events).toEqual([
      { event: "delta", data: "México 한국\nsegunda línea" },
      { event: "done", data: "{}" },
    ]);
  });
  it("uses the default event name and ignores empty blocks", async () => {
    const receive = vi.fn();
    await readServerEvents(chunks("\n\n: ping\n\ndata: texto\n\n", 5), receive);
    expect(receive).toHaveBeenCalledExactlyOnceWith({
      event: "message",
      data: "texto",
    });
  });
  it("cancels a pending read when stopped and releases the stream", async () => {
    const cancel = vi.fn(),
      controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const promise = readServerEvents(body, vi.fn(), controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });
  it("cancels and unlocks the body if event processing fails", async () => {
    const body = chunks("data: invalid\n\n");
    await expect(
      readServerEvents(body, () => {
        throw new Error("invalid");
      }),
    ).rejects.toThrow("invalid");
    expect(body.locked).toBe(false);
  });
  it("shares cookies, JSON body and request headers for SSE", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(chunks('event: delta\ndata: {"text":"hola"}\n\n'), {
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const receive = vi.fn(),
      controller = new AbortController();
    await requestEventStream(
      "/api/ai/test",
      {
        method: "POST",
        body: "{}",
        signal: controller.signal,
        headers: new Headers({
          "X-Test": "ok",
          Accept: "application/json",
          "content-type": "application/json",
        }),
      },
      receive,
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/backend/api/ai/test",
      expect.objectContaining({
        credentials: "same-origin",
        signal: controller.signal,
        body: "{}",
        headers: expect.objectContaining({
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          "x-test": "ok",
        }),
      }),
    );
    expect(receive).toHaveBeenCalledWith({
      event: "delta",
      data: '{"text":"hola"}',
    });
  });
  it.each([401, 403, 429])(
    "preserves HTTP %s and the server error without retrying",
    async (status) => {
      const expired = vi.fn();
      window.addEventListener(SESSION_EXPIRED_EVENT, expired);
      const fetcher = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Quota or access" }), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetcher);
      await expect(
        requestEventStream("/api/ai/test", {}, vi.fn()),
      ).rejects.toMatchObject({ status, message: "Quota or access" });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(expired).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
      window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
    },
  );
  it("rejects login HTML instead of treating it as a chat response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>login</html>", {
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    await expect(
      requestEventStream("/api/ai/test", {}, vi.fn()),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("creates UUIDs on intranet browsers without randomUUID", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(255);
        return bytes;
      },
    });
    expect(clientId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });
});
