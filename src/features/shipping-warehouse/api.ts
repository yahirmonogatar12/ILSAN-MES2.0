import { request, requestFile, saveDownload } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import {
  filterParams,
  movementType,
  paths,
  recordId,
  ROOT,
  text,
} from "./model";
import type {
  Adjustment,
  Attachment,
  BatchPreview,
  Filters,
  HistoryKind,
  ListKind,
  Listing,
  QaKind,
  ReceiptLine,
  ReturnPayload,
  Row,
} from "./types";

export function object(value: unknown): Row {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Row;
  throw new Error("El servidor devolvió un registro inválido.");
}
export function optionalObject(value: unknown): Row {
  return value == null ? {} : object(value);
}
export function records(value: unknown): Row[] {
  if (!Array.isArray(value))
    throw new Error("El servidor devolvió una lista inválida.");
  return value.map(object);
}
function listing(value: unknown, field = "rows"): Listing {
  if (Array.isArray(value))
    return { rows: records(value), summary: {}, metadata: {} };
  const data = object(value);
  return {
    rows: records(data[field]),
    summary: optionalObject(data.summary),
    metadata: optionalObject(data.metadata ?? data.period),
  };
}
function batchPreview(value: unknown): BatchPreview {
  const data = object(value);
  const preview = optionalObject(data.preview);
  const valid = data.valid === true;
  return {
    valid,
    batchId: valid ? recordId(data.batchId) : null,
    batchCode: text(data.batchCode),
    rows: records(preview.rows ?? []),
    summary: optionalObject(preview.summary),
    metadata: optionalObject(data.metadata),
    history: records(data.history ?? []),
    errors: Array.isArray(data.errors) ? data.errors.map(text) : [],
    closureImpact: optionalObject(preview.closureImpact),
  };
}
function withParams(path: string, params: URLSearchParams) {
  return params.size ? path + "?" + params.toString() : path;
}
const json = (method: string, data: unknown): RequestInit => ({
  method,
  body: JSON.stringify(data),
});
const closure = ROOT + "/inventario-general/cierre";
const qa = ROOT + "/qa-pendientes";
const adjust = (kind: "entries" | "exits") =>
  ROOT + "/" + paths[kind] + "/ajustes";
const movementPath = (row: Row) =>
  ROOT +
  "/movimientos/" +
  movementType(row.movement_type) +
  "/" +
  recordId(row.record_id ?? row.id);

