import type { RuntimeMode } from "@/core/runtime";
import {
  ApiError,
  backendFetch,
  ensureResponse,
  request,
  saveDownload,
} from "@/core/http";
import { normalizePayload } from "./model";
import type {
  Catalogs,
  Filters,
  Material,
  MaterialPayload,
  MaterialsResponse,
  MaterialsApi,
  VendorCost,
} from "./types";

const BASE = "/api/informacion_basica/control_material";
export function filterParams(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.clasificacion) params.set("clasificacion", filters.clasificacion);
  return params.size ? `?${params}` : "";
}

export function createMaterialsApi(mode: RuntimeMode): MaterialsApi {
  const local = mode === "demo";
  return {
    async catalogs(signal?: AbortSignal): Promise<Catalogs> {
      if (local) return (await import("./demo")).demoCatalogs();
      return request(`${BASE}/catalogos`, { signal });
    },
    async list(
      filters: Filters,
      signal?: AbortSignal,
    ): Promise<MaterialsResponse> {
      if (local) {
        const records = (await import("./demo")).filterDemoRows(filters);
        return { success: true, records, total: records.length };
      }
      return request(`${BASE}/materiales${filterParams(filters)}`, { signal });
    },
    async detail(code: string): Promise<Material> {
      if (local) return (await import("./demo")).demoDetail(code);
      return (
        await request<{ record: Material }>(
          `${BASE}/materiales/detalle?${new URLSearchParams({ numero_parte: code })}`,
        )
      ).record;
    },
    async history(
      code: string,
      vendor: string,
      signal?: AbortSignal,
    ): Promise<VendorCost[]> {
      if (local) return (await import("./demo")).demoHistory(code, vendor);
      const params = new URLSearchParams({ numero_parte: code });
      if (vendor) params.set("vendedor", vendor);
      return (
        await request<{ records: VendorCost[] }>(
          `${BASE}/costos/historial?${params}`,
          { signal },
        )
      ).records;
    },
    async save(payload: MaterialPayload, editing: boolean): Promise<Material> {
      if (local) return (await import("./demo")).demoSave(payload, editing);
      return (
        await request<{ record: Material }>(`${BASE}/materiales`, {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(normalizePayload(payload)),
        })
      ).record;
    },
    async remove(code: string) {
      if (local) return (await import("./demo")).demoRemove(code);
      await request(`${BASE}/materiales`, {
        method: "DELETE",
        body: JSON.stringify({ numero_parte: code }),
      });
    },
    async export(filters: Filters) {
      if (local) return (await import("./demo")).demoExport(filters);
      const response = await backendFetch(
        `${BASE}/export${filterParams(filters)}`,
      );
      await ensureResponse(response);
      const type = response.headers.get("content-type") || "";
      if (type.includes("json") || type.includes("text/html"))
        throw new ApiError(
          "El servidor no devolvió un archivo Excel válido.",
          502,
        );
      const disposition = response.headers.get("content-disposition") || "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      let filename = plain || "control_material.xlsx";
      if (encoded) {
        try {
          filename = decodeURIComponent(encoded);
        } catch {
          /* Keep fallback. */
        }
      }
      saveDownload(await response.blob(), filename.replace(/[\\/]/g, "_"));
    },
  };
}
