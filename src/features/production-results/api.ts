import {
  backendFetch,
  downloadFile,
  ensureResponse,
  request,
  requestFile,
  saveDownload,
} from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import { closure, number, object, reportParams, rows, text } from "./model";
import type { Closure, Filters, Report, Row, ViewSpec } from "./types";

export function createResultsApi(mode: RuntimeMode) {
  async function read(path: string, init?: RequestInit): Promise<unknown> {
    if (mode === "live") return request<unknown>(path, init);
    init?.signal?.throwIfAborted();
    const { demoRequest } = await import("./demo");
    return demoRequest(path, init);
  }
  async function download(path: string, filename: string) {
    if (mode === "live") return downloadFile(path, filename);
    const { demoDownload } = await import("./demo");
    return demoDownload(path, filename);
  }
  return {
    async report(
      spec: ViewSpec,
      filters: Filters,
      searches: Filters,
      page: number,
      perPage: number,
      signal?: AbortSignal,
      progressId?: string,
    ): Promise<Report> {
      const params = reportParams(spec, filters, searches, page, perPage);
      if (spec.progressPath && progressId)
        params.set("progress_id", progressId);
      const data = await read(spec.path + "?" + params, { signal });
      if (spec.remote) {
        const record = object(data);
        if (
          ![record.total, record.page, record.per_page].every((value) =>
            Number.isSafeInteger(value),
          ) ||
          number(record.total) < 0 ||
          number(record.page) < 1 ||
          (number(record.per_page) < 1 &&
            !(
              record.per_page === 0 &&
              record.total === 0 &&
              Array.isArray(record.rows) &&
              record.rows.length === 0
            ))
        )
          throw new Error("El servidor devolvió una paginación inválida.");
        return {
          rows: spec.mapRows
            ? spec.mapRows(rows(record.rows), filters)
            : rows(record.rows),
          total: number(record.total),
          page: number(record.page),
          perPage: number(record.per_page) || perPage,
        };
      }
      const record = Array.isArray(data) ? null : object(data);
      const items = rows(record ? record[spec.responseKey ?? "items"] : data);
      const result = spec.mapRows ? spec.mapRows(items, filters) : items;
      return {
        rows: result,
        total: result.length,
        page: 1,
        perPage,
        ...(Array.isArray(record?.warnings)
          ? { warnings: record.warnings.map(text) }
          : {}),
        ...(record?.meta ? { meta: object(record.meta) } : {}),
        ...(record?.summary || record?.resumen
          ? { summary: object(record.summary ?? record.resumen) }
          : {}),
      };
    },
    async exportReport(
      spec: ViewSpec,
      filters: Filters,
      searches: Filters,
      page: number,
      perPage: number,
      loadedRows: readonly Row[],
    ) {
      if (spec.exportPath) {
        const params = reportParams(spec, filters, searches, page, perPage);
        if (spec.exportPage === false) {
          params.delete("page");
          params.delete("per_page");
        }
        return download(spec.exportPath + "?" + params, spec.id + ".xlsx");
      }
      await exportSpreadsheet(spec.id + ".xlsx", [
        {
          name: "Inventario",
          rows: [
            spec.columns.map((column) => column.title),
            ...loadedRows.map((row) =>
              spec.columns.map((column) =>
                column.numeric
                  ? number(row[column.key])
                  : text(row[column.key]),
              ),
            ),
          ],
        },
      ]);
    },
    async progress(path: string, progressId: string, signal?: AbortSignal) {
      return object(
        await read(path + "?" + new URLSearchParams({ id: progressId }), {
          signal,
        }),
      );
    },
    async visionInfo(id: string, signal?: AbortSignal) {
      const path = "/api/vision/image-info?" + new URLSearchParams({ id });
      if (mode === "demo") return object(await read(path, { signal }));
      const response = await backendFetch(path, { signal });
      const data: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      if (
        response.status === 404 &&
        data &&
        typeof data === "object" &&
        "record_id" in data
      )
        return object(data);
      await ensureResponse(response);
      return object(data);
    },
    async visionImage(id: string, signal?: AbortSignal) {
      return requestFile(
        "/api/vision/image-file?" + new URLSearchParams({ id }),
        "vision-" + id + ".jpg",
        signal,
      );
    },
    async exportComparison(runs: readonly Row[], onlyDiffs: boolean) {
      if (runs.length < 2)
        throw new Error("Selecciona al menos dos ejecuciones.");
      if (mode === "demo") {
        const { comparisonDownload } = await import("./machineDemo");
        return comparisonDownload(runs, onlyDiffs);
      }
      const body = JSON.stringify({
        runs: runs.map(({ barcode, ts, fecha, hora, linea, resultado }) => ({
          barcode,
          ts,
          fecha,
          hora,
          linea,
          resultado,
        })),
        only_diffs: onlyDiffs,
      });
      const file = await requestFile(
        "/api/ict/export-compare",
        "comparacion_ict.xlsx",
        undefined,
        false,
        { method: "POST", body },
      );
      saveDownload(file.blob, file.name);
    },
    async snapshotDates(signal?: AbortSignal) {
      const data = object(
        await read("/api/snapshot_inventario/fechas", { signal }),
      );
      if (!Array.isArray(data.fechas))
        throw new Error("Las fechas de snapshot no son válidas.");
      return data.fechas.map((item) =>
        typeof item === "string"
          ? { fecha: item, hora: "" }
          : { fecha: text(object(item).fecha), hora: text(object(item).hora) },
      );
    },
    async syncExits() {
      return object(
        await read("/api/inventario_exceso/exits/sync", { method: "POST" }),
      );
    },
    async closure(signal?: AbortSignal): Promise<Closure> {
      return closure(
        await read("/api/inventario_exceso/cierre/bootstrap", { signal }),
      );
    },
    async previewClosure(file: File): Promise<Closure> {
      if (!file.name.toLowerCase().endsWith(".csv"))
        throw new Error("Selecciona un archivo CSV.");
      const body = new FormData();
      body.append("closure_file", file);
      return closure(
        await read("/api/inventario_exceso/cierre/preview", {
          method: "POST",
          body,
        }),
      );
    },
    async confirmClosure(batchId: number) {
      if (!Number.isSafeInteger(batchId) || batchId < 1)
        throw new Error("El cierre no tiene identificador válido.");
      const data = object(
        await read("/api/inventario_exceso/cierre/confirm", {
          method: "POST",
          body: JSON.stringify({ batchId }),
        }),
      );
      return {
        message: text(data.message) || "Cierre confirmado.",
        history: rows(data.history),
      };
    },
    async closureDetail(
      batchId: number,
      signal?: AbortSignal,
    ): Promise<Closure> {
      if (!Number.isSafeInteger(batchId) || batchId < 1)
        throw new Error("El cierre no tiene identificador válido.");
      const data = object(
        await read("/api/inventario_exceso/cierre/history/" + batchId, {
          signal,
        }),
      );
      const batch = object(data.batch);
      const result = closure(data.payload);
      return {
        ...result,
        metadata: {
          ...result.metadata,
          closureDateTime: batch.closed_at || batch.created_at,
          closureUser: batch.confirmed_by || batch.created_by,
        },
        valid: batch.status === "pending",
        batchId: batch.status === "pending" ? batchId : null,
      };
    },
    closureTemplate: () =>
      download(
        "/api/inventario_exceso/cierre/template",
        "plantilla_cierre_exceso.csv",
      ),
    exportClosure: (batchId: number) =>
      download(
        "/api/inventario_exceso/cierre/history/" + batchId + "/export",
        "cierre_exceso_" + batchId + ".csv",
      ),
  };
}
