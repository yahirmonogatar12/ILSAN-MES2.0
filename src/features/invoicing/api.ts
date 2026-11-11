import { downloadFile, request, requestFile } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import {
  invoiceIsOpen,
  listParams,
  record,
  rows,
  text,
  valuationParams,
} from "./model";
import type {
  DataRow,
  InvoiceApi,
  InvoiceScope,
  InvoiceUpload,
  PurchaseApi,
  PurchaseUpload,
  RecordList,
  RemoteList,
  ValuationApi,
} from "./types";
const ROOT = "/api/material_admin";
function invoicePath(
  scope: InvoiceScope,
  tail = "",
  params = new URLSearchParams(),
) {
  params.set("ambito", scope);
  return `${ROOT}/invoices${tail}?${params}`;
}
const idPath = (id: number) => {
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error("Identificador inválido.");
  return String(id);
};
function invoiceForm(scope: InvoiceScope, upload: InvoiceUpload) {
  const data = new FormData();
  data.append("file", upload.file);
  data.append("numero_invoice", upload.numero_invoice);
  data.append("tipo", upload.tipo);
  data.append("ambito", scope);
  return data;
}
function purchaseForm(upload: PurchaseUpload) {
  const data = new FormData();
  data.append("file", upload.file);
  data.append("tipo", upload.tipo);
  data.append("modo", upload.modo);
  return data;
}
function resultList(value: unknown): RecordList {
  const result = record(value);
  const records = rows(result.records);
  const total = Number(result.total ?? records.length);
  if (!Number.isSafeInteger(total) || total < records.length)
    throw new Error("El total recibido es inválido.");
  return { records, total };
}
const read = async (path: string, signal?: AbortSignal) =>
  record(await request<unknown>(path, { signal }));
const write = async (path: string, payload: DataRow = {}, method = "POST") =>
  record(
    await request<unknown>(path, { method, body: JSON.stringify(payload) }),
  );
