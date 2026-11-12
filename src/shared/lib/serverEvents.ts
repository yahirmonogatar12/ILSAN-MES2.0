export interface ServerEvent {
  event: string;
  data: string;
}
function eventBlock(block: string): ServerEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  return data.length ? { event, data: data.join("\n") } : null;
}
/** Incremental SSE framing, including split UTF-8 characters and CRLF boundaries. */
export async function readServerEvents(
  body: ReadableStream<Uint8Array>,
  receive: (event: ServerEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        signal?.throwIfAborted();
        const event = eventBlock(block);
        if (event) receive(event);
      }
      if (done) break;
    }
    const final = eventBlock(buffer);
    if (final) receive(final);
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
