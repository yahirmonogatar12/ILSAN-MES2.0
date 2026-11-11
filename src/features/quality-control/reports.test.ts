import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import { createQualityApi } from "./api";
import {
  lqcDefaults,
  lqcFiltered,
  lqcSummary,
  operationalDate,
  oqcDefaults,
  ppmDefaults,
  ppmReport,
} from "./reportModel";
import { pivotRows, weeklyRows } from "./PpmTables";
import type { Row } from "./types";

afterEach(() => vi.restoreAllMocks());
function server(...responses: unknown[]) {
  const queue = [...responses];
  const fetcher = vi.fn(async (_url: string, _init: RequestInit) => {
    if (!queue.length) throw new Error("Solicitud inesperada");
    return Response.json(queue.shift());
  });
  vi.stubGlobal("fetch", fetcher);
  return { api: createQualityApi("live"), calls: fetcher.mock.calls };
}
function payload() {
  const metric = { inspected: 1000, defects: 2, ppm: 2000, target: 0 };
  const period = { ...metric, key: "2026-W01", label: "W1" };
  return {
    stage: "OQC",
    target: 0,
    dateFrom: "2026-01-01",
    dateTo: "2026-01-02",
    trendYear: 2026,
    summary: metric,
    periods: [period],
    trendPeriods: [period],
    lines: ["M1"],
    byLine: [{ line: "M1", ...metric }],
    byPart: [],
    topParts: [],
    topPartDetails: [],
    lineWeeklyDetails: {
      periods: [{ key: period.key, label: period.label }],
      rows: [{ line: "M1", weeks: [period] }],
    },
  };
}
describe("Liberaciones y PPM", () => {
  it("respeta el corte operativo LQC de 07:30, incluido el cambio de año", () => {
    expect(operationalDate(new Date("2026-11-11T13:29:59Z"))).toBe(
      "2026-11-10",
    );
    expect(operationalDate(new Date("2026-11-11T13:30:00Z"))).toBe(
      "2026-11-11",
    );
    expect(operationalDate(new Date("2026-01-01T07:00:00Z"))).toBe(
      "2025-12-31",
    );
  });
  it("consulta la línea y turno reales sin normalizar los identificadores y transmite los abortos", async () => {
    const records = [
      {
        serial: "0001/LQC+01-A",
        duplicado_historico: true,
        fechas_repetidas: "2026-11-01",
      },
    ];
    const { api, calls } = server(
      {
        fecha_consulta: "2026-11-11",
        lineas: [{ linea: "DP1", total_hoy: 0 }],
        uph_hoy: { DP1: { "2026-11-11 07:30:00": 0 } },
        uph_slots: [],
      },
      { records },
    );
    const signal = new AbortController().signal;
    expect(await api.lqcOverview(signal)).toMatchObject({
      date: "2026-11-11",
      lines: [{ linea: "DP1", total_hoy: 0 }],
    });
    expect(
      await api.lqcRecords(
        { ...lqcDefaults("2026-11-11"), linea: "DP1", turno: "TIEMPO EXTRA" },
        signal,
      ),
    ).toEqual(records);
    expect(calls[1][0]).toBe(
      "/backend/api/lqc/datos?fecha_inicio=2026-11-11&fecha_fin=2026-11-11&lineas=DP1&turno=TIEMPO+EXTRA",
    );
    expect(calls.map(([, init]) => init.signal)).toEqual([signal, signal]);
  });
  it("cuenta escaneos e históricos con las reglas del resumen original y agrupa por lote solo en una línea", () => {
    const records: Row[] = [
      {
        fecha: "2026-11-11",
        part: "0001/A",
        linea: "M1",
        lot_no: "LOT1",
        serial: "Serial",
        turno: "DIA",
        duplicado_historico: false,
      },
      {
        fecha: "2026-11-11",
        part: "0001/A",
        linea: "M1",
        lot_no: "LOT2",
        serial: "Serial2",
        turno: "NOCHE",
        duplicado_historico: false,
      },
      {
        fecha: "2026-11-11",
        part: "0001/A",
        linea: "M2",
        lot_no: "LOT3",
        serial: "serial",
        turno: "TIEMPO EXTRA",
        duplicado_historico: true,
      },
    ];
    expect(lqcSummary(records, true)).toEqual([
      expect.objectContaining({
        total: 3,
        unicas: 2,
        repetidas: 1,
        DIA: 1,
        NOCHE: 1,
        "TIEMPO EXTRA": 1,
        lot_no: "",
      }),
    ]);
    expect(
      lqcSummary(
        records.filter((row) => row.linea === "M1"),
        false,
      ),
    ).toHaveLength(2);
    expect(lqcFiltered(records, "false")).toHaveLength(0);
    expect(lqcFiltered(records, "0001/a")).toHaveLength(3);
  });
  it("abre OQC sin acotar fechas y conserva el resumen y aviso de truncamiento del servidor", async () => {
    const record = { id: 1, part_number: "0001/OQC+01-A", quantity: 0 };
    const { api, calls } = server({
      records: [record],
      summary: { total_boxes: 1500, total_quantity: 20000 },
      truncated: true,
      limit: 300,
    });
    expect(await api.oqcRecords(oqcDefaults)).toMatchObject({
      rows: [record],
      truncated: true,
      limit: 300,
      summary: { total_boxes: 1500 },
    });
    expect(calls[0][0]).toBe("/backend/api/oqc/liberaciones?");
    const download = vi
      .spyOn(http, "downloadFile")
      .mockResolvedValue(undefined);
    const filters = {
      search: "0001/OQC+01-A",
      fecha_desde: "2026-11-01",
      fecha_hasta: "2026-11-11",
    };
    await api.exportOqc(filters);
    expect(download.mock.calls[0][0]).toBe(
      "/api/oqc/liberaciones/export?search=0001%2FOQC%2B01-A&fecha_desde=2026-11-01&fecha_hasta=2026-11-11",
    );
  });
  it.each(["lqc", "oqc"] as const)(
    "consulta PPM %s con su contrato de periodo y conserva los totales de backend",
    async (stage) => {
      const { api, calls } = server(payload());
      const filters = {
        ...ppmDefaults(),
        linea: "M1",
        group_by: "week",
        q: "0001/A+B",
        fecha_inicio: "2026-01-01",
        fecha_fin: "2026-01-02",
      };
      const report = await api.ppm(stage, filters);
      expect(report).toMatchObject({
        target: 0,
        summary: { inspected: 1000, defects: 2, ppm: 2000 },
        weekly: {
          rows: [
            {
              line: "M1",
              weeks: [expect.objectContaining({ key: "2026-W01", target: 0 })],
            },
          ],
        },
      });
      const url = new URL(calls[0][0], "http://mes");
      expect(url.pathname).toBe("/backend/api/control_calidad/ppms/" + stage);
      expect(url.searchParams.getAll("lineas")).toEqual(["M1"]);
      expect(url.searchParams.get("q")).toBe("0001/A+B");
      expect(url.searchParams.get("group_by")).toBe(
        stage === "oqc" ? "week" : null,
      );
    },
  );
  it("guarda la meta global de cada etapa con POST y muestra la cifra confirmada por el servidor", async () => {
    const { api, calls } = server(
      { success: true, target: 20000 },
      { success: true, target: 12500 },
    );
    expect(await api.savePpmTarget("lqc", 0)).toBe(20000);
    expect(await api.savePpmTarget("oqc", 12500)).toBe(12500);
    expect(
      calls.map(([url, init]) => [
        url,
        init.method,
        JSON.parse(String(init.body)),
      ]),
    ).toEqual([
      ["/backend/api/control_calidad/ppms/lqc/target", "POST", { target: 0 }],
      [
        "/backend/api/control_calidad/ppms/oqc/target",
        "POST",
        { target: 12500 },
      ],
    ]);
    await expect(api.savePpmTarget("lqc", -1)).rejects.toThrow("meta");
    expect(calls).toHaveLength(2);
  });
  it("mantiene las columnas semanales con su año y las métricas en grupos de tres", () => {
    const report = ppmReport(payload());
    expect(pivotRows(report.trend)).toHaveLength(4);
    expect(weeklyRows(report)).toEqual([
      expect.objectContaining({
        line: "M1",
        metric: "inspected",
        "2026-W01": 1000,
        index: 0,
      }),
      expect.objectContaining({
        line: "M1",
        metric: "defects",
        "2026-W01": 2,
        index: 1,
      }),
      expect.objectContaining({
        line: "M1",
        metric: "ppm",
        "2026-W01": 2000,
        index: 2,
      }),
    ]);
    expect(() =>
      ppmReport({ ...payload(), summary: { ppm: "invalido" } }),
    ).toThrow("métrica PPM inválida");
  });
});
