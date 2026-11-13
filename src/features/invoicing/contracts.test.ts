import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import * as scripts from "@/shared/lib/loadScript";
import { exportRows } from "./exportRows";
import {
  INVOICES_EXPORT,
  PACKING_EXPORT,
  PACKING_LOTS_EXPORT,
} from "./columns";
import { createInvoiceApi, createPurchaseApi, createValuationApi } from "./api";
import {
  fileIssue,
  invoiceDefaults,
  lineDraft,
  lineIssues,
  purchaseDefaults,
  valuationDefaults,
} from "./model";
import type { InvoiceScope, PurchaseMode } from "./types";
afterEach(() => vi.restoreAllMocks());
function mock(value: unknown, status = 200) {
  const fetcher = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const part = "EBR23966228-01-A";
const file = () =>
  new File(["Excel fixture"], "invoice-01.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
const invoicePreview = {
  success: true,
  numero_invoice: "INV/26-01+A&B",
  lines: [
    {
      numero_parte_sistema: part,
      raw_part_num: "RAW/01-A",
      cantidad: "1",
      costo_unitario: "0",
      costo_total: "0",
    },
  ],
  warnings: [],
  duplicado: null,
};

describe("contratos de Facturas con el backend original", () => {
  it("no presenta un listado incompleto si falla la consulta de abiertos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const failed =
          new URL(url, "http://local").searchParams.get("estado") ===
          "PENDIENTES";
        return new Response(
          JSON.stringify(
            failed
              ? { error: "No fue posible consultar los abiertos." }
              : { success: true, records: [], total: 0 },
          ),
          {
            status: failed ? 503 : 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );
    await expect(
      createInvoiceApi("live").list("ALMACEN", invoiceDefaults()),
    ).rejects.toThrow("abiertos");
  });
  it.each(["ALMACEN", "EMBARQUES"] as InvoiceScope[])(
    "incluye abiertos antiguos en %s junto al rango, sin duplicar ni perder ámbito, búsqueda o aborto",
    async (scope) => {
      const inside = {
        id: 2,
        estado: "CON_DIFERENCIAS",
        cerrado_manual: 0,
        fecha_carga: "2026-11-06 11:00:00",
      };
      const dated = [
        {
          id: 3,
          estado: "VALIDADA",
          cerrado_manual: 1,
          fecha_carga: "2026-11-06 12:00:00",
        },
        inside,
        { id: 1, estado: "APLICADA", fecha_carga: "2026-11-06 10:00:00" },
      ];
      const opened = [
        inside,
        {
          id: 4,
          estado: "VALIDADA",
          cerrado_manual: "0",
          fecha_carga: "2024-01-01 10:00:00",
        },
      ];
      const fetcher = vi.fn(async (url: string, _options?: RequestInit) => {
        const records =
          new URL(url, "http://local").searchParams.get("estado") ===
          "PENDIENTES"
            ? opened
            : dated;
        return new Response(
          JSON.stringify({ success: true, records, total: records.length }),
          { headers: { "Content-Type": "application/json" } },
        );
      });
      vi.stubGlobal("fetch", fetcher);
      const signal = new AbortController().signal;
      const result = await createInvoiceApi("live").list(
        scope,
        {
          q: "INV/26+A&B",
          estado: "",
          fecha_inicio: "2026-11-06",
          fecha_fin: "2026-11-06",
        },
        signal,
      );
      expect(result.records.map((row) => row.id)).toEqual([3, 2, 1, 4]);
      expect(result.total).toBe(4);
      expect(fetcher).toHaveBeenCalledTimes(2);
      const params = fetcher.mock.calls.map(
        ([url]) => new URL(url, "http://local").searchParams,
      );
      expect(
        params.every(
          (value) =>
            value.get("ambito") === scope && value.get("q") === "INV/26+A&B",
        ),
      ).toBe(true);
      expect(
        params
          .find((value) => value.get("estado") === "PENDIENTES")!
          .has("fecha_inicio"),
      ).toBe(false);
      expect(
        params
          .find((value) => value.get("estado") !== "PENDIENTES")!
          .get("fecha_inicio"),
      ).toBe("2026-11-06");
      expect(
        fetcher.mock.calls.every((call) => call[1]?.signal === signal),
      ).toBe(true);
    },
  );
  it("respeta el estado elegido al añadir los abiertos sin aplicar un límite adicional de 300 al conjunto", async () => {
    const dated = Array.from({ length: 300 }, (_, index) => ({
      id: index + 1,
      estado: "VALIDADA",
      cerrado_manual: 1,
      fecha_carga: "2026-11-06 10:00:00",
    }));
    const opened = Array.from({ length: 299 }, (_, index) => ({
      id: index + 301,
      estado: "VALIDADA",
      cerrado_manual: 0,
      fecha_carga: "2024-01-01 10:00:00",
    }));
    const fetcher = vi.fn(async (url: string, _options?: RequestInit) => {
      const records =
        new URL(url, "http://local").searchParams.get("estado") === "PENDIENTES"
          ? [
              ...opened,
              { id: 999, estado: "CON_DIFERENCIAS", fecha_carga: "2023-01-01" },
            ]
          : dated;
      return new Response(
        JSON.stringify({ success: true, records, total: records.length }),
        { headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await createInvoiceApi("live").list("ALMACEN", {
      ...invoiceDefaults(),
      estado: "VALIDADA",
    });
    expect(result.records).toHaveLength(599);
    expect(result.records.every((row) => row.estado === "VALIDADA")).toBe(true);
  });
  it.each(["PENDIENTES", "APLICADA", "CANCELADA", "sin-fechas"])(
    "no agrega consultas de abiertos al filtrar %s",
    async (estado) => {
      const fetcher = mock({ success: true, records: [], total: 0 });
      await createInvoiceApi("live").list(
        "ALMACEN",
        estado === "sin-fechas"
          ? { q: "", estado: "", fecha_inicio: "", fecha_fin: "" }
          : { ...invoiceDefaults(), estado },
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["ALMACEN", "EMBARQUES"] as InvoiceScope[])(
    "al cerrar un invoice abierto de %s fuera del rango deja de incluirlo, y al reabrirlo vuelve",
    async (scope) => {
      const api = createInvoiceApi("demo");
      const upload = await api.upload(scope, {
        file: file(),
        numero_invoice: `QA-OPEN-DATE-${scope}`,
        tipo: "LG",
      });
      const filters = {
        q: `QA-OPEN-DATE-${scope}`,
        estado: "",
        fecha_inicio: "2099-01-01",
        fecha_fin: "2099-01-02",
      };
      const id = Number(upload.invoice_id);
      expect(
        (await api.list(scope, filters)).records.map((row) => row.id),
      ).toContain(id);
      await api.action(scope, id, "close", { cerrado: true });
      expect((await api.list(scope, filters)).records).toHaveLength(0);
      await api.action(scope, id, "close", { cerrado: false });
      expect(
        (await api.list(scope, filters)).records.map((row) => row.id),
      ).toContain(id);
    },
  );
  it("consulta archivos de compras por tipo y descarga el original por su carga, con aborto", async () => {
    const fetcher = mock({
      success: true,
      records: [{ id: 73, tipo: "LG", archivo_nombre: "original.xlsx" }],
      total: 1,
    });
    const api = createPurchaseApi("live"),
      signal = new AbortController().signal;
    expect((await api.loads("LG", signal)).records[0].id).toBe(73);
    expect(fetcher).toHaveBeenCalledWith(
      "/backend/api/material_admin/compras/cargas?tipo=LG",
      expect.objectContaining({ signal }),
    );
    const original = {
      blob: new Blob(["original exacto"]),
      name: "original.xlsx",
    };
    const reader = vi.spyOn(http, "requestFile").mockResolvedValue(original);
    expect(await api.file(73, signal)).toBe(original);
    expect(reader).toHaveBeenCalledExactlyOnceWith(
      "/api/material_admin/compras/cargas/73/file",
      "compras_73.xlsx",
      signal,
    );
    const download = vi.spyOn(http, "downloadFile").mockResolvedValue();
    await api.download(73);
    expect(download).toHaveBeenCalledExactlyOnceWith(
      "/api/material_admin/compras/cargas/73/file?download=1",
      "compras_73.xlsx",
    );
  });
  it("exporta el conjunto cargado completo y conserva excesos, códigos y la hoja de lotes", async () => {
    vi.spyOn(scripts, "loadScript").mockResolvedValue();
    const append = vi.fn();
    const write = vi.fn();
    window.XLSX = {
      version: "0.20.3",
      utils: {
        book_new: () => ({ SheetNames: [], Sheets: {} }),
        aoa_to_sheet: (values: unknown) => ({ values }),
        book_append_sheet: append,
      },
      writeFile: write,
    } as unknown as NonNullable<typeof window.XLSX>;
    const records = Array.from({ length: 600 }, (_, index) => ({
      line_no: index + 1,
      numero_parte_sistema: "0001-A",
      cantidad_exceso: 5,
      cantidad_packing: 0,
      costo_unitario: "0",
      archivo_nombre: "invoice.xlsx",
    }));
    await exportRows("packing", PACKING_EXPORT, records, [
      {
        name: "Detallado",
        specs: PACKING_LOTS_EXPORT,
        rows: [
          {
            packing_line_no: 1,
            packing_part: "0001-A",
            codigo_material_recibido: "MAT/26-01+A&B",
            cantidad_aplicada: 5,
            pallet_recibido: "009",
            pallet_esperado: "007",
            nota_aplicacion: "Confirmado por supervisor",
          },
        ],
      },
    ]);
    expect(append).toHaveBeenCalledTimes(2);
    const main = append.mock.calls[0][1].values;
    expect(main).toHaveLength(601);
    expect(main[0]).toContain("EXCESO");
    expect(main[1]).toContain("0001-A");
    expect(main[1]).toContain(0);
    expect(append.mock.calls[1][2]).toBe("Detallado");
    expect(append.mock.calls[1][1].values[1]).toContain(
      "Confirmado por supervisor",
    );
    expect(write).toHaveBeenCalledOnce();
    expect(
      INVOICES_EXPORT.some((column) => column[0] === "archivo_nombre"),
    ).toBe(true);
    delete window.XLSX;
  });
  it("la descarga mantiene ámbito y los filtros de valorización sin límite u offset", async () => {
    const download = vi.spyOn(http, "downloadFile").mockResolvedValue();
    await createInvoiceApi("live").download("EMBARQUES", 7);
    expect(download.mock.calls[0][0]).toContain(
      "/7/file?download=1&ambito=EMBARQUES",
    );
    await createValuationApi("live").export({
      ...valuationDefaults(),
      codigo_material_recibido: "MAT/26-01+A&B",
      fuente_costo: "INVOICE",
    });
    expect(
      Object.fromEntries(
        new URL(download.mock.calls[1][0], "http://local").searchParams,
      ),
    ).toEqual({
      codigo_material_recibido: "MAT/26-01+A&B",
      fuente_costo: "INVOICE",
    });
  });
  it("lee adjuntos autenticados, conserva abortos y rechaza páginas o JSON como archivo", async () => {
    const signal = new AbortController().signal;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition":
            "attachment; filename*=UTF-8''invoice%2F01.xlsx",
        },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const file = await http.requestFile("/archivo", "fallback.xlsx", signal);
    expect(file.name).toBe("invoice_01.xlsx");
    expect(file.blob.size).toBe(3);
    expect(fetcher.mock.calls[0][1].signal).toBe(signal);
    fetcher.mockResolvedValue(
      new Response("Login", { headers: { "Content-Type": "text/html" } }),
    );
    await expect(http.requestFile("/archivo", "x.xlsx")).rejects.toThrow(
      "página",
    );
    mock({ error: "No tienes permiso para el archivo." });
    await expect(http.requestFile("/archivo", "x.xlsx")).rejects.toThrow(
      "permiso",
    );
  });
  it.each(["ALMACEN", "EMBARQUES"] as InvoiceScope[])(
    "separa %s, omite fechas para abiertos y conserva Part Sys completo",
    async (scope) => {
      const fetcher = mock({ success: true, records: [], total: 0 });
      const api = createInvoiceApi("live");
      const signal = new AbortController().signal;
      await api.list(
        scope,
        { ...invoiceDefaults(), estado: "PENDIENTES", q: "INV/26-01+A&B" },
        signal,
      );
      const url = new URL(fetcher.mock.calls[0][0], "http://local");
      expect(url.searchParams.get("ambito")).toBe(scope);
      expect(url.searchParams.get("q")).toBe("INV/26-01+A&B");
      expect(url.searchParams.has("fecha_inicio")).toBe(false);
      expect(fetcher.mock.calls[0][1]).toMatchObject({
        signal,
        credentials: "same-origin",
      });
      const detail = mock({
        success: true,
        invoice: { id: 7, ambito: scope },
        lines: invoicePreview.lines,
        packing: [
          { pallet_no_original: "PL-007", pallet_no: "007", lotes: [] },
        ],
        links: [],
        manual_receipts: [],
      });
      const result = await api.detail(scope, 7, signal);
      expect(result.lines[0].numero_parte_sistema).toBe(part);
      expect(result.packing[0].pallet_no_original).toBe("PL-007");
      expect(
        new URL(detail.mock.calls[0][0], "http://local").searchParams.get(
          "ambito",
        ),
      ).toBe(scope);
    },
  );
  it("previsualiza y carga el mismo archivo con ámbito en query y formulario, sin cabecera multipart manual", async () => {
    const upload = {
      file: file(),
      numero_invoice: "INV/26-01+A&B",
      tipo: "LG",
    };
    const preview = mock(invoicePreview);
    const signal = new AbortController().signal;
    const api = createInvoiceApi("live");
    expect(
      (await api.preview("EMBARQUES", upload, signal)).lines[0]
        .numero_parte_sistema,
    ).toBe(part);
    const body = preview.mock.calls[0][1].body as FormData;
    expect(body.get("file")).toBe(upload.file);
    expect(body.get("ambito")).toBe("EMBARQUES");
    expect(body.get("numero_invoice")).toBe(upload.numero_invoice);
    expect(preview.mock.calls[0][1].headers).not.toHaveProperty("Content-Type");
    expect(preview.mock.calls[0][1].signal).toBe(signal);
    const saved = mock({ success: true, invoice_id: 17 });
    await api.upload("EMBARQUES", upload);
    expect(saved.mock.calls[0][0]).toContain(
      "/invoices/upload?ambito=EMBARQUES",
    );
    expect((saved.mock.calls[0][1].body as FormData).get("file")).toBe(
      upload.file,
    );
  });
  it("conserva duplicados y bloquea respuestas mal formadas o errores sin repetir escrituras", async () => {
    mock({
      ...invoicePreview,
      duplicado: { motivo: "ARCHIVO_HASH", invoice_id: 9 },
    });
    expect(
      (
        await createInvoiceApi("live").preview("ALMACEN", {
          file: file(),
          numero_invoice: "",
          tipo: "",
        })
      ).duplicado?.motivo,
    ).toBe("ARCHIVO_HASH");
    mock({
      success: true,
      invoice: {},
      lines: {},
      packing: [],
      links: [],
      manual_receipts: [],
    });
    await expect(createInvoiceApi("live").detail("ALMACEN", 1)).rejects.toThrow(
      "lista válida",
    );
    const failed = mock(
      { success: false, error: "La invoice tiene vínculos activos." },
      409,
    );
    await expect(createInvoiceApi("live").remove("ALMACEN", 1)).rejects.toThrow(
      "vínculos activos",
    );
    expect(failed).toHaveBeenCalledOnce();
  });
  it("edita valores íntegros y confirma un pallet distinto con el contrato de aplicación", async () => {
    const api = createInvoiceApi("live");
    const draft = lineDraft({
      line_no: 1,
      raw_part_num: "RAW/01-A",
      numero_parte_sistema: part,
      descripcion: "Semiconductor",
      cantidad: "1",
      uom: "EA",
      costo_unitario: "0",
      costo_total: "0",
    });
    const patch = mock({ success: true });
    await api.updateLine("EMBARQUES", 2, 3, draft);
    expect(patch.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(patch.mock.calls[0][1].body)).toEqual(draft);
    const link = mock({ success: true, aplicados: 1, omitidos: 0 });
    await api.link(
      "ALMACEN",
      2,
      "MAT/26-01+A&B",
      4,
      "Pallet recibido distinto",
    );
    expect(JSON.parse(link.mock.calls[0][1].body)).toEqual({
      items: [
        {
          codigo_material_recibido: "MAT/26-01+A&B",
          packing_line_id: 4,
          permitir_pallet_distinto: true,
          nota_aplicacion: "Pallet recibido distinto",
        },
      ],
    });
    const receipt = mock({ success: true });
    await api.manual("ALMACEN", 2, 4, false, "Reversión");
    expect(JSON.parse(receipt.mock.calls[0][1].body)).toEqual({
      recibido: false,
      comentario: "Reversión",
    });
  });
  it("no envía operaciones de almacén desde el adaptador de Embarques", async () => {
    const fetcher = mock({ success: true });
    const api = createInvoiceApi("live");
    for (const action of ["apply", "unapply", "reapply"] as const)
      await expect(api.action("EMBARQUES", 1, action, {})).rejects.toThrow(
        "no está disponible",
      );
    await expect(api.manual("EMBARQUES", 1, 2, true, "")).rejects.toThrow(
      "no está disponible",
    );
    await expect(api.link("EMBARQUES", 1, "MAT/1", 2, "")).rejects.toThrow(
      "no está disponible",
    );
    expect(fetcher).not.toHaveBeenCalled();
    await api.action("EMBARQUES", 1, "close", { cerrado: false });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      cerrado: false,
    });
  });
  it.each(["INICIAL", "ACTUALIZACION", "SINCRONIZACION"] as PurchaseMode[])(
    "mantiene tipo y modo de compras %s en la vista previa y carga",
    async (modo) => {
      const api = createPurchaseApi("live");
      const upload = { file: file(), tipo: "OVEN" as const, modo };
      const preview = mock({
        success: true,
        sample: [{ numero_parte_sistema: part }],
        warnings: [],
        bloqueado_inicial: modo === "INICIAL",
        sync:
          modo === "SINCRONIZACION"
            ? { faltantes: 2, protegidas: [{ numero_parte: "HISTORICO" }] }
            : null,
      });
      const result = await api.preview(upload);
      expect(result.sample[0].numero_parte_sistema).toBe(part);
      const body = preview.mock.calls[0][1].body as FormData;
      expect(body.get("tipo")).toBe("OVEN");
      expect(body.get("modo")).toBe(modo);
      const saved = mock({ success: true });
      await api.upload(upload);
      expect((saved.mock.calls[0][1].body as FormData).get("modo")).toBe(modo);
    },
  );
  it("identifica transacciones por número y tipo, protegiendo barras, signos y estado de cierre", async () => {
    const number = "PO/26-001+A&B";
    const api = createPurchaseApi("live");
    const fetcher = mock({
      success: true,
      numero_transaccion: number,
      tipo: "LG",
      transaccion: { cerrada: false },
      lineas: [],
      links: [],
    });
    await api.detail(number, "LG");
    expect(fetcher.mock.calls[0][0]).toBe(
      "/backend/api/material_admin/compras/transacciones/PO%2F26-001%2BA%26B?tipo=LG",
    );
    const write = mock({ success: true });
    await api.action(number, "OVEN", "close", { cerrado: false });
    expect(JSON.parse(write.mock.calls[0][1].body)).toEqual({
      tipo: "OVEN",
      cerrado: false,
    });
    const initial = mock({ success: true, inicial_hecha: {} });
    await expect(api.initial()).rejects.toThrow("carga inicial");
    expect(initial).toHaveBeenCalledOnce();
  });
  it("pagina valorización remotamente con 500 y consulta el resumen completo con los mismos filtros", async () => {
    const api = createValuationApi("live");
    const signal = new AbortController().signal;
    const filters = {
      ...valuationDefaults(),
      numero_parte: part,
      codigo_material_recibido: "MAT/26-01+A&B",
      pallet_no: "007",
      fuente_costo: "INVOICE",
      include_zero_stock: "1",
    };
    const fetcher = mock({
      success: true,
      records: [{ costo_unitario: "0", stock_actual: "0" }],
      total: 1001,
      limit: 500,
      offset: 500,
    });
    const result = await api.list(filters, 2, 500, signal);
    const params = new URL(fetcher.mock.calls[0][0], "http://local")
      .searchParams;
    expect(Object.fromEntries(params)).toEqual({
      ...filters,
      limit: "500",
      offset: "500",
    });
    expect(result.records[0].stock_actual).toBe("0");
    expect(fetcher.mock.calls[0][1].signal).toBe(signal);
    const summary = mock({ success: true, records: [] });
    await api.summary(filters, signal);
    expect(
      Object.fromEntries(
        new URL(summary.mock.calls[0][0], "http://local").searchParams,
      ),
    ).toEqual(filters);
  });
  it("simula y aplica solo un bloque global de costos, sin inventar filtros o reenvíos", async () => {
    const api = createValuationApi("live");
    const fetcher = mock({
      success: true,
      preview_records: [],
      preview_total: 0,
    });
    await api.backfill(true);
    await api.backfill(false);
    expect(
      new URL(fetcher.mock.calls[0][0], "http://local").searchParams.get(
        "dry_run",
      ),
    ).toBe("1");
    expect(
      Object.fromEntries(
        new URL(fetcher.mock.calls[1][0], "http://local").searchParams,
      ),
    ).toEqual({ dry_run: "0", batch_size: "500", preview_limit: "5000" });
    expect(fetcher.mock.calls[1][1].method).toBe("POST");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({});
  });
  it("la demostración pagina antes de presentar y el resumen conserva todo el conjunto", async () => {
    const fetcher = vi.fn(() => {
      throw new Error("La demo no usa HTTP");
    });
    vi.stubGlobal("fetch", fetcher);
    const api = createValuationApi("demo");
    const filters = { ...valuationDefaults(), include_zero_stock: "1" };
    const first = await api.list(filters, 1, 500);
    const second = await api.list(filters, 2, 500);
    const last = await api.list(filters, 3, 500);
    expect([
      first.records.length,
      second.records.length,
      last.records.length,
    ]).toEqual([500, 500, 101]);
    expect(second.records[0].codigo_material_recibido).toBe("MAT/26-00501");
    expect(
      new Set(
        [...first.records, ...second.records, ...last.records].map(
          (row) => row.codigo_material_recibido,
        ),
      ).size,
    ).toBe(1101);
    expect(
      (await api.summary(filters)).reduce(
        (sum, row) => sum + Number(row.lotes),
        0,
      ),
    ).toBe(1101);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      createInvoiceApi("demo").detail("EMBARQUES", 101),
    ).rejects.toThrow("ámbito");
  });
  it("valida Excel, cantidades y costos sin normalizar los códigos del operador", () => {
    expect(fileIssue(null)).toContain("Selecciona");
    expect(fileIssue(new File(["x"], "invoice.xls"))).toContain("XLSX");
    const draft = lineDraft({
      line_no: 1,
      raw_part_num: "RAW/001-A",
      numero_parte_sistema: part,
      cantidad: 10,
      costo_unitario: 0,
      costo_total: 0,
    });
    expect(lineIssues(draft)).toEqual([]);
    expect(draft.numero_parte_sistema).toBe(part);
    expect(lineIssues({ ...draft, cantidad: "-1" })).not.toEqual([]);
    expect(lineIssues({ ...draft, costo_unitario: "abc" })).not.toEqual([]);
    expect(purchaseDefaults().fecha_inicio).toBe("");
  });
});
