import { test as base, expect } from "./fixtures";

interface AssyFixture {
  rows: Record<string, unknown>[];
  reads: string[];
  writes: Record<string, unknown>[];
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

test("each ASSY editor reloads its current PCB from RAW while preserving unsaved fields", async ({
  page,
  assy,
}, testInfo) => {
  await page.goto("/proceso/produccion-assy");
  const table = page.getByRole("table", { name: "Planes ASSY" });
  await expect(table).toBeVisible();
  await table
    .getByRole("button", { name: "Editar ASSY-BROWSER-001", exact: true })
    .click();
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
    .getByRole("button", { name: "Editar ASSY-BROWSER-002", exact: true })
    .click();
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
  await second.getByRole("button", { name: "Cancelar", exact: true }).click();
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
