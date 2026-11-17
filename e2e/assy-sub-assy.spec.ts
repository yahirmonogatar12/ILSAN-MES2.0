import { test as base, expect } from "./fixtures";

interface AssyFixture {
  rows: Record<string, unknown>[];
  reads: string[];
  writes: Record<string, unknown>[];
  orders: Record<string, unknown>[];
}
const test = base.extend<{ assy: AssyFixture }>({
  assy: async ({ page, mes }, use) => {
    mes.extraPermissions.LISTA_CONTROL_DE_PROCESO = {
      "Control de produccion": ["Control de produccion ASSY"],
    };
    const assy: AssyFixture = {
      rows: [null, "PCB-ANTERIOR"].map((sub_assy, index) => ({
        lot_no: "ASSY-BROWSER-00" + (index + 1),
        working_date: "2026-11-12",
        part_no: "ACQ-000" + (index + 1),
        sub_assy,
        model_code: "Modelo " + (index + 1),
        project: "Proyecto",
        line: "M1",
        routing: 1,
        group_no: 1,
        sequence: index + 1,
        plan_count: 100,
        uph: 1000,
        ct: 3.6,
        status: "PLAN",
      })),
      reads: [],
      writes: [],
      orders: [],
    };
    await page.route("**/backend/api/plan**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/backend/, "");
      const json = (data: unknown) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (path === "/api/plan" && request.method() === "GET") {
        assy.reads.push(url.search);
        return json(assy.rows);
      }
      if (path === "/api/plan/bom-revisions") return json({ data: [] });
      if (path === "/api/plan/save-sequences" && request.method() === "POST") {
        const payload = request.postDataJSON() as {
          sequences: Record<string, unknown>[];
        };
        assy.orders.push(payload);
        for (const sequence of payload.sequences)
          Object.assign(
            assy.rows.find((row) => row.lot_no === sequence.lot_no)!,
            sequence,
          );
        return json({ success: true });
      }
      if (path === "/api/plan/update" && request.method() === "POST") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        assy.writes.push(payload);
        Object.assign(
          assy.rows.find((row) => row.lot_no === payload.lot_no)!,
          payload,
        );
        return json({ success: true });
      }
      return route.fulfill({ status: 503, body: "Endpoint ASSY sin contrato" });
    });
    await use(assy);
  },
});

