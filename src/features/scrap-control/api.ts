import { downloadFile, request } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import { scrapParams } from "./model";
import type { ColumnSearches, ScrapFilters, ScrapRecord } from "./types";

const root = "/api/control-scrap";

export async function listScrap(
  mode: RuntimeMode,
  filters: ScrapFilters,
  searches: ColumnSearches,
  signal: AbortSignal,
) {
  const params = scrapParams(filters, searches);
  if (mode === "demo") {
    const { demoScrap } = await import("./demo");
    signal.throwIfAborted();
    return demoScrap(params);
  }
  const response = await request<{ data: ScrapRecord[] }>(root + "?" + params, {
    signal,
  });
  if (!Array.isArray(response.data))
    throw new Error("El servidor no devolvió un listado de scrap válido.");
  return response.data;
}

export async function exportScrap(
  mode: RuntimeMode,
  filters: ScrapFilters,
  searches: ColumnSearches,
) {
  const params = scrapParams(filters, searches);
  const name = `Control_Scrap_${filters.start}.xlsx`;
  if (mode === "demo") {
    const { exportDemoScrap } = await import("./demo");
    return exportDemoScrap(params, name);
  }
  await downloadFile(root + "/export?" + params, name);
}
