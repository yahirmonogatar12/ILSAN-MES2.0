import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

async function filters(page: Page): Promise<Locator> {
  const compact = page.getByRole("button", { name: /^Filtros(?: \(\d+\))?$/ });
  if (await compact.isVisible()) {
    await compact.click();
    return page.getByRole("dialog", { name: "Filtros", exact: true });
  }
  return page.locator(".table-toolbar");
}
async function layout(page: Page) {
  const bounds = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
  }));
  expect(bounds.width).toBe(bounds.viewportWidth);
  expect(bounds.height).toBe(bounds.viewportHeight);
  const composer = page.locator(".assistant-composer");
  if (await composer.isVisible()) {
    const box = await composer.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(bounds.viewportHeight);
  }
}
async function projection(page: Page) {
  if (
    await page
      .getByRole("button", { name: "Abrir menú", exact: true })
      .isVisible()
  ) {
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Sección", exact: true })
      .selectOption("produccion");
  } else {
    await page
      .getByRole("navigation", { name: "Secciones del MES" })
      .getByRole("link", { name: "Control de producción" })
      .click();
  }
  await page
    .getByRole("complementary", { name: "Navegación principal" })
    .getByRole("link", { name: "Proyeccion", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Proyección P/S/I" }),
  ).toBeVisible();
}
test("filters, pagination, column filters and exports stay inside the viewport", async ({
  page,
  mes,
}) => {
  await page.goto("/material/materiales");
  const table = page.getByRole("table", { name: "Materiales registrados" });
  await expect(table).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Filas por página" }),
  ).toHaveValue("500");
  await page
    .getByRole("button", { name: "Página siguiente", exact: true })
    .click();
  await expect(
    table.getByRole("button", { name: "QA-501", exact: true }),
  ).toBeVisible();
  const form = await filters(page);
  await form
    .getByRole("searchbox", { name: "Buscar materiales" })
    .fill("QA-001");
  await form.getByRole("button", { name: "Consultar", exact: true }).click();
  if (
    await page.getByRole("dialog", { name: "Filtros", exact: true }).isVisible()
  )
    await page
      .getByRole("dialog", { name: "Filtros", exact: true })
      .getByRole("button", { name: "Cerrar ventana" })
      .click();
  await expect(
    table.getByRole("button", { name: "QA-001", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Filtrar CLASIFICACIÓN", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Buscar valores de CLASIFICACIÓN" })
    .fill("SMD");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(table.getByText("SMD", { exact: true }).first()).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar Excel", exact: true })
    .click();
  expect((await downloadEvent).suggestedFilename()).toBe("materials.xlsx");
  expect(
    mes.calls.some((call) => call.path.endsWith("/control_material/export")),
  ).toBe(true);
  await layout(page);
});
test("workspace tabs retain filters and close through the shared tab controls", async ({
  page,
  mes,
}) => {
  await page.goto("/material/materiales");
  await expect(
    page.getByRole("table", { name: "Materiales registrados" }),
  ).toBeVisible();
  const form = await filters(page);
  await form
    .getByRole("searchbox", { name: "Buscar materiales" })
    .fill("QA-007");
  await form.getByRole("button", { name: "Consultar", exact: true }).click();
  if (
    await page.getByRole("dialog", { name: "Filtros", exact: true }).isVisible()
  )
    await page
      .getByRole("dialog", { name: "Filtros", exact: true })
      .getByRole("button", { name: "Cerrar ventana" })
      .click();
  await expect(
    page.getByRole("button", { name: "QA-007", exact: true }),
  ).toBeVisible();
  await projection(page);
  await page
    .getByRole("tab", { name: "Control de material", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "QA-007", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar Proyeccion", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Proyeccion", exact: true }),
  ).toHaveCount(0);
  expect(
    mes.calls.some((call) => call.path === "/api/part-planning/plan"),
  ).toBe(true);
  await layout(page);
});
test("projection saves directly in cells and preserves zero and blank schedules", async ({
  page,
  mes,
}) => {
  await page.goto("/produccion/proyeccion");
  const table = page.getByRole("table", { name: "Proyección P/S/I" });
  await expect(table).toBeVisible();
  const inventory = table.getByRole("textbox", {
    name: "Editar LGEMM PLAN-001",
    exact: true,
  });
  await inventory.scrollIntoViewIfNeeded();
  await inventory.fill("-5");
  await inventory.press("Enter");
  await expect
    .poll(() =>
      mes.calls.filter(
        (call) => call.path === "/api/part-planning/inventory/field",
      ),
    )
    .toHaveLength(1);
  const schedule = table.getByRole("textbox", {
    name: "Editar schedule PLAN-001 " + mes.date,
    exact: true,
  });
  await schedule.scrollIntoViewIfNeeded();
  await schedule.fill("0");
  await schedule.press("Enter");
  await expect
    .poll(
      () =>
        mes.calls.filter((call) => call.path === "/api/part-planning/schedule")
          .length,
    )
    .toBe(1);
  expect(
    mes.calls.find((call) => call.path === "/api/part-planning/schedule")?.body,
  ).toMatchObject({ sched_qty: 0, linea: "", turno: "DIA" });
  await expect(schedule).not.toHaveAttribute("readonly");
  await expect(schedule).toHaveValue("0");
  await schedule.fill("");
  await schedule.press("Tab");
  await expect
    .poll(
      () =>
        mes.calls.filter((call) => call.path === "/api/part-planning/schedule")
          .length,
    )
    .toBe(2);
  expect(
    mes.calls
      .filter((call) => call.path === "/api/part-planning/schedule")
      .at(-1)?.body?.sched_qty,
  ).toBeNull();
  await expect(schedule).toHaveValue("—");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await layout(page);
});
test("chat receives workspace context, survives tab changes and previews generated Excel", async ({
  page,
  mes,
}) => {
  await page.goto("/material/materiales");
  await expect(
    page.getByRole("table", { name: "Materiales registrados" }),
  ).toBeVisible();
  expect(
    mes.calls.filter((call) => call.path.startsWith("/api/ai")),
  ).toHaveLength(0);
  // Context must keep working when the workspace's presentation markup changes.
  await page.locator(".workspace-panel").evaluate((element) => {
    element.id = "changed-markup";
    element.removeAttribute("aria-labelledby");
  });
  await page.getByRole("button", { name: "Abrir asistente IA" }).click();
  const chat = page.getByRole("dialog", { name: "Asistente IA", exact: true });
  await chat
    .getByRole("textbox", { name: "Mensaje", exact: true })
    .fill("Consultar materiales");
  await chat.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    chat.getByText("Respuesta autorizada para Control de material.", {
      exact: true,
    }),
  ).toBeVisible();
  const first = mes.calls.find((call) =>
    call.path.endsWith("/messages/stream"),
  );
  expect(first?.body?.page_context).toMatchObject({
    container_id: "workspace-panel-materials",
    module_title: "Control de material",
  });
  await chat.getByRole("button", { name: "Vista previa", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Inventario de prueba",
    exact: true,
  });
  await expect(
    preview.getByRole("cell", { name: "QA-001", exact: true }),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Cerrar", exact: true }).click();
  await chat.getByRole("button", { name: "Cerrar ventana" }).click();
  await projection(page);
  await page.getByRole("button", { name: "Abrir asistente IA" }).click();
  await expect(
    chat.getByText("Respuesta autorizada para Control de material.", {
      exact: true,
    }),
  ).toBeVisible();
  await chat
    .getByRole("textbox", { name: "Mensaje", exact: true })
    .fill("Consultar proyección");
  await chat.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    chat.getByText("Respuesta autorizada para Proyeccion.", { exact: true }),
  ).toBeVisible();
  expect(
    mes.calls.filter((call) => call.path.endsWith("/messages/stream")).at(-1)
      ?.body?.page_context,
  ).toMatchObject({
    path: "/produccion/proyeccion",
    container_id: "workspace-panel-production-projection",
    module_title: "Proyeccion",
  });
  await layout(page);
});
test("assistant permission hides its launcher and malformed quotas show an error", async ({
  page,
  mes,
}) => {
  mes.allowAssistant = false;
  await page.goto("/material/materiales");
  await expect(
    page.getByRole("table", { name: "Materiales registrados" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir asistente IA" }),
  ).toHaveCount(0);
  expect(mes.calls.some((call) => call.path.startsWith("/api/ai"))).toBe(false);
  mes.allowAssistant = true;
  mes.invalidQuota = true;
  await page.reload();
  await page.getByRole("button", { name: "Abrir asistente IA" }).click();
  const chat = page.getByRole("dialog", { name: "Asistente IA", exact: true });
  await expect(chat.getByRole("alert")).toContainText("daily_token_limit");
  await expect(
    chat.getByRole("textbox", { name: "Mensaje", exact: true }),
  ).toHaveCount(0);
  await layout(page);
});