test("plan rows support editing, confirmed cancellation and saved drag ordering", async ({
  page,
  assy,
  isMobile,
}, testInfo) => {
  await page.goto("/proceso/produccion-assy");
  const table = page.getByRole("table", { name: "Planes ASSY" });
  const row = table.getByRole("row", {
    name: "Plan ASSY-BROWSER-001",
    exact: true,
  });
  await expect(row).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: "ACCIONES", exact: true }),
  ).toHaveCount(0);
  if (isMobile) {
    await row.tap();
    await row.tap();
  } else {
    await row.dblclick();
  }
  const editor = page.getByRole("dialog", {
    name: "Editar plan ASSY · ASSY-BROWSER-001",
    exact: true,
  });
  await expect(editor).toBeVisible();
  await editor.getByLabel(/^Cantidad del plan/).fill("125");
  await editor
    .getByRole("button", { name: "Cancelar plan", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Cancelar plan",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  expect(assy.writes).toHaveLength(0);
  await confirmation
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await expect(editor.getByLabel(/^Cantidad del plan/)).toHaveValue("125");
  await editor
    .getByRole("button", { name: "Cancelar plan", exact: true })
    .click();
  const bounds = await confirmation.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({ path: testInfo.outputPath("plan-cancellation.png") });
  await confirmation
    .getByRole("button", { name: "Cancelar plan", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(row).toHaveClass(/process-production-row-cancelled/);
  expect(assy.writes).toEqual([
    { lot_no: "ASSY-BROWSER-001", status: "CANCELADO" },
  ]);
  await row.focus();
  await row.press("Enter");
  await editor
    .getByRole("button", { name: "Reactivar plan", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Reactivar plan", exact: true })
    .getByRole("button", { name: "Reactivar plan", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(row).not.toHaveClass(/process-production-row-cancelled/);
  expect(assy.writes[1]).toEqual({
    lot_no: "ASSY-BROWSER-001",
    status: "PLAN",
  });
  if (!isMobile) {
    await row.dragTo(table.getByRole("row", { name: "GRUPO 2", exact: true }));
    await expect(
      page.getByText("Orden sin guardar.", { exact: true }),
    ).toBeVisible();
    expect(assy.orders).toHaveLength(0);
    await row.dblclick();
    await expect(editor).toHaveCount(0);
    await page
      .getByRole("button", { name: "Guardar orden", exact: true })
      .click();
    await expect(
      page.getByText("Orden sin guardar.", { exact: true }),
    ).toHaveCount(0);
    expect(assy.orders).toHaveLength(1);
    expect(assy.rows[0]).toMatchObject({ group_no: 2, sequence: 1 });
  }
  expect(
    await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]),
  ).toEqual([viewport.width, viewport.height]);
  await page.screenshot({ path: testInfo.outputPath("plan-rows.png") });
});

test("each ASSY editor reloads its current PCB from RAW while preserving unsaved fields", async ({
  page,
  assy,
}, testInfo) => {
  await page.goto("/proceso/produccion-assy");
  const table = page.getByRole("table", { name: "Planes ASSY" });
  await expect(table).toBeVisible();
  await table
    .getByRole("row", { name: "Plan ASSY-BROWSER-001", exact: true })
    .dblclick();
  const modal = page.getByRole("dialog", {
    name: "Editar plan ASSY · ASSY-BROWSER-001",
    exact: true,
  });
  await expect(modal.getByLabel("Sub-assy / PCB", { exact: true })).toHaveValue(
    "",
  );
  await modal.getByLabel(/^Cantidad del plan/).fill("125");
  await modal.getByLabel("Modelo", { exact: true }).fill("Modelo capturado");
  assy.rows[0].sub_assy = "EBR0001/A+02&B";
  await modal
    .getByRole("button", { name: "Recargar sub-assy", exact: true })
    .click();
  await expect(modal.getByLabel("Sub-assy / PCB", { exact: true })).toHaveValue(
    "EBR0001/A+02&B",
  );
  await expect(modal.getByLabel(/^Cantidad del plan/)).toHaveValue("125");
  await expect(modal.getByLabel("Modelo", { exact: true })).toHaveValue(
    "Modelo capturado",
  );
  expect(assy.writes).toEqual([]);
  expect(assy.reads).toHaveLength(2);
  expect(assy.reads[1]).toBe(assy.reads[0]);
  await modal
    .getByLabel("Sub-assy / PCB", { exact: true })
    .scrollIntoViewIfNeeded();
  const bounds = await modal.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({ path: testInfo.outputPath("assy-sub-assy.png") });
  await modal
    .getByRole("button", { name: "Guardar plan", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  expect(assy.writes).toHaveLength(1);
  expect(assy.writes[0]).toMatchObject({
    lot_no: "ASSY-BROWSER-001",
    plan_count: 125,
    model_code: "Modelo capturado",
  });
  expect(assy.writes[0]).not.toHaveProperty("sub_assy");
  await expect(
    table.getByRole("row").filter({ hasText: "ASSY-BROWSER-001" }),
  ).toContainText("EBR0001/A+02&B");
  await table
    .getByRole("row", { name: "Plan ASSY-BROWSER-002", exact: true })
    .dblclick();
  const second = page.getByRole("dialog", {
    name: "Editar plan ASSY · ASSY-BROWSER-002",
    exact: true,
  });
  await expect(
    second.getByLabel("Sub-assy / PCB", { exact: true }),
  ).toHaveValue("PCB-ANTERIOR");
  assy.rows[1].sub_assy = "PCB-ACTUALIZADA";
  await second
    .getByRole("button", { name: "Recargar sub-assy", exact: true })
    .click();
  await expect(
    second.getByLabel("Sub-assy / PCB", { exact: true }),
  ).toHaveValue("PCB-ACTUALIZADA");
  await second.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    table.getByRole("row").filter({ hasText: "ASSY-BROWSER-002" }),
  ).toContainText("PCB-ACTUALIZADA");
  expect(assy.writes).toHaveLength(1);
  expect(
    await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]),
  ).toEqual([viewport.width, viewport.height]);
});
