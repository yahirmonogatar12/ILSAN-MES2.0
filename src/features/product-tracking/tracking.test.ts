import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import { createTrackingApi } from "./api";
import {
  batchResult,
  pieceNotice,
  pieceResult,
  traceParams,
  traceResult,
  validateFile,
  validateTrace,
} from "./model";
import { lookup } from "./demo";
import type { TraceView } from "./types";

afterEach(() => vi.restoreAllMocks());
const success = { status: "success", items: [] };
describe("Contratos de Product Tracking", () => {
  it("preserva ceros, separadores y abortos al buscar una pieza", async () => {
    const source = await lookup("0001/A+02&B");
    const fetcher = vi.fn(async () =>
      Response.json({ status: "success", items: source.items }),
    );
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    const result = await createTrackingApi("live").lookup(
      " 0001/A+02&B ",
      signal,
    );
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(new URL(url, "http://mes").searchParams.get("codigo")).toBe(
      "0001/A+02&B",
    );
    expect(init.signal).toBe(signal);
    expect(result.items[0].barcode).toBe("0001/A+02&B");
    expect(result.items[1].reemplazado_por).toBe("0001/A+02&B");
    expect(result.items[0].etapas).toHaveLength(17);
  });
  it.each(["por_pcb", "materiales", "por_proveedor"] as TraceView[])(
    "conserva filtros y exportación de %s",
    async (view) => {
      const filters = {
        pcb: " 0001/A+02&B ",
        proceso: "IMD",
        lot_no: "LOT!001",
        part_no: "EBR01",
        material: "0000!A+B",
        fecha_inicio: "2026-11-01",
        fecha_fin: "2026-11-11",
        ignorar: "extra",
      };
      const fetcher = vi.fn(async () => Response.json(success));
      vi.stubGlobal("fetch", fetcher);
      const api = createTrackingApi("live"),
        signal = new AbortController().signal;
      await api.trace(view, filters, signal);
      const [url, init] = fetcher.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe(
        "/backend/api/trazabilidad_pcb/" +
          view +
          "?" +
          traceParams(view, filters),
      );
      expect(init.signal).toBe(signal);
      expect(traceParams(view, filters).has("ignorar")).toBe(false);
      const download = vi
        .spyOn(http, "requestFile")
        .mockResolvedValue({ blob: new Blob(["xlsx"]), name: "reporte.xlsx" });
      const save = vi.spyOn(http, "saveDownload").mockImplementation(() => {});
      await api.exportTrace(view, filters);
      expect(download.mock.calls[0][0]).toBe(
        "/api/trazabilidad_pcb/" +
          view +
          "/export?" +
          traceParams(view, filters),
      );
      expect(save).toHaveBeenCalledWith(expect.any(Blob), "reporte.xlsx");
    },
  );
  it("consulta el historial con su PCB y proceso originales", async () => {
    const fetcher = vi.fn(async () => Response.json(success));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    await createTrackingApi("live").history(27, "IMD", signal);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "/backend/api/trazabilidad_pcb/historial_pcb?input_main_id=27&proceso=IMD",
    );
    expect(init.signal).toBe(signal);
  });
  it("envía el Excel por multipart y añade formato solo al exportar", async () => {
    const file = new File(["contenido"], "códigos.xlsx");
    const fetcher = vi.fn(async () =>
      Response.json({
        ...success,
        etapas: [],
        total: 0,
        encontrados: 0,
        no_encontrados: 0,
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const api = createTrackingApi("live"),
      signal = new AbortController().signal;
    await api.batch(file, signal);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/backend/api/production_tracking/lote");
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(signal);
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    expect((init.body as FormData).get("file")).toBe(file);
    expect((init.body as FormData).has("formato")).toBe(false);
    const download = vi
      .spyOn(http, "requestFile")
      .mockResolvedValue({ blob: new Blob(["xlsx"]), name: "lote.xlsx" });
    vi.spyOn(http, "saveDownload").mockImplementation(() => {});
    await api.exportBatch(file);
    const exportInit = download.mock.calls[0][4]!;
    expect(exportInit.method).toBe("POST");
    expect((exportInit.body as FormData).get("file")).toBe(file);
    expect((exportInit.body as FormData).get("formato")).toBe("excel");
  });
  it("usa el exportador original de una pieza", async () => {
    const download = vi
      .spyOn(http, "requestFile")
      .mockResolvedValue({ blob: new Blob(["xlsx"]), name: "pieza.xlsx" });
    vi.spyOn(http, "saveDownload").mockImplementation(() => {});
    await createTrackingApi("live").exportLookup("0001/A+02&B");
    expect(
      new URL(download.mock.calls[0][0], "http://mes").searchParams.get(
        "codigo",
      ),
    ).toBe("0001/A+02&B");
    expect(download.mock.calls[0][0]).toContain(
      "/api/production_tracking/buscar/export?",
    );
  });
  it("conserva cero, refill, avisos y la fecha del servidor", () => {
    const result = traceResult({
      status: "success",
      items: [
        {
          refill_number: 0,
          cantidad_restante: 0,
          qty_per_pcb: 0.5,
          status: "error",
          numero_lote_material: "0001!AB",
        },
      ],
      message: "Consulta acotada",
      fecha_hoy: "2026-11-11",
    });
    expect(result.items[0].cantidad_restante).toBe(0);
    expect(result.items[0].qty_per_pcb).toBe(0.5);
    expect(result.items[0].status).toBe("error");
    expect(result.message).toBe("Consulta acotada");
    expect(result.fecha_hoy).toBe("2026-11-11");
  });
  it.each([
    { status: "error", message: "Error de origen", items: [] },
    { status: "success", items: {} },
    { status: "success", items: [{ material_code: { invalido: true } }] },
  ])("rechaza respuestas inválidas y errores de negocio", (value) => {
    expect(() => traceResult(value)).toThrow();
  });
  it("rechaza una respuesta de tracking sin etapas", () => {
    expect(() =>
      batchResult({ status: "error", message: "Archivo corrupto", items: [] }),
    ).toThrow("Archivo corrupto");
    expect(() => pieceResult({ items: [{ barcode: "0001" }] })).toThrow();
    expect(() => batchResult({ ...success, etapas: [{}] })).toThrow();
  });
  it("distingue vínculos pendientes, reconstrucción y reemplazo", async () => {
    const item = (await lookup("0001/A+02&B")).items[0];
    expect(
      pieceNotice({ ...item, barcode_anterior: "", sin_barcode: true }),
    ).toContain("indeterminadas");
    expect(
      pieceNotice({ ...item, barcode_anterior: "", reconstruido: true }),
    ).toContain("reconstruido");
    expect(pieceNotice({ ...item, reemplazado_por: "000002" })).toContain(
      "000002",
    );
    expect(pieceNotice({ ...item, barcode: "" })).toContain("reasignó");
  });
  it("valida los criterios requeridos y el orden de fechas", () => {
    expect(validateTrace("por_pcb", { pcb: " " })).toContain("QR");
    expect(validateTrace("por_proveedor", { material: "" })).toContain(
      "proveedor",
    );
    expect(
      validateTrace("materiales", {
        fecha_inicio: "2026-11-11",
        fecha_fin: "2026-11-01",
      }),
    ).toContain("fecha inicial");
    expect(validateTrace("materiales", {})).toBe("");
  });
  it("respeta los formatos y límites del importador original", () => {
    expect(validateFile(null)).toContain("Selecciona");
    expect(validateFile(new File(["x"], "datos.csv"))).toContain(".xlsx");
    expect(validateFile(new File([], "vacio.xlsx"))).toContain("vacío");
    expect(
      validateFile({ name: "grande.xlsx", size: 10 * 1024 * 1024 + 1 } as File),
    ).toContain("10 MB");
    expect(validateFile(new File(["x"], "datos.XLSM"))).toBe("");
  });
});
