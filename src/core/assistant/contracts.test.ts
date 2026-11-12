import { describe, expect, it, vi } from "vitest";
import { createAssistantApi } from "./api";
import { artifact, decodeEvent, message, fileIssue } from "./model";
import { demoAssistant } from "./demo";
import type { SendRequest } from "./types";
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
const conversation = {
  public_id: "chat/1",
  title: "Consulta",
  language: "es",
  model: "server-model",
  status: "active",
  updated_at: null,
};
const payload: SendRequest = {
  content: "Hola",
  client_message_id: "uuid",
  language: "es",
  page_context: { path: "/material", title: "MES", container_id: null },
  file_ref: null,
  file_refs: [],
};
describe("assistant contracts", () => {
  it("loads paginated messages and artifacts with the same abort signal", async () => {
    const fetcher = vi.fn(async (url: string) =>
      json(
        url.includes("/messages?")
          ? { conversation, messages: [] }
          : { artifacts: [] },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    const data = await createAssistantApi("live", "live:qa").thread(
      "chat/1",
      signal,
      20,
    );
    expect(data.conversation.public_id).toBe("chat/1");
    expect(fetcher).toHaveBeenCalledWith(
      "/backend/api/ai/conversations/chat%2F1/messages?limit=100&before_id=20",
      expect.objectContaining({ signal }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/backend/api/ai/conversations/chat%2F1/artifacts",
      expect.objectContaining({ signal }),
    );
  });
  it("uses exact creation, archive, removal and nullable quota payloads", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async () => json({ success: true, conversation }));
    vi.stubGlobal("fetch", fetcher);
    const api = createAssistantApi("live", "live:qa");
    await api.create("ko");
    await api.update("chat/1", { status: "archived" });
    await api.remove("chat/1");
    const quota = {
      subject_type: "user" as const,
      subject_key: "qa",
      daily_request_limit: 0,
      daily_token_limit: null,
      daily_artifact_limit: 5,
    };
    await api.saveQuota(quota);
    expect(
      fetcher.mock.calls.map(([url, init]) => [url, init.method, init.body]),
    ).toEqual([
      ["/backend/api/ai/conversations", "POST", '{"language":"ko"}'],
      [
        "/backend/api/ai/conversations/chat%2F1",
        "PATCH",
        '{"status":"archived"}',
      ],
      ["/backend/api/ai/conversations/chat%2F1", "DELETE", undefined],
      ["/backend/api/ai/audit/limits", "PATCH", JSON.stringify(quota)],
    ]);
  });
  it("uploads multipart without imposing a JSON content type", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ file_ref: "ref", filename: "plan.xlsx" }));
    vi.stubGlobal("fetch", fetcher);
    const file = new File(["data"], "plan.xlsx");
    const result = await createAssistantApi("live", "live:qa").upload(
      "chat/1",
      file,
    );
    const init = fetcher.mock.calls[0][1];
    expect(init.body.get("file")).toBe(file);
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(result.file_ref).toBe("ref");
  });
  it("decodes streamed events and preserves request id, attachments and context", async () => {
    const source =
      'event: ack\ndata: {"user_message_id":1,"assistant_message_id":2}\n\nevent: delta\ndata: {"text":"Hola"}\n\nevent: done\ndata: {"message_id":2}\n\n';
    const fetcher = vi.fn().mockResolvedValue(
      new Response(source, {
        headers: { "content-type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const receive = vi.fn();
    await createAssistantApi("live", "live:qa").send(
      "chat/1",
      payload,
      receive,
      new AbortController().signal,
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(payload);
    expect(receive.mock.calls.map(([event]) => event.type)).toEqual([
      "ack",
      "delta",
      "done",
    ]);
  });
  it("builds private download paths from ids and uses inline only for images", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response("image", { headers: { "content-type": "image/png" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const value = artifact({
      id: "art/1",
      filename: "image.png",
      mime_type: "image/png",
      download_url: "https://untrusted.example",
    });
    await createAssistantApi("live", "live:qa").file(value, true);
    expect(fetcher.mock.calls[0][0]).toBe(
      "/backend/api/ai/artifacts/art%2F1/download?inline=1",
    );
  });
  it("preserves historical attachment metadata and nullable values", () => {
    const value = message({
      id: 1,
      role: "user",
      content: null,
      created_at: null,
      content_json: { attachment: { filename: "old.xlsx" } },
    });
    expect(value.attachments[0].filename).toBe("old.xlsx");
    expect(value.created_at).toBeNull();
    expect(value.content).toBe("");
  });
  it.each([
    { user_message_id: 0, assistant_message_id: 2 },
    { user_message_id: 1.5, assistant_message_id: 2 },
    {},
  ])("rejects invalid stream acknowledgments %j", (event) => {
    expect(() => decodeEvent("ack", event)).toThrow(/identificadores/);
  });
  it("validates attachments before making a request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(fileIssue(new File([], "empty.txt"))).toContain("20 MB");
    await expect(
      createAssistantApi("live", "live:qa").upload(
        "id",
        new File(["file"], "app.exe"),
      ),
    ).rejects.toThrow(/Formato/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("isolates demo histories and attachment storage by session scope", async () => {
    const first = demoAssistant("demo:one-" + crypto.randomUUID()),
      second = demoAssistant("demo:two-" + crypto.randomUUID());
    const created = await first.create("es");
    expect(await second.conversations(true)).toEqual([]);
    await expect(second.thread(created.public_id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