export function createWarehouseApi(mode: RuntimeMode) {
  async function read(path: string, init?: RequestInit): Promise<unknown> {
    if (mode !== "demo") return request<unknown>(path, init);
    const { demoRequest } = await import("./demo");
    init?.signal?.throwIfAborted();
    return demoRequest(path, init);
  }
  const get = (path: string, signal?: AbortSignal) => read(path, { signal });
  const write = async (path: string, data: unknown, method = "POST") =>
    object(await read(path, json(method, data)));
  async function download(path: string, name: string) {
    if (mode === "demo") {
      const { demoDownload } = await import("./demo");
      return demoDownload(path, name);
    }
    const result = await requestFile(path, name);
    saveDownload(result.blob, result.name);
  }

  return {
    async list(kind: ListKind, filters: Filters, signal?: AbortSignal) {
      return listing(
        await get(
          withParams(ROOT + "/" + paths[kind], filterParams(kind, filters)),
          signal,
        ),
      );
    },
    exportList(kind: ListKind, filters: Filters, movement?: "entry" | "exit") {
      const params = filterParams(kind, filters);
      if (kind === "returns" && movement) params.set("movement", movement);
      return download(
        withParams(ROOT + "/" + paths[kind] + "/export", params),
        paths[kind].replaceAll("/", "-") + "-embarques.xlsx",
      );
    },
    async boxes(
      kind: Exclude<HistoryKind, "returns">,
      folio: string,
      signal?: AbortSignal,
    ) {
      return listing(
        await get(
          withParams(
            ROOT + "/" + paths[kind] + "/cajas",
            new URLSearchParams({ folio }),
          ),
          signal,
        ),
      );
    },
    exportBoxes(kind: "entries" | "exits", folio: string) {
      return download(
        withParams(
          ROOT + "/" + paths[kind] + "/cajas/export",
          new URLSearchParams({ folio }),
        ),
        "cajas-embarques.xlsx",
      );
    },
    async invoices(signal?: AbortSignal) {
      return listing(await get(ROOT + "/entradas/invoices", signal));
    },
    confirmReceipt(invoiceId: number, lines: ReceiptLine[]) {
      return write(
        "/api/material_admin/invoices/" +
          recordId(invoiceId) +
          "/manual-receipts/bulk?ambito=EMBARQUES",
        { lines, comentario: "Entrada Invoice Embarques" },
      );
    },
    assignDeparture(
      exitId: number,
      departureCode: string,
      departureQuantity: number,
    ) {
      return write(ROOT + "/salidas/" + recordId(exitId) + "/departure", {
        departureCode,
        departureQuantity,
      });
    },
    manualAdjustment(kind: "entries" | "exits", data: Adjustment) {
      return write(adjust(kind) + "/manual", data);
    },
    async previewAdjustment(
      kind: "entries" | "exits",
      file: File,
      reason: string,
      movementAt: string,
    ) {
      const body = new FormData();
      body.append("adjustment_file", file);
      body.append("reason", reason);
      body.append("movement_at", movementAt);
      return batchPreview(
        await read(adjust(kind) + "/preview", { method: "POST", body }),
      );
    },
    adjustmentBatch(
      kind: "entries" | "exits",
      action: "confirm" | "cancel",
      batchId: number,
    ) {
      return write(adjust(kind) + "/" + action, { batchId: recordId(batchId) });
    },
    adjustmentTemplate(kind: "entries" | "exits") {
      return download(adjust(kind) + "/template", "plantilla-ajustes.csv");
    },
    registerReturn(data: ReturnPayload) {
      return write("/api/shipping/material/returns", data);
    },
    async returnPdf(rows: readonly Row[]): Promise<Attachment> {
      if (mode === "demo") {
        const { demoReturnPdf } = await import("./demo");
        return demoReturnPdf(rows);
      }
      return requestFile(
        ROOT + "/retorno/print-pdf",
        "salidas-retorno.pdf",
        undefined,
        false,
        json("POST", { rows }),
      );
    },
    adjustMovement(row: Row, changes: Row, notes: string) {
      return write(movementPath(row), { changes, notes }, "PATCH");
    },
    deleteMovement(row: Row, password: string, notes: string) {
      return write(movementPath(row), { password, notes }, "DELETE");
    },
    saveCatalog(data: Row, catalogId?: number) {
      return write(
        ROOT +
          "/catalogo" +
          (catalogId === undefined ? "" : "/" + recordId(catalogId)),
        data,
        catalogId === undefined ? "POST" : "PATCH",
      );
    },
    deleteCatalog(catalogId: number, password: string, notes: string) {
      return write(
        ROOT + "/catalogo/" + recordId(catalogId),
        { password, notes },
        "DELETE",
      );
    },
    async closureBootstrap(signal?: AbortSignal) {
      const data = object(await get(closure + "/bootstrap", signal));
      return {
        ...listing(data.preview),
        metadata: optionalObject(data.metadata),
        history: records(data.history),
      };
    },
    async closurePreview(file: File) {
      const body = new FormData();
      body.append("closure_file", file);
      return batchPreview(
        await read(closure + "/preview", { method: "POST", body }),
      );
    },
    closureBatch(action: "confirm" | "cancel", batchId: number) {
      return write(closure + "/" + action, { batchId: recordId(batchId) });
    },
    closureTemplate() {
      return download(closure + "/template", "plantilla-cierre-embarques.csv");
    },
    async closureDetail(batchId: number, signal?: AbortSignal) {
      const data = object(
        await get(closure + "/history/" + recordId(batchId), signal),
      );
      return { ...listing(data.payload), batch: object(data.batch) };
    },
    closureExport(batchId: number) {
      return download(
        closure + "/history/" + recordId(batchId) + "/export",
        "cierre-embarques.xlsx",
      );
    },
    async qaSummary(filters: Filters, signal?: AbortSignal) {
      const data = object(
        await get(withParams(qa, filterParams("qa", filters)), signal),
      );
      return {
        entrada: listing(data.entry),
        liberacion: listing(data.release),
      };
    },
    async qaBoxes(
      kind: QaKind,
      part: string,
      filters: Filters,
      signal?: AbortSignal,
    ) {
      const params = filterParams("qa", filters);
      params.set("tipo", kind);
      params.set("part_number", part);
      return listing(
        await get(withParams(qa + "/cajas", params), signal),
        "boxes",
      );
    },
    qaExport(kind: QaKind, part: string, filters: Filters) {
      const params = filterParams("qa", filters);
      params.set("tipo", kind);
      params.set("part_number", part);
      return download(
        withParams(qa + "/cajas/export", params),
        "pendientes-qa-embarques.xlsx",
      );
    },
  };
}
export type WarehouseApi = ReturnType<typeof createWarehouseApi>;
