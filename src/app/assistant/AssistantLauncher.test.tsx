import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/app/providers";
import { AuthProvider } from "@/core/auth/AuthProvider";
import { assistantKeys } from "@/core/assistant/config";
import { AssistantLauncher } from "./AssistantLauncher";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function setup(buttons = ["Usar asistente IA"]) {
  document.documentElement.lang = "es";
  let allowed = buttons,
    createFails = false;
  const conversation = {
    public_id: "chat-1",
    title: "Consulta de materiales",
    language: "es",
    model: "test",
    status: "active",
    updated_at: null,
  };
  let exists = false,
    messages: unknown[] = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/mi-perfil"))
      return json({
        perfil: {
          username: "operador",
          nombre_completo: "Operador",
          rol: "operador",
        },
      });
    if (url.endsWith("/obtener_permisos_usuario_actual"))
      return json({
        usuario: "operador",
        rol: "operador",
        permisos: { MAIN_TEMPLATE: { "Asistente IA": allowed } },
      });
    if (url.endsWith("/bootstrap"))
      return json({
        success: true,
        configured: true,
        model: "test",
        can_generate_artifacts: true,
        can_audit: true,
        can_manage_limits: true,
      });
    if (url.includes("/conversations?"))
      return json({ conversations: exists ? [conversation] : [] });
    if (url.endsWith("/api/ai/conversations")) {
      if (createFails) return json({ error: "Error al crear chat" }, 503);
      exists = true;
      return json({ conversation });
    }
    if (url.includes("/messages?")) return json({ conversation, messages });
    if (url.endsWith("/artifacts")) return json({ artifacts: [] });
    if (url.endsWith("/upload"))
      return json({ filename: "stock.xlsx", file_ref: "file-stock" });
    if (url.endsWith("/messages/stream")) {
      const data = JSON.parse(String(init?.body));
      messages = [
        {
          id: 1,
          role: "user",
          content: data.content,
          status: "complete",
          client_message_id: data.client_message_id,
        },
        {
          id: 2,
          role: "assistant",
          content: "Inventario consultado",
          status: "complete",
        },
      ];
      return new Response(
        'event: ack\ndata: {"user_message_id":1,"assistant_message_id":2}\n\nevent: delta\ndata: {"text":"Inventario consultado"}\n\nevent: done\ndata: {"message_id":2}\n\n',
        { headers: { "content-type": "text/event-stream" } },
      );
    }
    if (url.endsWith("/chat-1") && init?.method === "DELETE") {
      exists = false;
      return json({ success: true });
    }
    if (url.endsWith("/chat-1") && init?.method === "PATCH") {
      Object.assign(conversation, JSON.parse(String(init.body)));
      return json({ conversation });
    }
    if (url.includes("/audit/conversations?"))
      return json({ conversations: [] });
    if (url.endsWith("/audit/limits")) return json({ limits: [] });
    throw new Error("Unexpected " + url);
  });
  vi.stubGlobal("fetch", fetcher);
  const client = createQueryClient();
  render(
    <MemoryRouter initialEntries={["/material/materiales"]}>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <AssistantLauncher />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return {
    client,
    fetcher,
    revoke: () => {
      allowed = [];
      return client.invalidateQueries({
        queryKey: ["permission", "live:operador"],
      });
    },
    failCreate: () => {
      createFails = true;
    },
  };
}
async function open() {
  await userEvent.click(
    await screen.findByRole("button", { name: "Abrir asistente IA" }),
  );
  await screen.findByRole("textbox", { name: "Mensaje" });
  return screen.getByRole("dialog", { name: "Asistente IA" });
}
describe("global assistant", () => {
  it("keeps the launcher and all AI traffic hidden without its exact permission", async () => {
    const view = setup([]);
    await waitFor(() =>
      expect(
        view.client.getQueryData(["permission", "live:operador"]),
      ).toBeDefined(),
    );
    expect(
      screen.queryByRole("button", { name: "Abrir asistente IA" }),
    ).toBeNull();
    expect(
      view.fetcher.mock.calls.some(([url]) => url.includes("/api/ai/")),
    ).toBe(false);
  });
  it("defers AI reads until opened and gates audit and quotas independently", async () => {
    const view = setup();
    await screen.findByRole("button", { name: "Abrir asistente IA" });
    expect(
      view.fetcher.mock.calls.some(([url]) => url.includes("/api/ai/")),
    ).toBe(false);
    const dialog = await open();
    expect(within(dialog).queryByRole("tab", { name: "Auditoría" })).toBeNull();
    expect(within(dialog).queryByRole("tab", { name: "Cuotas" })).toBeNull();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Mensaje" }),
      "Consulta stock",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Enviar" }),
    );
    await screen.findByText("Inventario consultado");
    expect(
      view.fetcher.mock.calls.filter(([url]) =>
        url.endsWith("/messages/stream"),
      ),
    ).toHaveLength(1);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cerrar ventana" }),
    );
    await open();
    expect(screen.getByText("Inventario consultado")).toBeVisible();
  });
  it("preserves draft and uploaded references when creating a new chat fails", async () => {
    const view = setup();
    const dialog = await open();
    const file = new File(["data"], "stock.xlsx");
    await userEvent.upload(
      within(dialog).getByLabelText("Adjuntar archivos", { selector: "input" }),
      file,
    );
    await screen.findByText("stock.xlsx");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Mensaje" }),
      "Mi captura",
    );
    view.failCreate();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Nuevo chat" }),
    );
    await screen.findByText("Error al crear chat");
    expect(
      within(dialog).getByRole("textbox", { name: "Mensaje" }),
    ).toHaveValue("Mi captura");
    expect(within(dialog).getByText("stock.xlsx")).toBeVisible();
  });
  it("uses one upload path for pasted files and sends the uploaded reference", async () => {
    const view = setup();
    const dialog = await open();
    fireEvent.paste(within(dialog).getByRole("textbox", { name: "Mensaje" }), {
      clipboardData: { files: [new File(["data"], "stock.xlsx")] },
    });
    await screen.findByText("stock.xlsx");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Enviar" }),
    );
    await screen.findByText("Inventario consultado");
    const call = view.fetcher.mock.calls.find(([url]) =>
      url.endsWith("/messages/stream"),
    )!;
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({
      file_ref: "file-stock",
      file_refs: ["file-stock"],
      page_context: { path: "/material/materiales" },
    });
  });
  it("requires confirmation before deleting a stored conversation", async () => {
    const view = setup();
    const dialog = await open();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Mensaje" }),
      "Consulta",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Enviar" }),
    );
    await screen.findByText("Inventario consultado");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Eliminar" }),
    );
    expect(
      view.fetcher.mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);
    const confirm = screen.getByRole("dialog", { name: "Eliminar" });
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Eliminar" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Eliminar" })).toBeNull(),
    );
    expect(
      view.fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE"),
    ).toHaveLength(1);
  });
  it("removes the open panel and private caches when permission is revoked", async () => {
    const view = setup();
    await open();
    await act(() => view.revoke());
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Asistente IA" })).toBeNull(),
    );
    expect(
      view.client
        .getQueryCache()
        .findAll({ queryKey: assistantKeys.all("live:operador") }),
    ).toEqual([]);
  });
  it("keeps a response alive while hidden and aborts it when permission is revoked", async () => {
    const view = setup();
    const original = view.fetcher.getMockImplementation()!;
    let signal!: AbortSignal;
    view.fetcher.mockImplementation(async (url, init) => {
      if (!url.endsWith("/messages/stream")) return original(url, init);
      signal = init!.signal!;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'event: ack\ndata: {"user_message_id":1,"assistant_message_id":2}\n\nevent: delta\ndata: {"text":"Respuesta parcial"}\n\n',
              ),
            );
            signal.addEventListener(
              "abort",
              () => controller.error(new DOMException("Closed", "AbortError")),
              { once: true },
            );
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      );
    });
    const dialog = await open();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Mensaje" }),
      "Consulta",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Enviar" }),
    );
    await screen.findByText("Respuesta parcial");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cerrar ventana" }),
    );
    expect(signal.aborted).toBe(false);
    await open();
    expect(screen.getByText("Respuesta parcial")).toBeVisible();
    await act(() => view.revoke());
    await waitFor(() => expect(signal.aborted).toBe(true));
    expect(screen.queryByRole("dialog", { name: "Asistente IA" })).toBeNull();
  });
  it("shows administrator tabs and preserves zero and inherited quota limits", async () => {
    const view = setup([
      "Usar asistente IA",
      "Auditar conversaciones IA",
      "Administrar cuotas IA",
    ]);
    const dialog = await open();
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Auditoría" }),
    );
    await screen.findByRole("textbox", { name: "Usuario" });
    await userEvent.click(within(dialog).getByRole("tab", { name: "Cuotas" }));
    expect(
      await screen.findByRole("button", { name: "Guardar" }),
    ).toBeVisible();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Usuario / rol" }),
      "qa",
    );
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "Solicitudes / día" }),
      "0",
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(
        view.fetcher.mock.calls.some(
          ([url, init]) =>
            url.endsWith("/audit/limits") && init?.method === "PATCH",
        ),
      ).toBe(true),
    );
    const call = view.fetcher.mock.calls.find(
      ([url, init]) =>
        url.endsWith("/audit/limits") && init?.method === "PATCH",
    )!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      subject_type: "user",
      subject_key: "qa",
      daily_request_limit: 0,
      daily_token_limit: null,
      daily_artifact_limit: null,
    });
  });
});
