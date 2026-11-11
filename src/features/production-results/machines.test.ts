import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import { createResultsApi } from "./api";
import {
  comparisonRows,
  consolidatedRows,
  machineView,
  passDetail,
  passFailView,
  testDetail,
  visionStops,
} from "./machineViews";
import { reportParams } from "./model";
import type { MachineKind, TestKind } from "./machineViews";

afterEach(() => vi.restoreAllMocks());
const kinds: MachineKind[] = [
  "operators",
  "ict",
  "fct",
  "vision",
  "electrical",
  "changes",
];
function server(...values: unknown[]) {
  const queue = [...values];
  const fetcher = vi.fn(async (_url: string, _init: RequestInit) =>
    Response.json(queue.shift()),
  );
  vi.stubGlobal("fetch", fetcher);
  return { api: createResultsApi("live"), calls: fetcher.mock.calls };
}
describe("Historiales de máquinas de calidad", () => {
  it.each(kinds)("conserva consulta y exportación de %s", async (kind) => {
    const spec = machineView(kind);
    const item = {
      id: 1,
      barcode: "0001/A+02&B",
      resultado: "NG",
      fallas: [],
      total: 0,
    };
    const value = spec.remote
      ? { rows: [item], page: 2, per_page: 500, total: 1001 }
      : kind === "operators"
        ? { records: [item] }
        : { rows: [item], warnings: [], meta: { eventos: 1 } };
    const { api, calls } = server(value);
    const signal = new AbortController().signal;
    const filters = { ...spec.defaults, ict: "ICT1 M1" };
    const result = await api.report(
      spec,
      filters,
      {},
      2,
      500,
      signal,
      "progress-001",
    );
    expect(result.rows[0].barcode).toBe(item.barcode);
    expect(calls[0][1].signal).toBe(signal);
    const queried = new URL(calls[0][0], "http://mes");
    expect(queried.pathname).toBe("/backend" + spec.path);
    expect(queried.searchParams.get("per_page")).toBe(
      spec.remote ? "500" : null,
    );
    expect(queried.searchParams.get("progress_id")).toBe(
      spec.progressPath ? "progress-001" : null,
    );
    const download = vi
      .spyOn(http, "downloadFile")
      .mockResolvedValue(undefined);
    await api.exportReport(spec, filters, {}, 2, 500, result.rows);
    const exported = new URL(download.mock.calls[0][0], "http://mes");
    expect(exported.pathname).toBe(spec.exportPath);
    expect(exported.searchParams.has("page")).toBe(
      !!spec.remote && spec.exportPage !== false,
    );
    expect(exported.searchParams.get("fecha_desde")).toBe(
      spec.defaults.fecha_desde,
    );
  });
  it.each(["ict", "fct", "vision"] as TestKind[])(
    "conserva el array de resumen %s",
    async (kind) => {
      const spec = passFailView(kind),
        item = { numero_parte: "0001-A", total: 0, pass_count: 0, fallas: [] };
      const { api } = server([item]);
      const result = await api.report(spec, spec.defaults, {}, 1, 500);
      expect(result.rows[0]).toMatchObject(item);
    },
  );
  it("conserva resultados vacíos por barcode corto y el tamaño solicitado", async () => {
    const { api } = server({ rows: [], page: 1, per_page: 0, total: 0 });
    const spec = machineView("ict");
    expect(
      await api.report(
        spec,
        { ...spec.defaults, barcode_like: "001" },
        {},
        1,
        500,
      ),
    ).toEqual({ rows: [], page: 1, perPage: 500, total: 0 });
  });
  it("mantiene filtros válidos de encabezado, el alcance de grupo y códigos completos", () => {
    const spec = machineView("ict");
    const params = reportParams(
      spec,
      spec.defaults,
      { barcode: "0001/A+02&B", operador: "Ignorado" },
      1,
      500,
    );
    expect(params.get("cf_barcode")).toBe("0001/A+02&B");
    expect(params.has("cf_operador")).toBe(false);
    expect(
      reportParams(machineView("changes"), { ict: "ALL" }, {}, 1, 500).get(
        "ict_all",
      ),
    ).toBe("1");
    const detail = passDetail("fct", {
      fecha: "2026-11-11",
      linea: "M1",
      estacion: "FCT-01",
      turno: "NOCHE",
      numero_parte: "0001/A+02&B",
    });
    const detailParams = reportParams(detail, {}, {}, 1, 500);
    expect(detailParams.get("grupo_numero_parte")).toBe("0001/A+02&B");
    expect(detailParams.get("fecha_jornada")).toBe("2026-11-11");
    expect(
      reportParams(
        testDetail("ict", { barcode: "0001-A", ts: "2026-11-11 08:00:00" }),
        {},
        {},
        1,
        500,
      ).get("ts"),
    ).toBe("2026-11-11 08:00:00");
  });
  it("preserva fallas y parámetros cuando falta la imagen original", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          record_id: 5,
          parametros_disponibles: true,
          defects: [{ componente: "R37" }],
          image_url: "",
          error: "Archivo no encontrado",
        },
        { status: 404 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await createResultsApi("live").visionInfo("5")).toMatchObject({
      record_id: 5,
      parametros_disponibles: true,
      defects: [{ componente: "R37" }],
    });
  });
  it("mantiene los errores de autorización y del registro inexistente", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ error: "Acceso denegado" }, { status: 403 }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(createResultsApi("live").visionInfo("5")).rejects.toThrow(
      "Acceso denegado",
    );
  });
  it("descarga imagen por su identificador autenticado y exporta comparación con POST", async () => {
    const blob = new Blob(["image"], { type: "image/jpeg" });
    const download = vi
      .spyOn(http, "requestFile")
      .mockResolvedValue({ blob, name: "vision.jpg" });
    vi.spyOn(http, "saveDownload").mockImplementation(() => {});
    const api = createResultsApi("live");
    const signal = new AbortController().signal;
    await api.visionImage("17", signal);
    expect(download.mock.calls[0].slice(0, 3)).toEqual([
      "/api/vision/image-file?id=17",
      "vision-17.jpg",
      signal,
    ]);
    const runs = [
      { barcode: "0001/A+02&B", ts: "2026-11-11 08:00:00", secret: "omitir" },
      { barcode: "0001/A+02&B", ts: "2026-11-11 08:00:01" },
    ];
    await api.exportComparison(runs, true);
    const call = download.mock.calls[1];
    expect(call[0]).toBe("/api/ict/export-compare");
    expect(call[4]?.method).toBe("POST");
    expect(JSON.parse(String(call[4]?.body))).toEqual({
      only_diffs: true,
      runs: [
        { barcode: runs[0].barcode, ts: runs[0].ts },
        { barcode: runs[1].barcode, ts: runs[1].ts },
      ],
    });
    await expect(api.exportComparison([], true)).rejects.toThrow(
      "dos ejecuciones",
    );
    expect(download).toHaveBeenCalledTimes(2);
  });
  it("distingue intentos crudos del detalle real y consolida por parte e ICT", () => {
    const input = [
      {
        numero_parte: "0001",
        ict: 1,
        fecha: "2026-11-10",
        total_intentos: 100,
        ok_count_raw: 90,
        ng_count_raw: 10,
        total: 50,
        ok_count: 45,
        ng_count: 5,
      },
      {
        numero_parte: "0001",
        ict: 1,
        fecha: "2026-11-11",
        total_intentos: 10,
        ok_count_raw: 10,
        ng_count_raw: 0,
      },
      {
        numero_parte: "0001",
        ict: 2,
        fecha: "2026-11-11",
        total_intentos: 5,
        ok_count_raw: 0,
        ng_count_raw: 5,
      },
    ];
    expect(passFailView("ict").mapRows!(input, {})[0]).toMatchObject({
      total: 100,
      ok_count: 90,
      ng_count: 10,
      porcentaje_ok: 90,
    });
    expect(passFailView("ict", true).mapRows).toBeUndefined();
    const result = consolidatedRows(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      numero_parte: "0001",
      ict: 1,
      dias: 2,
      total: 110,
      ok: 100,
      ng: 10,
    });
    expect(result[0].pass_pct).toBe(90.91);
    expect(result[1]).toMatchObject({ ict: 2, total: 5, ok: 0, ng: 5 });
  });
  it("compara por componente y pinref, incluyendo parámetros ausentes", () => {
    const runs = [
      {
        record: { barcode: "001", ts: "2026-11-11 08:00:00" },
        parameters: [
          { componente: "R1", pinref: "P1", act_value: "1.0" },
          { componente: "C1", pinref: "P2", act_value: "0" },
        ],
      },
      {
        record: { barcode: "001", ts: "2026-11-11 08:00:01" },
        parameters: [{ componente: "R1", pinref: "P1", act_value: "2.0" }],
      },
    ];
    const result = comparisonRows(runs, true);
    expect(result).toHaveLength(4);
    expect(result[0].changedFields).toEqual(["act_value"]);
    expect(result.every((row) => row.different)).toBe(true);
    expect(result.at(-1)).toMatchObject({
      componente: "C1",
      pinref: "P2",
      missing: true,
    });
    expect(comparisonRows([runs[0], runs[0]], true)).toHaveLength(0);
    const units = ["mV", "MV"].map((unit) => ({
      record: { barcode: "001" },
      parameters: [{ componente: "R1", pinref: "P1", act_unit: unit }],
    }));
    expect(comparisonRows(units, true)[0].changedFields).toEqual(["act_unit"]);
  });
  it("transforma las fallas y paros conservando el cero", () => {
    const spec = machineView("vision");
    expect(
      spec.mapRows!(
        [
          {
            fallas: [
              { tipo: "PRESENCIA", componente: "R37", tipo_falla: "FALTANTE" },
            ],
          },
        ],
        {},
      )[0],
    ).toMatchObject({ tipo: "PRESENCIA", componente: "R37" });
    expect(
      visionStops().mapRows!(
        [{ real_stop_seconds: 0, real_stop_prov: 12, ajustes: [] }],
        {},
      )[0].paro_real,
    ).toBe(0);
    const stops = visionStops();
    expect(
      stops.columns.find((column) => column.key === "paro_real")!.searchValue!({
        paro_real: 90061,
      }),
    ).toBe("25:01:01");
    expect(
      passDetail("ict", {}, true).columns.some(
        (column) => column.key === "criterio_real",
      ),
    ).toBe(true);
  });
});
