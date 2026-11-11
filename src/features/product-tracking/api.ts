import { request, requestFile, saveDownload } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import {
  batchResult,
  pieceResult,
  traceParams,
  traceResult,
  validateFile,
} from "./model";
import type { Filters, TraceView } from "./types";

function fileBody(file: File, excel = false) {
  const issue = validateFile(file);
  if (issue) throw new Error(issue);
  const body = new FormData();
  body.append("file", file);
  if (excel) body.append("formato", "excel");
  return body;
}
export function createTrackingApi(mode: RuntimeMode) {
  return {
    async lookup(codigo: string, signal?: AbortSignal) {
      if (mode === "demo")
        return (await import("./demo")).lookup(codigo, signal);
      return pieceResult(
        await request(
          "/api/production_tracking/buscar?" +
            new URLSearchParams({ codigo: codigo.trim() }),
          { signal },
        ),
      );
    },
    async batch(file: File, signal?: AbortSignal) {
      const body = fileBody(file);
      if (mode === "demo") return (await import("./demo")).batch(file, signal);
      return batchResult(
        await request("/api/production_tracking/lote", {
          method: "POST",
          body,
          signal,
        }),
      );
    },
    async trace(view: TraceView, filters: Filters, signal?: AbortSignal) {
      if (mode === "demo")
        return (await import("./demo")).trace(view, filters, signal);
      return traceResult(
        await request(
          "/api/trazabilidad_pcb/" + view + "?" + traceParams(view, filters),
          { signal },
        ),
      );
    },
    async history(inputMainId: number, proceso: string, signal?: AbortSignal) {
      if (mode === "demo")
        return (await import("./demo")).history(inputMainId, proceso, signal);
      return traceResult(
        await request(
          "/api/trazabilidad_pcb/historial_pcb?" +
            new URLSearchParams({
              input_main_id: String(inputMainId),
              proceso,
            }),
          { signal },
        ),
      );
    },
    async exportLookup(codigo: string) {
      if (mode === "demo") return (await import("./demo")).exportLookup(codigo);
      const file = await requestFile(
        "/api/production_tracking/buscar/export?" +
          new URLSearchParams({ codigo: codigo.trim() }),
        "production_tracking_by_process.xlsx",
      );
      saveDownload(file.blob, file.name);
    },
    async exportBatch(file: File) {
      const body = fileBody(file, true);
      if (mode === "demo") return (await import("./demo")).exportBatch(file);
      const result = await requestFile(
        "/api/production_tracking/lote",
        "production_tracking_lote.xlsx",
        undefined,
        false,
        { method: "POST", body },
      );
      saveDownload(result.blob, result.name);
    },
    async exportTrace(view: TraceView, filters: Filters) {
      if (mode === "demo")
        return (await import("./demo")).exportTrace(view, filters);
      const file = await requestFile(
        "/api/trazabilidad_pcb/" +
          view +
          "/export?" +
          traceParams(view, filters),
        "trazabilidad_pcb_" + view + ".xlsx",
      );
      saveDownload(file.blob, file.name);
    },
  };
}
