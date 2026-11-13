import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/app/queryClient";
import { ApiError } from "@/core/http";
import { createAssistantApi } from "@/core/assistant/api";
import { assistantKeys } from "@/core/assistant/config";
import type { AssistantApi, SendRequest, Thread } from "@/core/assistant/types";
import { useChatStream } from "./useChatStream";
const payload: SendRequest = {
  content: "Revisar inventario",
  client_message_id: "request-1",
  language: "es",
  page_context: { path: "/material", title: "MES", container_id: null },
  file_ref: "file-1",
  file_refs: ["file-1"],
};
const files = [{ file_ref: "file-1", filename: "stock.xlsx" }];
const initial: Thread = {
  conversation: {
    public_id: "chat",
    title: "Stock",
    language: "es",
    model: "test",
    status: "active",
    updated_at: null,
  },
  messages: [],
  artifacts: [],
};
function setup(overrides: Partial<AssistantApi>) {
  const client = createQueryClient();
  client.setQueryData(
    assistantKeys.thread("live:first", "chat"),
    structuredClone(initial),
  );
  const api = { ...createAssistantApi("live", "live:first"), ...overrides };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(() => useChatStream(api, "live:first"), { wrapper }),
  };
}
describe("assistant streaming lifecycle", () => {
  it("serializes sends, keeps partial text and attachments when stopped", async () => {
    const send = vi
      .fn<AssistantApi["send"]>()
      .mockImplementation(async (_id, _payload, receive, signal) => {
        receive({ type: "ack", userId: 1, assistantId: 2 });
        receive({ type: "delta", text: "Avance parcial" });
        await new Promise<void>((_resolve, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Stopped", "AbortError")),
            { once: true },
          ),
        );
      });
    const view = setup({ send });
    let pending!: Promise<void>;
    act(() => {
      pending = view.result.current.send("chat", payload, files);
    });
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    await act(() => view.result.current.send("chat", payload, files));
    expect(send).toHaveBeenCalledOnce();
    await act(async () => {
      view.result.current.stop();
      await pending;
    });
    const cached = view.client.getQueryData<Thread>(
      assistantKeys.thread("live:first", "chat"),
    )!;
    expect(cached.messages[0].attachments).toEqual(files);
    expect(cached.messages[1]).toMatchObject({
      content: "Avance parcial",
      status: "interrupted",
    });
    expect(view.result.current.canRetry).toBe(true);
  });
  it("reuses an unacknowledged request id and reconciles a conflict without duplicate messages", async () => {
    const stored: Thread = {
      ...initial,
      messages: [
        {
          id: 10,
          key: "10",
          client_message_id: payload.client_message_id,
          role: "user",
          content: payload.content,
          status: "complete",
          created_at: null,
          attachments: files,
          artifacts: [],
          visualizations: [],
        },
        {
          id: 11,
          key: "11",
          client_message_id: null,
          role: "assistant",
          content: "Respuesta guardada",
          status: "complete",
          created_at: null,
          attachments: [],
          artifacts: [],
          visualizations: [],
        },
      ],
    };
    const send = vi
      .fn<AssistantApi["send"]>()
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockRejectedValueOnce(new ApiError("Processed", 409));
    const thread = vi.fn().mockResolvedValue(stored);
    const view = setup({ send, thread });
    await act(() => view.result.current.send("chat", payload, files));
    expect(send).toHaveBeenCalledOnce();
    await act(() => view.result.current.retry());
    expect(send.mock.calls.map((call) => call[1].client_message_id)).toEqual([
      "request-1",
      "request-1",
    ]);
    expect(thread).toHaveBeenCalledOnce();
    expect(
      view.client.getQueryData<Thread>(
        assistantKeys.thread("live:first", "chat"),
      )?.messages,
    ).toEqual(stored.messages);
    expect(view.result.current.canRetry).toBe(false);
  });
  it("assigns a new id on explicit retry after server acknowledgment", async () => {
    const send = vi
      .fn<AssistantApi["send"]>()
      .mockImplementation(async (_id, _payload, receive) => {
        receive({ type: "ack", userId: 1, assistantId: 2 });
        throw new Error("Connection lost");
      });
    const view = setup({ send });
    await act(() => view.result.current.send("chat", payload, files));
    await act(() => view.result.current.retry());
    expect(send.mock.calls[1][1].client_message_id).not.toBe("request-1");
    expect(send.mock.calls[1][1].file_refs).toEqual(["file-1"]);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("aborts on session unmount and discards late events", async () => {
    let signal!: AbortSignal,
      emit!: Parameters<AssistantApi["send"]>[2],
      finish!: () => void;
    const send = vi
      .fn<AssistantApi["send"]>()
      .mockImplementation(async (_id, _payload, receive, currentSignal) => {
        signal = currentSignal;
        emit = receive;
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      });
    const view = setup({ send });
    let pending!: Promise<void>;
    act(() => {
      pending = view.result.current.send("chat", payload, files);
    });
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    const before = structuredClone(
      view.client.getQueryData(assistantKeys.thread("live:first", "chat")),
    );
    view.unmount();
    expect(signal.aborted).toBe(true);
    emit({ type: "delta", text: "Late private response" });
    finish();
    await pending;
    expect(
      view.client.getQueryData(assistantKeys.thread("live:first", "chat")),
    ).toEqual(before);
    expect(
      view.client.getQueryData(assistantKeys.thread("live:second", "chat")),
    ).toBeUndefined();
  });
  it("reports server error events even when a done frame follows", async () => {
    const view = setup({
      send: async (_id, _payload, receive) => {
        receive({ type: "error", message: "Cuota agotada" });
        receive({ type: "done", artifacts: [], visualizations: [] });
      },
    });
    await act(() => view.result.current.send("chat", payload, files));
    expect(view.result.current.error).toBe("Cuota agotada");
    expect(view.result.current.canRetry).toBe(true);
  });
  it("refreshes permission gates after a forbidden send", async () => {
    const view = setup({
      send: vi.fn().mockRejectedValue(new ApiError("Denied", 403)),
    });
    const invalidate = vi.spyOn(view.client, "invalidateQueries");
    await act(() => view.result.current.send("chat", payload, files));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["permission", "live:first"],
    });
  });
});