function warehouseOnly(scope: InvoiceScope) {
  if (scope !== "ALMACEN")
    throw new Error(
      "Esta acción de almacén no está disponible en Invoice Embarques.",
    );
}
export function createInvoiceApi(mode: RuntimeMode): InvoiceApi {
  const demo = () => import("./demo").then((module) => module.demoInvoices);
  return {
    async list(scope, filters, signal) {
      if (mode === "demo") return (await demo()).list(scope, filters, signal);
      const load = async (params: URLSearchParams) =>
        resultList(await read(invoicePath(scope, "", params), signal));
      // Reuse the server's date-independent PENDIENTES view. Other modules
      // and the existing backend retain their own filtering contract.
      const includeOpen =
        filters.estado !== "PENDIENTES" &&
        !["APLICADA", "CANCELADA"].includes(filters.estado) &&
        !!(filters.fecha_inicio.trim() || filters.fecha_fin.trim());
      if (!includeOpen) return load(listParams(filters));
      const [dated, opened] = await Promise.all([
        load(listParams(filters)),
        load(listParams({ ...filters, estado: "PENDIENTES" })),
      ]);
      const unique = new Map(dated.records.map((row) => [Number(row.id), row]));
      for (const row of opened.records) {
        if (
          invoiceIsOpen(row) &&
          (!filters.estado || row.estado === filters.estado) &&
          !unique.has(Number(row.id))
        )
          unique.set(Number(row.id), row);
      }
      const records = [...unique.values()].sort(
        (a, b) =>
          text(b.fecha_carga).localeCompare(text(a.fecha_carga)) ||
          Number(b.id) - Number(a.id),
      );
      return { records, total: records.length };
    },
    async detail(scope, id, signal) {
      if (mode === "demo") return (await demo()).detail(scope, id, signal);
      const data = await read(invoicePath(scope, `/${idPath(id)}`), signal);
      return {
        invoice: record(data.invoice),
        lines: rows(data.lines),
        packing: rows(data.packing),
        links: rows(data.links),
        manual_receipts: rows(data.manual_receipts),
      };
    },
    async preview(scope, upload, signal) {
      if (mode === "demo") return (await demo()).preview(scope, upload, signal);
      const data = record(
        await request<unknown>(invoicePath(scope, "/preview"), {
          method: "POST",
          body: invoiceForm(scope, upload),
          signal,
        }),
      );
      if (typeof data.numero_invoice !== "string")
        throw new Error("La vista previa no contiene el número de invoice.");
      return {
        ...data,
        numero_invoice: data.numero_invoice,
        lines: rows(data.lines),
        warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
        duplicado: data.duplicado ? record(data.duplicado) : null,
      };
    },
    async upload(scope, upload) {
      if (mode === "demo") return (await demo()).upload(scope, upload);
      return record(
        await request<unknown>(invoicePath(scope, "/upload"), {
          method: "POST",
          body: invoiceForm(scope, upload),
        }),
      );
    },
    async remove(scope, id) {
      if (mode === "demo") return (await demo()).remove(scope, id);
      return write(invoicePath(scope, `/${idPath(id)}`), {}, "DELETE");
    },
    async updateLine(scope, id, line, draft) {
      if (mode === "demo")
        return (await demo()).updateLine(scope, id, line, draft);
      return write(
        invoicePath(scope, `/${idPath(id)}/lines/${idPath(line)}`),
        { ...draft },
        "PATCH",
      );
    },
    async removeLine(scope, id, line) {
      if (mode === "demo") return (await demo()).removeLine(scope, id, line);
      return write(
        invoicePath(scope, `/${idPath(id)}/lines/${idPath(line)}`),
        {},
        "DELETE",
      );
    },
    async action(scope, id, action, payload) {
      if (action !== "close") warehouseOnly(scope);
      if (mode === "demo")
        return (await demo()).action(scope, id, action, payload);
      return write(invoicePath(scope, `/${idPath(id)}/${action}`), payload);
    },
    async manual(scope, id, packing, recibido, comentario) {
      warehouseOnly(scope);
      if (mode === "demo")
        return (await demo()).manual(scope, id, packing, recibido, comentario);
      return write(
        invoicePath(
          scope,
          `/${idPath(id)}/packing/${idPath(packing)}/manual-receipt`,
        ),
        { recibido, comentario },
      );
    },
    async partial(scope, id, code, signal) {
      warehouseOnly(scope);
      if (mode === "demo")
        return (await demo()).partial(scope, id, code, signal);
      const data = await read(
        invoicePath(
          scope,
          `/${idPath(id)}/partial-packing`,
          new URLSearchParams({ codigo_material_recibido: code }),
        ),
        signal,
      );
      return { ...data, records: rows(data.records) };
    },
    async link(scope, id, code, packing, note) {
      warehouseOnly(scope);
      if (mode === "demo")
        return (await demo()).link(scope, id, code, packing, note);
      return write(invoicePath(scope, `/${idPath(id)}/apply`), {
        items: [
          {
            codigo_material_recibido: code,
            packing_line_id: packing,
            permitir_pallet_distinto: true,
            nota_aplicacion: note || "Material recibido en pallet distinto",
          },
        ],
      });
    },
    async file(scope, id, signal) {
      if (mode === "demo") return (await demo()).file(scope, id, signal);
      return requestFile(
        invoicePath(scope, `/${idPath(id)}/file`),
        "invoice.xlsx",
        signal,
      );
    },
    async download(scope, id) {
      if (mode === "demo") return (await demo()).download(scope, id);
      await downloadFile(
        invoicePath(
          scope,
          `/${idPath(id)}/file`,
          new URLSearchParams({ download: "1" }),
        ),
        "invoice.xlsx",
      );
    },
  };
}
export function createPurchaseApi(mode: RuntimeMode): PurchaseApi {
  const demo = () => import("./demo").then((module) => module.demoPurchases);
  const path = (number: string, type: string, action = "") =>
    `${ROOT}/compras/transacciones/${encodeURIComponent(number)}${action}?${new URLSearchParams({ tipo: type })}`;
  return {
    async loads(type, signal) {
      if (mode === "demo") return (await demo()).loads(type, signal);
      return resultList(
        await read(
          `${ROOT}/compras/cargas?${new URLSearchParams({ tipo: type })}`,
          signal,
        ),
      );
    },
    async file(id, signal) {
      if (mode === "demo") return (await demo()).file(id, signal);
      return requestFile(
        `${ROOT}/compras/cargas/${idPath(id)}/file`,
        `compras_${id}.xlsx`,
        signal,
      );
    },
    async download(id) {
      if (mode === "demo") return (await demo()).download(id);
      await downloadFile(
        `${ROOT}/compras/cargas/${idPath(id)}/file?download=1`,
        `compras_${id}.xlsx`,
      );
    },
    async list(filters, signal) {
      if (mode === "demo") return (await demo()).list(filters, signal);
      return resultList(
        await read(
          `${ROOT}/compras/transacciones?${listParams(filters)}`,
          signal,
        ),
      );
    },
    async detail(number, type, signal) {
      if (mode === "demo") return (await demo()).detail(number, type, signal);
      const data = await read(path(number, type), signal);
      if (
        typeof data.tipo !== "string" ||
        typeof data.numero_transaccion !== "string"
      )
        throw new Error("La transacción recibida no es válida.");
      return {
        numero_transaccion: data.numero_transaccion,
        tipo: data.tipo,
        transaccion: record(data.transaccion),
        lineas: rows(data.lineas),
        links: rows(data.links),
      };
    },
    async initial(signal) {
      if (mode === "demo") return (await demo()).initial(signal);
      const data = record(
        (await read(`${ROOT}/compras/estado-inicial`, signal)).inicial_hecha,
      );
      if (typeof data.LG !== "boolean" || typeof data.OVEN !== "boolean")
        throw new Error(
          "No se pudo verificar la carga inicial. Actualiza antes de cargar.",
        );
      return { LG: data.LG, OVEN: data.OVEN };
    },
    async preview(upload, signal) {
      if (mode === "demo") return (await demo()).preview(upload, signal);
      const data = record(
        await request<unknown>(`${ROOT}/compras/preview`, {
          method: "POST",
          body: purchaseForm(upload),
          signal,
        }),
      );
      return {
        ...data,
        sample: rows(data.sample),
        warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
        bloqueado_inicial: data.bloqueado_inicial === true,
        sync: data.sync ? record(data.sync) : null,
      };
    },
    async upload(upload) {
      if (mode === "demo") return (await demo()).upload(upload);
      return record(
        await request<unknown>(`${ROOT}/compras/upload`, {
          method: "POST",
          body: purchaseForm(upload),
        }),
      );
    },
    async action(number, type, action, payload) {
      if (mode === "demo")
        return (await demo()).action(number, type, action, payload);
      return write(path(number, type, `/${action}`), {
        ...payload,
        tipo: type,
      });
    },
  };
}
export function createValuationApi(mode: RuntimeMode): ValuationApi {
  const demo = () => import("./demo").then((module) => module.demoValuation);
  const root = `${ROOT}/inventory/valuation`;
  return {
    async list(filters, page, size, signal) {
      if (mode === "demo")
        return (await demo()).list(filters, page, size, signal);
      const params = valuationParams(filters);
      params.set("limit", String(size));
      params.set("offset", String((page - 1) * size));
      const data = await read(`${root}?${params}`, signal);
      const list = resultList(data);
      if (
        !Number.isSafeInteger(data.limit) ||
        !Number.isSafeInteger(data.offset) ||
        Number(data.limit) < 1 ||
        Number(data.offset) < 0
      )
        throw new Error("Paginación de valorización inválida.");
      return {
        ...list,
        limit: Number(data.limit),
        offset: Number(data.offset),
      } satisfies RemoteList;
    },
    async summary(filters, signal) {
      if (mode === "demo") return (await demo()).summary(filters, signal);
      return rows(
        (await read(`${root}/summary?${valuationParams(filters)}`, signal))
          .records,
      );
    },
    async export(filters) {
      if (mode === "demo") return (await demo()).export(filters);
      await downloadFile(
        `${root}/export?${valuationParams(filters)}`,
        "valorizacion_inventario.xlsx",
      );
    },
    async backfill(dryRun) {
      if (mode === "demo") return (await demo()).backfill(dryRun);
      return write(
        `${root}/backfill?${new URLSearchParams({ dry_run: dryRun ? "1" : "0", batch_size: "500", preview_limit: "5000" })}`,
      );
    },
  };
}
