import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import * as spreadsheets from "@/shared/lib/spreadsheet";
import { createAreaApi } from "./api";
import { COLUMNS } from "./config";
import {
  dateIssue,
  decodeResult,
  decodeSearches,
  defaults,
  effectiveView,
  params,
  numberText,
  todayMexico,
} from "./model";
import type { AreaFilters, ConnectedArea } from "./types";
afterEach(() => vi.restoreAllMocks());
const payload = {
  success: true,
  rows: [{ part_no: "0001-A", salida: 0, stock: 1.5 }],
  total: 1101,
  piezas: 3001.5,
  page: 2,
  per_page: 500,
  total_pages: 3,
};
function response(value: unknown = payload) {
  const fetcher = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(value), {
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
describe("contratos de Material por áreas", () => {
  it("distingue cantidades vacías de cero sin redondear decimales", () => {
    expect(numberText(null)).toBe("");
    expect(numberText("")).toBe("");
    expect(numberText(0)).toBe("0");
    expect(numberText("1.1234567")).toBe("1.1234567");
  });
  it.each(["smd", "micom", "imd", "ipm"] as ConnectedArea[])(
    "consulta %s con paginación real, filtros remotos, abortos y stock sin fechas",
    async (area) => {
      const fetcher = response(),
        signal = new AbortController().signal;
      const result = await createAreaApi("live").list(
        area,
        { ...defaults(), start: "2099-01-01", end: "2099-12-31" },
        { part_no: "0001-A", stock: "1.5", codigo: "ajeno al modo general" },
        2,
        500,
        signal,
      );
      const [url, init] = fetcher.mock.calls[0],
        parsed = new URL(url, "http://local");
      expect(parsed.pathname).toBe(`/backend/api/material/${area}`);
      expect(Object.fromEntries(parsed.searchParams)).toEqual({
        vista: "inventario_general",
        cf_part_no: "0001-A",
        cf_stock: "1.5",
        page: "2",
        per_page: "500",
      });
      expect(init).toMatchObject({ signal, credentials: "same-origin" });
      expect(result.rows[0]).toMatchObject({
        part_no: "0001-A",
        salida: 0,
        stock: 1.5,
      });
      expect(result.piezas).toBe(3001.5);
    },
  );
  it.each(["entradas", "salidas"] as const)(
    "respeta el rango de %s y exporta todos los resultados con los mismos filtros",
    async (consulta) => {
      const fetcher = response(),
        api = createAreaApi("live"),
        filters: AreaFilters = {
          ...defaults(),
          consulta,
          start: "2026-11-01",
          end: "2026-11-06",
        };
      const searches = {
        codigo: "SMD/26-0001+A&B",
        cantidad: "1.5",
        programacion: "no pertenece",
      };
      await api.list("smd", filters, searches, 2, 500);
      const values = new URL(fetcher.mock.calls[0][0], "http://local")
        .searchParams;
      expect(Object.fromEntries(values)).toMatchObject({
        vista: consulta,
        start: "2026-11-01",
        end: "2026-11-06",
        cf_codigo: "SMD/26-0001+A&B",
        cf_cantidad: "1.5",
      });
      expect(values.has("cf_programacion")).toBe(false);
      const download = vi.spyOn(http, "downloadFile").mockResolvedValue();
      await api.export("smd", filters, searches);
      const exported = new URL(download.mock.calls[0][0], "http://local");
      expect(exported.pathname).toBe("/api/material/smd/export");
      values.delete("page");
      values.delete("per_page");
      expect(exported.searchParams.toString()).toBe(values.toString());
    },
  );
  it.each([
    ["micom", "inventario_chamber", "inventario_chamber_general"],
    ["ipm", "inventario_completo", "inventario_completo_general"],
  ] as const)(
    "mantiene las vistas procesadas exclusivas de %s y su modo",
    (area, consulta, general) => {
      const filters: AreaFilters = { ...defaults(), consulta };
      expect(
        params(area, filters, {
          programacion: "PROG/01-A",
          part_no: "PART-A",
        }).get("vista"),
      ).toBe(general);
      expect(
        params(area, { ...filters, modo: "detallado" }, {}).get("vista"),
      ).toBe(consulta);
      expect(params(area, filters, {}).has("start")).toBe(false);
      expect(() =>
        params(area === "micom" ? "smd" : "micom", filters, {}),
      ).toThrow("Consulta no disponible");
    },
  );
  it("no intenta usar rutas ni operaciones inventadas para ASSY", async () => {
    const fetcher = response();
    await expect(
      createAreaApi("live").list(
        "assy" as ConnectedArea,
        defaults(),
        {},
        1,
        500,
      ),
    ).rejects.toThrow("no está disponible");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("comprueba los tamaños soportados por el servidor y rechaza respuestas inválidas", () => {
    expect(() => params("smd", defaults(), {}, 1, 10)).toThrow("Paginación");
    expect(() => decodeResult({ ...payload, per_page: 1000 }, 500)).toThrow(
      "válida",
    );
    expect(() => decodeResult({ ...payload, total_pages: 99 }, 500)).toThrow(
      "válida",
    );
    expect(() =>
      decodeResult({ ...payload, rows: [{ stock: { valor: 3 } }] }, 500),
    ).toThrow("válida");
    expect(
      decodeResult({ ...payload, piezas: 0, rows: [{ stock: 0 }] }, 500).piezas,
    ).toBe(0);
  });
  it("aísla filtros persistidos por vista y valida fechas sin convertir el calendario a UTC", () => {
    const saved = decodeSearches({
      inventario_general: {
        part_no: " 0001-A ",
        codigo: "otra vista",
        stock: 0,
      },
      inventario: { codigo: "SMD/01-A" },
      otra: { codigo: "no" },
    });
    expect(saved).toEqual({
      inventario_general: { part_no: "0001-A" },
      inventario: { codigo: "SMD/01-A" },
    });
    expect(todayMexico(new Date("2026-11-06T02:00:00Z"))).toBe("2026-11-05");
    expect(
      dateIssue({
        ...defaults(),
        consulta: "entradas",
        start: "2026-02-31",
        end: "2026-03-01",
      }),
    ).toContain("fechas");
    expect(
      dateIssue({
        ...defaults(),
        consulta: "salidas",
        start: "2026-11-07",
        end: "2026-11-06",
      }),
    ).toContain("posterior");
    expect(dateIssue({ ...defaults(), start: "2099-99-99", end: "" })).toBe("");
  });
  it("la demo pagina sin perder registros ni mezclar áreas, conserva totales y exporta el conjunto filtrado completo", async () => {
    const fetcher = response(),
      api = createAreaApi("demo"),
      filters = defaults();
    const first = await api.list("smd", filters, {}, 1, 500),
      second = await api.list("smd", filters, {}, 2, 500),
      last = await api.list("smd", filters, {}, 3, 500);
    expect([first.rows.length, second.rows.length, last.rows.length]).toEqual([
      500, 500, 101,
    ]);
    expect(second.rows[0].part_no).toBe("SMD-PARTE-0501-A");
    expect(
      new Set(
        [...first.rows, ...second.rows, ...last.rows].map((row) => row.part_no),
      ).size,
    ).toBe(1101);
    expect(first.piezas).toBe(second.piezas);
    expect(
      (await api.list("micom", filters, { part_no: "SMD-PARTE" }, 1, 500))
        .total,
    ).toBe(0);
    const inventory = await api.list(
      "smd",
      { ...filters, start: "2099-01-01", end: "2099-01-02" },
      {},
      1,
      500,
    );
    const history = await api.list(
      "smd",
      {
        ...filters,
        consulta: "entradas",
        start: "2099-01-01",
        end: "2099-01-02",
      },
      {},
      1,
      500,
    );
    expect(inventory.total).toBe(1101);
    expect(history.total).toBe(0);
    const exportFile = vi
      .spyOn(spreadsheets, "exportSpreadsheet")
      .mockResolvedValue();
    await api.export("smd", filters, {});
    expect(exportFile.mock.calls[0][1][0].rows).toHaveLength(1102);
    expect(exportFile.mock.calls[0][1][0].rows[0]).toEqual(
      COLUMNS[effectiveView(filters)].map((spec) => spec[1]),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
