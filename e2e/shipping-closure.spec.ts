import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test as base, expect } from "./fixtures";

interface ClosureRequest {
  action: string;
  body: string;
}
const test = base.extend<{ closure: { requests: ClosureRequest[] } }>({
  closure: async ({ page, mes }, use) => {
    mes.extraPermissions.LISTA_CONTROL_DE_PROCESO = {
      "Almacén de Embarques": ["Inventario general embarques"],
    };
    const requests: ClosureRequest[] = [];
    const workbook = await readFile(
      new URL("./fixtures/materials.xlsx", import.meta.url),
    );
    const metadata = {
      closureDate: "2026-12-12",
      closureUser: "Usuario de pruebas",
      closureMonthLabel: "Noviembre 2026",
    };
    const inventory = Array.from({ length: 1033 }, (_, index) => ({
      part_number: "CLOSE-" + String(index + 1).padStart(4, "0"),
      product_model: "Modelo " + (index + 1),
      current_quantity: index % 5,
      initial_quantity: index % 5,
      customer: "ILS",
      entries_qty: 0,
      exits_qty: 0,
      return_entries_qty: 0,
      return_exits_qty: 0,
    }));
    const baseline = inventory.map((row) => ({
      ...row,
      system_quantity: row.current_quantity,
      csv_current_qty: null,
      difference_quantity: null,
      applied_initial_quantity: null,
      status: "pendiente",
    }));
    const comparison = inventory.map((row, index) => ({
      ...row,
      system_quantity: row.current_quantity,
      csv_current_qty: row.current_quantity + (index % 2),
      difference_quantity: index % 2,
      applied_initial_quantity: row.current_quantity + (index % 2),
      status: index % 2 ? "diferencia" : "igual",
    }));
    const history = [
      {
        id: 44,
        closure_label: "CIERRE-2026-10",
        closure_month: "2026-10",
        closed_at: "2026-11-01",
        confirmed_by: "Supervisor",
        created_by: "Supervisor",
        status: "confirmed",
        accuracy_pct: 100,
      },
    ];
    const payload = {
      rows: comparison,
      summary: { accuracyPct: 50.05, totalRows: 1033, differenceRows: 516 },
      metadata,
    };
    await page.route("**/backend/api/almacen-embarques/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      const action = path.split("/cierre/")[1] ?? "inventory";
      requests.push({ action, body: request.postData() ?? "" });
      const json = (data: unknown) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (action === "inventory")
        return json({
          rows: inventory,
          summary: { totalRows: inventory.length },
          metadata: {},
        });
      if (action === "bootstrap")
        return json({
          success: true,
          metadata,
          preview: { rows: baseline, summary: { accuracyPct: 0 } },
          history,
        });
      if (action === "template")
        return route.fulfill({
          contentType: "text/csv",
          headers: {
            "Content-Disposition":
              'attachment; filename="plantilla-cierre.csv"',
          },
          body:
            "part_number,current_qty\n" +
            inventory.map((row) => row.part_number + ",0").join("\n"),
        });
      if (action === "preview") {
        if (requests.at(-1)!.body.includes("invalid.csv"))
          return json({
            success: true,
            valid: false,
            errors: ["El CSV debe contener todas las partes del catálogo."],
            metadata,
            preview: { rows: baseline, summary: {} },
            history,
          });
        history.unshift({
          id: 46,
          closure_label: "CIERRE-2026-11",
          closure_month: "2026-11",
          closed_at: metadata.closureDate,
          confirmed_by: "",
          created_by: metadata.closureUser,
          status: "draft",
          accuracy_pct: 50.05,
        });
        return json({
          success: true,
          valid: true,
          batchId: 46,
          batchCode: "CIERRE-2026-11",
          preview: payload,
          metadata,
          history,
        });
      }
      if (action === "confirm" || action === "cancel") {
        const data = JSON.parse(request.postData()!) as { batchId: number };
        const batch = history.find((row) => row.id === data.batchId)!;
        batch.status = action === "confirm" ? "confirmed" : "cancelled";
        return json({
          success: true,
          message:
            action === "confirm"
              ? "Cierre confirmado correctamente."
              : "Preview cancelado correctamente.",
          history,
        });
      }
      if (action.endsWith("/export"))
        return route.fulfill({
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          headers: {
            "Content-Disposition":
              'attachment; filename="cierre-embarques.xlsx"',
          },
          body: workbook,
        });
      if (action.startsWith("history/")) {
        const id = Number(action.split("/")[1]),
          batch = history.find((row) => row.id === id)!;
        return json({
          success: true,
          batch,
          payload: {
            ...payload,
            metadata:
              id === 44
                ? {
                    closureDate: "2026-11-01",
                    closureMonthLabel: "Octubre 2026",
                  }
                : metadata,
          },
        });
      }
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Endpoint de cierre sin contrato"}',
      });
    });
    await use({ requests });
  },
});
async function openClosure(page: Page) {
  const picker = page.getByRole("combobox", {
    name: "Acciones de almacén",
    exact: true,
  });
  if (await picker.isVisible()) await picker.selectOption("closure");
  else
    await page
      .getByRole("button", { name: "Cierre de inventario", exact: true })
      .click();
  const view = page.getByRole("region", {
    name: "Cierre de inventario de embarques",
    exact: true,
  });
  await expect(view.getByLabel("Mes del cierre", { exact: true })).toHaveValue(
    "Noviembre 2026",
  );
  return view;
}
function physicalFile(name = "conteo.csv") {
  return {
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(
      "part_number,current_qty\n" +
        Array.from(
          { length: 1033 },
          (_, index) =>
            "CLOSE-" +
            String(index + 1).padStart(4, "0") +
            "," +
            ((index % 5) + (index % 2)),
        ).join("\n"),
    ),
  };
}
test("shipping closure matches the inline original and confirms the validated batch", async ({
  page,
  closure,
}, testInfo) => {
  await page.goto("/proceso/embarques/inventario");
  await expect(
    page.getByRole("table", { name: "Inventario general embarques" }),
  ).toBeVisible();
  const compactFilters = page.getByRole("button", {
    name: /^Filtros(?: \(\d+\))?$/,
  });
  if (await compactFilters.isVisible()) await compactFilters.click();
  await page
    .getByRole("searchbox", { name: "No. parte", exact: true })
    .fill("CLOSE");
  const filterDialog = page.getByRole("dialog", {
    name: "Filtros",
    exact: true,
  });
  if (await filterDialog.isVisible())
    await filterDialog.getByRole("button", { name: "Cerrar ventana" }).click();
  const view = await openClosure(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    view.getByRole("heading", { name: "Datos del cierre" }),
  ).toBeVisible();
  await expect(view.getByLabel("Usuario", { exact: true })).toHaveValue(
    "Usuario de pruebas",
  );
  await expect(
    view.getByRole("img", { name: "Accuracy 0%", exact: true }),
  ).toBeVisible();
  const preview = view.getByRole("region", {
    name: "Preview del cierre",
    exact: true,
  });
  await expect(
    preview.getByRole("combobox", { name: "Filas por página" }),
  ).toHaveValue("500");
  await expect(
    view.getByRole("button", { name: "Confirmar cierre", exact: true }),
  ).toBeDisabled();
  const templateEvent = page.waitForEvent("download");
  await view
    .getByRole("button", { name: "Descargar plantilla", exact: true })
    .click();
  expect((await templateEvent).suggestedFilename()).toBe(
    "plantilla-cierre.csv",
  );
  await view
    .getByLabel("CSV de inventario físico")
    .setInputFiles(physicalFile());
  await view
    .getByRole("button", { name: "Validar preview", exact: true })
    .click();
  await expect(
    view.getByRole("button", { name: "Confirmar cierre", exact: true }),
  ).toBeEnabled();
  const gauge = view.getByRole("img", { name: "Accuracy 50.05%", exact: true });
  await expect(gauge).toBeVisible();
  expect(
    await gauge.evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    ),
  ).toContain("conic-gradient");
  const previewScroll = preview.locator(".table-overflow");
  await previewScroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const lastRow = preview.getByRole("row").filter({ hasText: "CLOSE-0500" });
  await expect(lastRow).toBeVisible();
  expect(
    await lastRow.evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(38);
  expect(await preview.locator("tbody tr").count()).toBeLessThan(60);
  await preview
    .getByRole("button", { name: "Página siguiente", exact: true })
    .click();
  await expect(
    preview.getByRole("cell", { name: "CLOSE-0501", exact: true }),
  ).toBeVisible();
  await view
    .getByRole("button", { name: "Confirmar cierre", exact: true })
    .click();
  await expect(
    view.getByRole("button", { name: "Confirmar cierre", exact: true }),
  ).toBeDisabled();
  await expect(gauge).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar notificación", exact: true })
    .click();
  expect(
    closure.requests
      .filter((call) => call.action === "confirm")
      .map((call) => JSON.parse(call.body)),
  ).toEqual([{ batchId: 46 }]);
  const history = view.getByRole("region", {
    name: "Historial de cierres",
    exact: true,
  });
  const row = history.getByRole("row").filter({ hasText: "CIERRE-2026-11" });
  await expect(
    row.getByRole("button", { name: "Excel", exact: true }),
  ).toBeEnabled();
  const reportEvent = page.waitForEvent("download");
  await row.getByRole("button", { name: "Excel", exact: true }).click();
  expect((await reportEvent).suggestedFilename()).toBe("cierre-embarques.xlsx");
  await history
    .getByRole("row")
    .filter({ hasText: "CIERRE-2026-10" })
    .getByRole("button", { name: "Ver", exact: true })
    .click();
  await expect(view.getByLabel("Mes del cierre", { exact: true })).toHaveValue(
    "Octubre 2026",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await view
    .getByRole("heading", { name: "Datos del cierre" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("closure-inline.png") });
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("closure-preview.png") });
  await history.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("closure-history.png") });
  const size = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.scrollHeight,
    innerWidth,
    innerHeight,
  ]);
  expect(size.slice(0, 2)).toEqual(size.slice(2));
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const dateBounds = await view
      .getByLabel("Fecha", { exact: true })
      .boundingBox();
    const actionBounds = await view
      .getByRole("button", { name: "Confirmar cierre", exact: true })
      .boundingBox();
    expect(dateBounds!.y).toBe(actionBounds!.y);
    const wideSize = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]);
    expect(wideSize).toEqual([1920, 1080]);
    await page.screenshot({ path: testInfo.outputPath("closure-wide.png") });
  }
  await view
    .getByRole("button", { name: "Regresar a inventario", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Inventario general embarques" }),
  ).toBeVisible();
  if (await compactFilters.isVisible()) await compactFilters.click();
  await expect(
    page.getByRole("searchbox", { name: "No. parte", exact: true }),
  ).toHaveValue("CLOSE");
});
test("shipping closure resets a draft and blocks confirmation of an invalid or changed CSV", async ({
  page,
  closure,
}) => {
  await page.goto("/proceso/embarques/inventario");
  await expect(
    page.getByRole("table", { name: "Inventario general embarques" }),
  ).toBeVisible();
  const view = await openClosure(page);
  await view
    .getByLabel("CSV de inventario físico")
    .setInputFiles(physicalFile("invalid.csv"));
  await view
    .getByRole("button", { name: "Validar preview", exact: true })
    .click();
  await expect(
    view.getByText("El CSV debe contener todas las partes del catálogo.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    view.getByRole("button", { name: "Confirmar cierre", exact: true }),
  ).toBeDisabled();
  await view
    .getByLabel("CSV de inventario físico")
    .setInputFiles(physicalFile());
  await view
    .getByRole("button", { name: "Validar preview", exact: true })
    .click();
  await expect(
    view.getByRole("button", { name: "Confirmar cierre", exact: true }),
  ).toBeEnabled();
  await view
    .getByLabel("CSV de inventario físico")
    .setInputFiles(physicalFile("nuevo.csv"));
  await expect(
    view.getByRole("button", { name: "Confirmar cierre", exact: true }),
  ).toBeDisabled();
  await view
    .getByRole("button", { name: "Reiniciar carga", exact: true })
    .click();
  await expect(view.getByLabel("CSV de inventario físico")).toHaveValue("");
  await expect(
    view.getByRole("img", { name: "Accuracy 0%", exact: true }),
  ).toBeVisible();
  expect(
    closure.requests
      .filter((call) => call.action === "cancel")
      .map((call) => JSON.parse(call.body)),
  ).toEqual([{ batchId: 46 }]);
  expect(
    closure.requests.filter((call) => call.action === "confirm"),
  ).toHaveLength(0);
});
