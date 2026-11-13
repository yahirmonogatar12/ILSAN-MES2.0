import type { Page } from "@playwright/test";
import { test as base, expect } from "./fixtures";

interface RecoveryFixture {
  status: "streaming" | "complete";
  posts: Record<string, unknown>[];
}
const test = base.extend<{ recovery: RecoveryFixture }>({
  recovery: async ({ page, mes }, use) => {
    mes.allowAssistant = true;
    const state: RecoveryFixture = { status: "complete", posts: [] };
    const conversation = {
      public_id: "browser-chat",
      title: "Recuperación de prueba",
      language: "es",
      model: "Test",
      status: "active",
      updated_at: null,
    };
    await page.route(
      "**/backend/api/ai/conversations/browser-chat/messages**",
      async (route) => {
        const request = route.request();
        if (request.method() === "POST") {
          state.posts.push(request.postDataJSON() as Record<string, unknown>);
          const event = (name: string, data: unknown) =>
            "event: " + name + "\ndata: " + JSON.stringify(data) + "\n\n";
          return route.fulfill({
            contentType: "text/event-stream",
            body:
              event("ack", { user_message_id: 1, assistant_message_id: 2 }) +
              event("delta", { text: "Avance parcial del servidor." }),
          });
        }
        const original = state.posts[0];
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            conversation,
            messages: original
              ? [
                  {
                    id: 1,
                    role: "user",
                    client_message_id: original.client_message_id,
                    content: original.content,
                    status: "complete",
                  },
                  {
                    id: 2,
                    role: "assistant",
                    content:
                      state.status === "complete"
                        ? "Respuesta original recuperada."
                        : "",
                    status: state.status,
                  },
                ]
              : [],
          }),
        });
      },
    );
    await use(state);
  },
});
async function openChat(page: Page) {
  await page.goto("/material/materiales");
  await expect(
    page.getByRole("table", { name: "Materiales registrados" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir asistente IA" }).click();
  const chat = page.getByRole("dialog", { name: "Asistente IA", exact: true });
  await chat
    .getByRole("textbox", { name: "Mensaje", exact: true })
    .fill("Recuperar mi consulta");
  await chat.getByRole("button", { name: "Enviar", exact: true }).click();
  return chat;
}
test("retry retrieves the completed original response with one stream request", async ({
  page,
  recovery,
}) => {
  const chat = await openChat(page);
  await chat.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    chat.getByText("Respuesta original recuperada.", { exact: true }),
  ).toBeVisible();
  await expect(
    chat.getByRole("button", { name: "Reintentar", exact: true }),
  ).toHaveCount(0);
  expect(recovery.posts).toHaveLength(1);
  await expect(
    chat.getByText("Recuperar mi consulta", { exact: true }),
  ).toHaveCount(1);
});
test("retry checks an in-progress original and later recovers it without another POST", async ({
  page,
  recovery,
}) => {
  recovery.status = "streaming";
  const chat = await openChat(page);
  await chat.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    chat.getByText(
      "El servidor todavía está procesando la solicitud original. Reintenta para consultar su estado.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    chat.getByText("Avance parcial del servidor.", { exact: true }),
  ).toBeVisible();
  expect(recovery.posts).toHaveLength(1);
  recovery.status = "complete";
  await chat.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    chat.getByText("Respuesta original recuperada.", { exact: true }),
  ).toBeVisible();
  expect(recovery.posts).toHaveLength(1);
});
test("oversized Excel is rejected before loading the parser", async ({
  page,
  mes,
}, testInfo) => {
  mes.allowAssistant = true;
  const vendor: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/vendor/xlsx")) vendor.push(request.url());
  });
  await page.route(
    "**/backend/api/ai/artifacts/browser-file/download",
    (route) =>
      route.fulfill({
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers: { "Content-Disposition": 'attachment; filename="large.xlsx"' },
        body: Buffer.alloc(20 * 1024 * 1024 + 1),
      }),
  );
  const chat = await openChat(page);
  await expect(
    chat.getByRole("button", { name: "Vista previa", exact: true }),
  ).toBeVisible();
  await chat.getByRole("button", { name: "Vista previa", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Inventario de prueba",
    exact: true,
  });
  await expect(
    preview.getByText(
      "La vista previa de Excel admite archivos con datos de hasta 20 MB.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(vendor).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("excel-size-limit.png") });
  await preview.getByRole("button", { name: "Cerrar", exact: true }).click();
});
