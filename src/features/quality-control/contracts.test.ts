import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import { createQualityApi } from "./api";
import { defaultFilters, histories, historyParams } from "./model";
import type { HistoryKind, StationDraft } from "./types";

const kinds: HistoryKind[] = [
  "smt",
  "imd",
  "assy",
  "pasta",
  "mask",
  "squeegee",
  "interlock",
  "vision",
];
afterEach(() => vi.restoreAllMocks());
function mockServer(...responses: unknown[]) {
  const queue = [...responses];
  const fetcher = vi.fn(async (_url: string, _init: RequestInit) => {
    if (!queue.length) throw new Error("Solicitud inesperada.");
    return Response.json(queue.shift());
  });
  vi.stubGlobal("fetch", fetcher);
  return { api: createQualityApi("live"), calls: fetcher.mock.calls };
}
describe("Contratos de Control de calidad", () => {
  it.each(kinds)(
    "exporta %s con los mismos filtros y sin recortar a la página visible",
    async (kind) => {
      const download = vi
        .spyOn(http, "downloadFile")
        .mockResolvedValue(undefined);
      const filters = { ...defaultFilters(kind), linea: "SMT A" };
      const field = histories[kind].columns[0].key;
      await createQualityApi("live").exportHistory(kind, filters, {
        [field]: "0001/A+02&B",
      });
      const [path] = download.mock.calls[0];
      const url = new URL(path, "http://mes");
      expect(url.pathname).toBe(histories[kind].endpoint + "/export");
      expect(url.searchParams).toEqual(
        historyParams(kind, filters, { [field]: "0001/A+02&B" }),
      );
      expect(url.searchParams.has("page")).toBe(false);
      expect(url.searchParams.has("per_page")).toBe(false);
    },
  );
  it.each(kinds)(
    "consulta %s con paginación remota, encabezados y señal",
    async (kind) => {
      const rows = [{ cantidad: 0, codigo: "0001/A+02&B" }];
      const { api, calls } = mockServer({
        rows,
        page: 2,
        per_page: 500,
        total: 1200,
        total_detenido: "9h 01m 02s",
      });
      const filters = {
        ...defaultFilters(kind),
        fecha_desde: "2026-11-01",
        fecha_hasta: "2026-11-11",
        linea: "SMT A",
      };
      const field = histories[kind].columns[0].key;
      const signal = new AbortController().signal;
      const result = await api.history(
        kind,
        filters,
        { [field]: "0001/A+02&B", ignored: "No enviar" },
        2,
        500,
        signal,
      );
      expect(result).toMatchObject({
        rows,
        page: 2,
        perPage: 500,
        total: 1200,
        stopped: "9h 01m 02s",
      });
      const url = new URL(calls[0][0], "http://mes");
      expect(url.pathname).toBe(
        "/backend" + histories[kind].endpoint + "/data",
      );
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("per_page")).toBe("500");
      expect(url.searchParams.get("linea")).toBe("SMT A");
      expect(url.searchParams.get("cf_" + field)).toBe("0001/A+02&B");
      expect(url.searchParams.has("cf_ignored")).toBe(false);
      expect(calls[0][1].signal).toBe(signal);
    },
  );
  it("mantiene los filtros específicos del interlock y rechaza rangos o duraciones inválidas antes de consultar", async () => {
    const filters = {
      ...defaultFilters("interlock"),
      min_seg: "0.4",
      incluir_cortos: "1",
      motivo: "SCAN_REJECTED",
    };
    const params = historyParams("interlock", filters, { duracion: "30" });
    expect(params.get("min_seg")).toBe("0.4");
    expect(params.get("incluir_cortos")).toBe("1");
    expect(params.get("cf_duracion")).toBe("30");
    expect(() =>
      historyParams("interlock", { ...filters, min_seg: "-1" }, {}),
    ).toThrow("duración mínima");
    expect(() =>
      historyParams(
        "smt",
        {
          ...defaultFilters("smt"),
          fecha_desde: "2026-11-12",
          fecha_hasta: "2026-11-11",
        },
        {},
      ),
    ).toThrow("fecha inicial");
  });
  it("usa PUT y conserva la línea al editar y el estado explícito al activar", async () => {
    const draft: StationDraft = {
      station_code: " ICT-01 ",
      station_name: " ICT prueba ",
      station_type: "ICT",
      host_name: " M2 ",
      is_active: false,
    };
    const record = { ...draft, id: 17 };
    const { api, calls } = mockServer(
      { record },
      { record: { ...record, is_active: true } },
      { success: true },
    );
    await api.saveStation(draft, 17);
    await api.setActive(17, true);
    await api.deleteStation(17);
    expect(
      calls.map(([url, init]) => [
        url,
        init.method,
        init.body ? JSON.parse(String(init.body)) : null,
      ]),
    ).toEqual([
      [
        "/backend/api/control_calidad/stations_qa/17",
        "PUT",
        {
          station_code: "ICT-01",
          station_name: "ICT prueba",
          station_type: "ICT",
          host_name: "M2",
          is_active: false,
        },
      ],
      [
        "/backend/api/control_calidad/stations_qa/17/active",
        "PATCH",
        { is_active: true },
      ],
      ["/backend/api/control_calidad/stations_qa/17", "DELETE", null],
    ]);
  });
  it("reconoce el contrato plural de opciones SMT y conserva la señal", async () => {
    const { api, calls } = mockServer({
      lineas: ["SMT A"],
      maquinas: ["Mounter 1"],
    });
    const signal = new AbortController().signal;
    expect(await api.options("smt", signal)).toEqual({
      lineas: ["SMT A"],
      maquinas: ["Mounter 1"],
    });
    expect(calls[0][0]).toBe("/backend/api/smt-historial/opciones");
    expect(calls[0][1].signal).toBe(signal);
  });
  it("la demo permite un código en líneas diferentes y rechaza un duplicado en la misma línea", async () => {
    const api = createQualityApi("demo");
    const draft: StationDraft = {
      station_code: "ICT-QA",
      station_name: "QA",
      station_type: "ICT",
      host_name: "M3",
      is_active: true,
    };
    const a = await api.saveStation(draft);
    const b = await api.saveStation({ ...draft, host_name: "M4" });
    expect(a.id).not.toBe(b.id);
    await expect(
      api.saveStation({ ...draft, station_code: "ict-qa" }),
    ).rejects.toThrow("misma línea");
    await api.deleteStation(a.id);
    await api.deleteStation(b.id);
  });
  it("la demo busca el segundo squeegee y conserva los rechazos cortos y el tipo REPETIDO", async () => {
    const api = createQualityApi("demo");
    const tooling = await api.history(
      "squeegee",
      { ...defaultFilters("squeegee"), codigo: "0002/SQ-02-B" },
      {},
      1,
      500,
    );
    expect(tooling.rows).toHaveLength(1);
    expect(tooling.rows[0].squeegee_2).toBe("0002/SQ-02-B");
    const stops = await api.history(
      "interlock",
      defaultFilters("interlock"),
      {},
      1,
      1,
    );
    expect(stops).toMatchObject({ total: 2, stopped: "36.4s" });
    expect(stops.rows).toHaveLength(1);
    const all = await api.history(
      "interlock",
      { ...defaultFilters("interlock"), incluir_cortos: "1" },
      {},
      1,
      500,
    );
    expect(all.total).toBe(3);
    expect(
      all.rows.find((row) => row.motivo === "SCAN_REJECTED")?._destacar,
    ).toBe(true);
    const repeated = await api.history(
      "vision",
      { ...defaultFilters("vision"), tipo: "Escaneo repetido" },
      {},
      1,
      500,
    );
    expect(repeated.rows).toHaveLength(1);
    expect(repeated.rows[0]).toMatchObject({
      tipo: "Escaneo repetido",
      _destacar: false,
    });
  });
});
