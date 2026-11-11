import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import { createResultsApi } from "./api";
import { closure, filterIssue, reportParams } from "./model";
import {
  excessHistory,
  excessInventory,
  finishedViews,
  inputHistory,
  repairViews,
} from "./views";

afterEach(() => vi.restoreAllMocks());
function server(...responses: unknown[]) {
  const queue = [...responses];
  const fetcher = vi.fn(async (_url: string, _init: RequestInit) =>
    Response.json(queue.shift()),
  );
  vi.stubGlobal("fetch", fetcher);
  return { api: createResultsApi("live"), calls: fetcher.mock.calls };
}
const remote = ["smt", "imd", "ensamble", "display"] as const;
const lists = [
  ...finishedViews,
  ...repairViews("smd"),
  ...repairViews("assy"),
  excessInventory,
  excessHistory("entradas"),
  excessHistory("salidas"),
];
describe("Contratos de Control de resultados", () => {
  it.each(remote)(
    "consulta y exporta input %s con los mismos filtros, página y ceros iniciales",
    async (kind) => {
      const spec = inputHistory(kind);
      const item = {
        qr: "0001/A+02&B",
        barcode: "001-02/03",
        lote: "SMT-0001",
      };
      const { api, calls } = server({
        success: true,
        rows: [item],
        total: 620,
        page: 2,
        per_page: 500,
      });
      const signal = new AbortController().signal;
      const filters = {
        ...spec.defaults,
        qr: item.qr,
        hora_desde: "07:30",
        hora_hasta: "18:30",
      };
      const searches = {
        qr: item.qr,
        barcode: item.barcode,
        ignored: "No enviar",
      };
      const result = await api.report(spec, filters, searches, 2, 500, signal);
      expect(result).toEqual({
        rows: [item],
        total: 620,
        page: 2,
        perPage: 500,
      });
      const download = vi
        .spyOn(http, "downloadFile")
        .mockResolvedValue(undefined);
      await api.exportReport(spec, filters, searches, 2, 500, result.rows);
      const queried = new URL(calls[0][0], "http://mes");
      const exported = new URL(download.mock.calls[0][0], "http://mes");
      expect(queried.pathname).toBe("/backend" + spec.path);
      expect(exported.pathname).toBe(spec.path + "/export");
      expect(exported.search).toBe(queried.search);
      expect(queried.searchParams.get("cf_qr")).toBe(item.qr);
      expect(queried.searchParams.has("cf_ignored")).toBe(false);
      expect(queried.searchParams.get("per_page")).toBe("500");
      expect(queried.searchParams.has("cf_barcode")).toBe(
        kind === "ensamble" || kind === "display",
      );
      expect(calls[0][1].signal).toBe(signal);
      expect(calls[0][1].credentials).toBe("same-origin");
    },
  );
  it.each(lists.map((spec) => [spec.id, spec] as const))(
    "lee la forma original de %s",
    async (_id, spec) => {
      const item = { nparte: "0001/A+02&B", qty: 0, stock_actual: 0 };
      const array =
        spec.id === "excess-entradas" || spec.id === "excess-salidas";
      const { api, calls } = server(
        array ? [item] : { status: "success", items: [item] },
      );
      const result = await api.report(spec, spec.defaults, {}, 1, 500);
      expect(result.rows).toEqual([item]);
      expect(new URL(calls[0][0], "http://mes").searchParams.has("page")).toBe(
        false,
      );
    },
  );
  it.each(
    lists
      .filter((spec) => spec.exportPath)
      .map((spec) => [spec.id, spec] as const),
  )("exporta %s al endpoint original", async (_id, spec) => {
    const download = vi
      .spyOn(http, "downloadFile")
      .mockResolvedValue(undefined);
    await createResultsApi("live").exportReport(
      spec,
      spec.defaults,
      {},
      1,
      500,
      [],
    );
    const url = new URL(download.mock.calls[0][0], "http://mes");
    expect(url.pathname).toBe(spec.exportPath);
    expect(url.searchParams.has("page")).toBe(false);
  });
  it("valida errores legacy, forma de lista y paginación antes de presentarlos", async () => {
    const { api } = server(
      { status: "error", message: "Consulta rechazada", items: [] },
      { items: {} },
      { rows: [], total: "0", page: 1, per_page: 500 },
    );
    await expect(api.report(finishedViews[0], {}, {}, 1, 500)).rejects.toThrow(
      "Consulta rechazada",
    );
    await expect(api.report(excessInventory, {}, {}, 1, 500)).rejects.toThrow(
      "lista inválida",
    );
    await expect(
      api.report(inputHistory("smt"), {}, {}, 1, 500),
    ).rejects.toThrow("paginación inválida");
  });
  it("consulta snapshots por fecha y conserva ambas formas de fechas antiguas", async () => {
    const { api, calls } = server(
      { fechas: ["2026-11-10", { fecha: "2026-11-11", hora: "07:30" }] },
      { items: [{ nparte: "0001-A", stock_total: 0 }] },
    );
    expect(await api.snapshotDates()).toEqual([
      { fecha: "2026-11-10", hora: "" },
      { fecha: "2026-11-11", hora: "07:30" },
    ]);
    const spec = {
      ...finishedViews[0],
      path: "/api/snapshot_inventario/general",
    };
    await api.report(spec, { fecha: "2026-11-10", q: "0001-A" }, {}, 1, 500);
    expect(calls[1][0]).toContain("fecha=2026-11-10");
    expect(calls[1][0]).toContain("q=0001-A");
  });
  it("envía el CSV multipart y confirma únicamente el lote validado", async () => {
    const payload = {
      valid: true,
      batchId: 17,
      metadata: {},
      preview: { rows: [], summary: {} },
      history: [],
      errors: [],
    };
    const { api, calls } = server(payload, {
      success: true,
      history: [],
      message: "Confirmado",
    });
    const file = new File(["part_number,current_qty\n0001-A,0"], "conteo.csv", {
      type: "text/csv",
    });
    expect(await api.previewClosure(file)).toMatchObject({
      valid: true,
      batchId: 17,
    });
    const form = calls[0][1].body as FormData;
    expect(form.get("closure_file")).toBe(file);
    expect(calls[0][1].headers).not.toHaveProperty("Content-Type");
    await api.confirmClosure(17);
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ batchId: 17 });
    expect(calls[1][1].method).toBe("POST");
    expect(calls).toHaveLength(2);
    await expect(api.confirmClosure(0)).rejects.toThrow();
    await expect(
      api.previewClosure(new File(["x"], "bad.xlsx")),
    ).rejects.toThrow("CSV");
    expect(calls).toHaveLength(2);
  });
  it("retoma un pendiente y mantiene un cierre confirmado en consulta", async () => {
    const payload = {
      metadata: { closureUser: "Inicial" },
      preview: {
        rows: [{ part_number: "0001-A", physical_quantity: 0 }],
        summary: {},
      },
      errors: [],
    };
    const { api } = server(
      {
        batch: {
          status: "pending",
          created_at: "2026-11-11",
          created_by: "QA",
        },
        payload,
      },
      {
        batch: {
          status: "confirmed",
          closed_at: "2026-11-12",
          confirmed_by: "Supervisor",
        },
        payload,
      },
    );
    expect(await api.closureDetail(17)).toMatchObject({
      batchId: 17,
      valid: true,
      metadata: { closureUser: "QA" },
    });
    expect(await api.closureDetail(18)).toMatchObject({
      batchId: null,
      valid: false,
      metadata: { closureUser: "Supervisor" },
    });
  });
  it("mantiene inválido un preview con errores o sin identificador de lote", () => {
    expect(
      closure({
        valid: false,
        batchId: null,
        preview: { rows: [], summary: {} },
        errors: ["Parte desconocida"],
      }),
    ).toMatchObject({
      valid: false,
      batchId: null,
      errors: ["Parte desconocida"],
    });
    expect(closure({ valid: true, batchId: 0 })).toMatchObject({
      batchId: null,
    });
  });
  it("rechaza rangos inversos y horas inválidas, admite horas con segundos", () => {
    expect(
      filterIssue({ fecha_desde: "2026-11-12", fecha_hasta: "2026-11-11" }),
    ).toBeTruthy();
    expect(filterIssue({ hora_desde: "25:00" })).toBeTruthy();
    expect(
      filterIssue({ hora_desde: "18:30", hora_hasta: "08:00" }),
    ).toBeTruthy();
    expect(
      filterIssue({ hora_desde: "07:30:00", hora_hasta: "18:30:00" }),
    ).toBe("");
    expect(
      reportParams(
        finishedViews[0],
        { q: "0001/A+02&B", injected: "bad" },
        {},
        1,
        500,
      ).get("q"),
    ).toBe("0001/A+02&B");
    expect(
      reportParams(finishedViews[0], { injected: "bad" }, {}, 1, 500).has(
        "injected",
      ),
    ).toBe(false);
  });
});
