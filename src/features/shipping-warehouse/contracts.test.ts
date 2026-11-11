import { describe, expect, it, vi } from "vitest";
import { createWarehouseApi } from "./api";
import { filtersFor, receiptLines, returnRows } from "./model";
import type { Row } from "./types";

function mockServer(...responses: unknown[]) {
  const replies = [...responses];
  const fetcher = vi.fn(async (_url: string, _init: RequestInit) => {
    const reply = replies.shift();
    if (reply === undefined) throw new Error("Solicitud inesperada.");
    return reply instanceof Response ? reply : Response.json(reply);
  });
  vi.stubGlobal("fetch", fetcher);
  return { api: createWarehouseApi("live"), calls: fetcher.mock.calls };
}

function payload(init: RequestInit) {
  return JSON.parse(String(init.body));
}

describe("Contratos de Almacén de Embarques", () => {
  it("lee el historial sin transformar identificadores y conserva filtros y señal", async () => {
    const rows = [{ id: 41, folio: "ENT/001-A", part_number: "0001/03-C" }];
    const { api, calls } = mockServer(rows, {
      rows,
      summary: { total_boxes: 1 },
    });
    const { signal } = new AbortController();
    const filters = {
      ...filtersFor("entries"),
      search: "0001/03-C",
      fecha_desde: "2026-11-01",
      fecha_hasta: "2026-11-10",
    };
    expect((await api.list("entries", filters, signal)).rows).toEqual(rows);
    expect(await api.boxes("entries", rows[0].folio, signal)).toMatchObject({
      rows,
      summary: { total_boxes: 1 },
    });
    expect(calls[0][0]).toBe(
      "/backend/api/almacen-embarques/entradas?search=0001%2F03-C&fecha_desde=2026-11-01&fecha_hasta=2026-11-10",
    );
    expect(calls[1][0]).toBe(
      "/backend/api/almacen-embarques/entradas/cajas?folio=ENT%2F001-A",
    );
    expect(calls.map(([, init]) => init.signal)).toEqual([signal, signal]);
  });

  it("confirma un invoice completo con las líneas de packing y permite una cantidad real de cero", async () => {
    const { api, calls } = mockServer({ success: true, entradas: [] });
    const rows = [
      { part_number: "0001/03-C", quantity: 25, packing_line_ids: [11, 12] },
      { part_number: "EBR23966228-01-A", quantity: 8, packing_line_ids: [13] },
    ];
    const complete = new Set(["EBR23966228-01-A"]);
    expect(() => receiptLines(rows, {}, complete)).toThrow("0001/03-C");
    await api.confirmReceipt(
      17,
      receiptLines(rows, { "0001/03-C": "0" }, complete),
    );
    expect(calls[0][0]).toBe(
      "/backend/api/material_admin/invoices/17/manual-receipts/bulk?ambito=EMBARQUES",
    );
    expect(calls[0][1].method).toBe("POST");
    expect(payload(calls[0][1])).toEqual({
      comentario: "Entrada Invoice Embarques",
      lines: [
        {
          part_number: "0001/03-C",
          cantidad_confirmada: 0,
          packing_line_ids: [11, 12],
        },
        {
          part_number: "EBR23966228-01-A",
          cantidad_confirmada: 8,
          packing_line_ids: [13],
        },
      ],
    });
  });

  it("envía el archivo de ajustes al validador y confirma únicamente el borrador devuelto", async () => {
    const { api, calls } = mockServer(
      { valid: false, errors: ["Número de parte inexistente."] },
      {
        valid: true,
        batchId: 71,
        batchCode: "A-71",
        preview: {
          rows: [{ part_number: "0001/03-C", quantity: 2 }],
          closureImpact: { impactedRows: 1 },
        },
      },
      { success: true, insertedRows: 1, updatedClosureRows: 1 },
    );
    const file = new File(["part_number,quantity\n0001/03-C,2"], "ajustes.csv");
    const preview = () =>
      api.previewAdjustment("exits", file, "Conteo", "2026-11-10T08:00");
    expect(await preview()).toMatchObject({
      valid: false,
      batchId: null,
      errors: ["Número de parte inexistente."],
    });
    const draft = await preview();
    expect(draft).toMatchObject({
      batchId: 71,
      closureImpact: { impactedRows: 1 },
    });
    await api.adjustmentBatch("exits", "confirm", draft.batchId!);
    const [url, request] = calls[1];
    expect(url).toBe("/backend/api/almacen-embarques/salidas/ajustes/preview");
    const form = request.body as FormData;
    expect(form.get("adjustment_file")).toBe(file);
    expect(form.get("reason")).toBe("Conteo");
    expect(form.get("movement_at")).toBe("2026-11-10T08:00");
    expect(calls[2][0]).toBe(
      "/backend/api/almacen-embarques/salidas/ajustes/confirm",
    );
    expect(payload(calls[2][1])).toEqual({ batchId: 71 });
  });

  it("usa el mismo identificador al recuperar y cancelar un cierre", async () => {
    const rows = [{ part_number: "0001/03-C", csv_current_qty: 25 }];
    const { api, calls } = mockServer(
      { valid: true, batchId: 45, preview: { rows } },
      {
        batch: { id: 45, status: "draft" },
        payload: { rows, metadata: { closureDate: "2026-11-10" } },
      },
      { success: true },
    );
    const file = new File(
      ["part_number,current_qty\n0001/03-C,25"],
      "cierre.csv",
    );
    const draft = await api.closurePreview(file);
    expect((calls[0][1].body as FormData).get("closure_file")).toBe(file);
    expect(draft.rows).toEqual(rows);
    expect(await api.closureDetail(draft.batchId!)).toMatchObject({
      rows,
      batch: { id: 45, status: "draft" },
      metadata: { closureDate: "2026-11-10" },
    });
    await api.closureBatch("cancel", draft.batchId!);
    expect(calls[1][0]).toBe(
      "/backend/api/almacen-embarques/inventario-general/cierre/history/45",
    );
    expect(calls[2][0]).toBe(
      "/backend/api/almacen-embarques/inventario-general/cierre/cancel",
    );
    expect(payload(calls[2][1])).toEqual({ batchId: 45 });
  });

  it("conserva el folio del remanente y manda motivo y cambios al corregir movimientos", async () => {
    const { api, calls } = mockServer(
      { success: true, splitCreated: true, splitFolio: "SAL-24-2" },
      { success: true },
      { success: true },
    );
    const exit = { movement_type: "exit", record_id: 24 };
    expect(await api.assignDeparture(24, "DEP-0008", 7)).toMatchObject({
      splitCreated: true,
      splitFolio: "SAL-24-2",
    });
    await api.adjustMovement(
      exit,
      { cantidad: 9, departure: "DEP-0008" },
      "Conteo",
    );
    await api.deleteCatalog(12, "demo-pass", "Duplicado");
    expect(
      calls.map(([url, init]) => [url, init.method, payload(init)]),
    ).toEqual([
      [
        "/backend/api/almacen-embarques/salidas/24/departure",
        "POST",
        { departureCode: "DEP-0008", departureQuantity: 7 },
      ],
      [
        "/backend/api/almacen-embarques/movimientos/exit/24",
        "PATCH",
        { changes: { cantidad: 9, departure: "DEP-0008" }, notes: "Conteo" },
      ],
      [
        "/backend/api/almacen-embarques/catalogo/12",
        "DELETE",
        { password: "demo-pass", notes: "Duplicado" },
      ],
    ]);
  });

  it("separa retornos y descarga el PDF binario de las salidas seleccionadas", async () => {
    const entry = { folio: "R-01", return_quantity: 6, loss_quantity: 0 };
    const exit = { folio: "R-02", return_quantity: 3, loss_quantity: 2 };
    const rows: Row[] = [
      entry,
      exit,
      { folio: "R-03", return_quantity: 0, loss_quantity: 0 },
    ];
    expect(returnRows(rows, false)).toEqual([entry]);
    const selected = returnRows(rows, true).map((row) => ({
      ...row,
      movement_quantity: row.loss_quantity,
    }));
    const { api, calls } = mockServer(
      new Response("%PDF-1.4", {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="retorno.pdf"',
        },
      }),
    );
    const file = await api.returnPdf(selected);
    expect(file.name).toBe("retorno.pdf");
    expect(file.blob.type).toBe("application/pdf");
    expect(calls[0][0]).toBe(
      "/backend/api/almacen-embarques/retorno/print-pdf",
    );
    expect(calls[0][1].method).toBe("POST");
    expect(payload(calls[0][1])).toEqual({
      rows: [{ ...exit, movement_quantity: 2 }],
    });
  });

  it("consulta las cajas de QA con el mismo rango y el tipo de pendiente seleccionado", async () => {
    const boxes = [{ box_code: "QA/01-A", pending_quantity: 11 }];
    const { api, calls } = mockServer({
      boxes,
      summary: { pending_quantity: 11 },
    });
    const filters = {
      ...filtersFor("qa"),
      search: "QA/01-A",
      fecha_desde: "2026-11-10",
      fecha_hasta: "2026-11-10",
    };
    expect(await api.qaBoxes("liberacion", "0001/03-C", filters)).toMatchObject(
      {
        rows: boxes,
        summary: { pending_quantity: 11 },
      },
    );
    expect(calls[0][0]).toBe(
      "/backend/api/almacen-embarques/qa-pendientes/cajas?search=QA%2F01-A&fecha_desde=2026-11-10&fecha_hasta=2026-11-10&tipo=liberacion&part_number=0001%2F03-C",
    );
  });
});
