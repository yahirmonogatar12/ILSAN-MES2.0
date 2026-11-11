import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import { createLedgerApi } from "./api";
import { historyDefaults, inventoryDefaults, todayIso } from "./config";
import { csvCell, displayValue, inventoryParams, validateDates } from "./model";
afterEach(() => vi.restoreAllMocks());
function json(value: unknown, status = 200) {
  const fetcher = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const response = {
  data: [{ numero_parte: "PARTE-01-A", cantidad_actual: 0 }],
  total: 1200,
  limit: 500,
  offset: 500,
};
describe("contratos de historiales e inventario de material", () => {
  it.each(["entradas", "salidas", "retornos"] as const)(
    "consulta %s con fechas, búsqueda, filtro remoto y offset global",
    async (kind) => {
      const fetcher = json(response),
        signal = new AbortController().signal;
      const result = await createLedgerApi("live").history(
        kind,
        {
          fecha_inicio: "2026-11-01",
          fecha_fin: "2026-11-05",
          texto: "MAT/26-0001 & A",
        },
        { numero_parte: "PARTE-01-A" },
        2,
        500,
        signal,
      );
      const [url, init] = fetcher.mock.calls[0],
        parsed = new URL(url, "http://localhost");
      expect(parsed.pathname).toBe(
        `/backend/api/material_admin/history/${kind}`,
      );
      expect(Object.fromEntries(parsed.searchParams)).toEqual({
        fecha_inicio: "2026-11-01",
        fecha_fin: "2026-11-05",
        texto: "MAT/26-0001 & A",
        cf_numero_parte: "PARTE-01-A",
        limit: "500",
        offset: "500",
      });
      expect(init?.signal).toBe(signal);
      expect(result.data[0].cantidad_actual).toBe(0);
    },
  );
  it("consulta lotes sin perder versión, etiqueta con barras, booleanos ni periodo", async () => {
    const fetcher = json(response);
    await createLedgerApi("live").lots(
      {
        ...inventoryDefaults(),
        numero_parte: "PARTE-01-A",
        codigo_material_recibido: "MAT/26-0001",
        ubicacion: "RACK-A",
        include_zero_stock: "true",
        only_na: "true",
        use_dates: "true",
        fecha_inicio: "2026-11-01",
        fecha_fin: "2026-11-05",
      },
      { in_quarantine: "Sí", stock_actual: "0" },
      2,
      500,
    );
    const parsed = new URL(fetcher.mock.calls[0][0], "http://localhost");
    expect(parsed.pathname).toBe("/backend/api/material_admin/inventory/lots");
    expect(Object.fromEntries(parsed.searchParams)).toMatchObject({
      numero_parte: "PARTE-01-A",
      codigo_material_recibido: "MAT/26-0001",
      include_zero_stock: "true",
      only_na: "true",
      fecha_inicio: "2026-11-01",
      fecha_fin: "2026-11-05",
      cf_in_quarantine: "Si",
      cf_stock_actual: "0",
      limit: "500",
      offset: "500",
    });
  });
  it("el resumen omite captura de lotes y fechas cuando se consulta inventario actual", async () => {
    const fetcher = json([
      { numero_parte: "PARTE-01-A", version: "01-A", stock_total: 0 },
    ]);
    const rows = await createLedgerApi("live").summary({
      ...inventoryDefaults(),
      codigo_material_recibido: "OCULTA",
      only_na: "true",
      numero_parte: "PARTE-01-A",
    });
    const params = new URL(fetcher.mock.calls[0][0], "http://localhost")
      .searchParams;
    expect(Object.fromEntries(params)).toEqual({ numero_parte: "PARTE-01-A" });
    expect(rows[0]).toMatchObject({ version: "01-A", stock_total: 0 });
  });
  it("exporta la consulta completa con filtros remotos, sin limitarse a la página visible", async () => {
    const download = vi.spyOn(http, "downloadFile").mockResolvedValue();
    const api = createLedgerApi("live");
    await api.exportHistory(
      "retornos",
      { fecha_inicio: "2026-11-01", fecha_fin: "2026-11-05", texto: "MAT/26" },
      { descripcion_motivo: "Sobrante" },
    );
    let url = new URL(download.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/material_admin/history/retornos/export");
    expect(url.searchParams.get("cf_descripcion_motivo")).toBe("Sobrante");
    expect(url.searchParams.has("limit")).toBe(false);
    expect(url.searchParams.has("offset")).toBe(false);
    await api.exportInventory(
      "detail",
      { ...inventoryDefaults(), numero_parte: "PARTE-01-A", only_na: "true" },
      { numero_lote: "N/A" },
    );
    url = new URL(download.mock.calls[1][0], "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      view: "detail",
      numero_parte: "PARTE-01-A",
      only_na: "true",
      cf_numero_lote: "N/A",
    });
    expect(url.searchParams.has("limit")).toBe(false);
  });
  it("rechaza datos/paginación inválidos y propaga el permiso denegado sin reintento", async () => {
    json({ ...response, total: -1 });
    await expect(
      createLedgerApi("live").history(
        "entradas",
        historyDefaults(),
        {},
        1,
        500,
      ),
    ).rejects.toThrow(/paginación/);
    json([{ stock_total: { invalid: 1 } }]);
    await expect(
      createLedgerApi("live").summary(inventoryDefaults()),
    ).rejects.toThrow(/registros de material/);
    const fetcher = json({ error: "Sin permiso de inventario" }, 403);
    await expect(
      createLedgerApi("live").lots(inventoryDefaults(), {}, 1, 500),
    ).rejects.toThrow("Sin permiso de inventario");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("la demostración filtra antes de paginar y puede encontrar un resultado fuera de la primera página", async () => {
    const fetcher = vi.fn(() => {
      throw new Error("Sin HTTP en demo");
    });
    vi.stubGlobal("fetch", fetcher);
    const api = createLedgerApi("demo"),
      filters = historyDefaults();
    const first = await api.history("entradas", filters, {}, 1, 10);
    expect(first.total).toBeGreaterThan(10);
    const last = await api.history(
      "entradas",
      filters,
      { numero_invoice: "INV-24" },
      1,
      500,
    );
    expect(last.total).toBe(1);
    expect(last.data[0].numero_invoice).toBe("INV-24");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("conserva cero, costo a cuatro decimales, booleanos y valida periodos completos", () => {
    expect(displayValue(0, "cantidad_actual")).toBe("0");
    expect(displayValue(0, "costo_unitario")).toBe("0.0000");
    expect(displayValue(1, "in_quarantine")).toBe("Sí");
    expect(displayValue(false, "cancelado")).toBe("No");
    expect(validateDates("2026-11-05", "2026-11-01")).toMatch(/posterior/);
    expect(validateDates("", "2026-11-05", true)).toMatch(/ambas/);
    expect(todayIso(new Date(2026, 10, 5, 23, 30))).toBe("2026-11-05");
    expect(csvCell("=FORMULA()")).toBe('"\'=FORMULA()"');
    expect(
      inventoryParams("summary", inventoryDefaults(), { stock_total: "0" }).has(
        "cf_stock_total",
      ),
    ).toBe(false);
  });
});
