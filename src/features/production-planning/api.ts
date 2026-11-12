import { downloadFile, request } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import { orderParams, pivotParams, record, rows, text } from "./model";
import {
  decodeOrders,
  decodePivot,
  decodeProjectedPlan,
  actionDecoders,
} from "./contracts";
import type {
  Action,
  PlanningApi,
  PivotFilters,
  Upload,
  FileAction,
} from "./types";
const fileRoutes: Record<FileAction, string> = {
  "preview-lg": "/api/part-planning/import/preview",
  "confirm-lg": "/api/part-planning/import/confirm",
  inventory: "/api/part-planning/inventory/import",
  "sync-schedule": "/api/part-planning/schedule/sync-excel",
  "wo-excel": "/importar_excel_plan_produccion",
};
const actions: Partial<Record<Action, string>> = {
  "create-po": "/api/po/crear",
  "create-wo": "/api/work_orders",
  "update-wo": "/api/wo/actualizar",
  "delete-wo": "/api/wo/eliminar",
  "link-wo": "/api/wo/actualizar-po",
  "import-wos": "/api/work_orders/import",
  schedule: "/api/part-planning/schedule",
  "inventory-field": "/api/part-planning/inventory/field",
  propose: "/api/part-planning/schedule/proponer",
  "apply-proposal": "/api/part-planning/schedule/proponer/aplicar",
  "reject-proposal": "/api/part-planning/schedule/proponer/rechazar",
  generate: "/api/plan-proyectado/generate",
  "generate-faltantes": "/api/plan-proyectado/generate-faltantes",
  "generate-schedule": "/api/plan-proyectado/generate-schedule",
  "acomodar-ia": "/api/plan-proyectado/acomodar-ia",
  "confirm-lots": "/api/plan-proyectado/confirm",
  "config-lines": "/api/plan-proyectado/config",
  "add-lot": "/api/plan-proyectado/add",
  "update-lot": "/api/plan-proyectado/update",
  "delete-lot": "/api/plan-proyectado/delete",
};
export function createPlanningApi(mode: RuntimeMode): PlanningApi {
  const demo = () => import("./demo").then((module) => module.demoPlanningApi);
  const load = async (
    filters: PivotFilters,
    page: number,
    size: number,
    signal?: AbortSignal,
  ) => {
    const p = pivotParams(filters);
    p.set("page", String(page));
    p.set("page_size", String(size));
    return decodePivot(
      await request<unknown>(`/api/part-planning/plan?${p}`, { signal }),
      { filters, page, size },
    );
  };
  return {
    async orders(kind, filters, signal) {
      if (mode === "demo") return (await demo()).orders(kind, filters, signal);
      const d = record(
        await request<unknown>(
          `/api/${kind}/listar?${orderParams(filters, kind)}`,
          { signal },
        ),
      );
      const result = decodeOrders(kind, d.data);
      return kind === "po" && filters.cliente
        ? result.filter((row) => text(row.cliente) === filters.cliente)
        : result;
    },
    async models(signal) {
      if (mode === "demo") return (await demo()).models(signal);
      const d = record(await request<unknown>("/api/raw/modelos", { signal }));
      const values = d.modelos ?? d.data;
      if (!Array.isArray(values))
        throw new Error("No se pudo cargar el catálogo de modelos.");
      return values
        .map((row) =>
          typeof row === "string"
            ? row
            : text(
                record(row).codigo_modelo ??
                  record(row).part_no ??
                  record(row).modelo,
              ),
        )
        .filter(Boolean);
    },
    async pivot(filters, page, size, signal) {
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(size) ||
        size < 1 ||
        size > 500
      )
        throw new Error("Paginación inválida.");
      pivotParams(filters);
      if (mode === "demo")
        return (await demo()).pivot(filters, page, size, signal);
      if (size <= 200) return load(filters, page, size, signal);
      // The legacy server caps requests at 200 parts. Fetch only the intersecting
      // server pages, then slice by the logical offset rather than losing parts.
      const offset = (page - 1) * size,
        serverSize = 200,
        firstPage = Math.floor(offset / serverSize) + 1,
        first = await load(filters, firstPage, serverSize, signal);
      if (offset >= first.total_parts)
        return { ...first, rows: [], page, page_size: size };
      const lastPage =
        Math.floor(
          (Math.min(offset + size, first.total_parts) - 1) / serverSize,
        ) + 1;
      const rest = await Promise.all(
        Array.from({ length: lastPage - firstPage }, (_, i) =>
          load(filters, firstPage + i + 1, serverSize, signal),
        ),
      );
      if (
        rest.some(
          (result) =>
            result.total_parts !== first.total_parts ||
            result.dates.join() !== first.dates.join(),
        )
      )
        throw new Error(
          "El plan cambió durante la consulta. Actualiza el listado.",
        );
      const combined = [first, ...rest].flatMap((result) => result.rows),
        start = offset - (firstPage - 1) * serverSize;
      if (new Set(combined.map((row) => row.part_no)).size !== combined.length)
        throw new Error(
          "El plan cambió durante la consulta. Actualiza el listado.",
        );
      return {
        ...first,
        rows: combined.slice(start, start + size),
        page,
        page_size: size,
      };
    },
    async lots(fecha, signal) {
      if (mode === "demo") return (await demo()).lots(fecha, signal);
      const d = record(
        await request<unknown>(
          `/api/plan-proyectado?${new URLSearchParams({ fecha })}`,
          { signal },
        ),
      );
      return decodeProjectedPlan(d);
    },
    async history(signal) {
      if (mode === "demo") return (await demo()).history(signal);
      return rows(
        record(
          await request<unknown>("/api/part-planning/imports?limit=100", {
            signal,
          }),
        ).imports,
      );
    },
    async action(action, payload) {
      if (mode === "demo") return (await demo()).action(action, payload);
      let path = actions[action],
        method = "POST";
      if (action === "state-wo") {
        path = `/api/wo/${encodeURIComponent(text(payload.codigo_wo))}/estado`;
        method = "PUT";
      }
      if (action === "delete-wo") method = "DELETE";
      if (!path) throw new Error("Operación no disponible.");
      return actionDecoders[action](
        await request<unknown>(path, { method, body: JSON.stringify(payload) }),
      );
    },
    async upload(action, upload: Upload, signal) {
      if (mode === "demo") return (await demo()).upload(action, upload, signal);
      const fd = new FormData();
      fd.append("file", upload.file);
      for (const [key, value] of Object.entries(upload))
        if (key !== "file" && value !== undefined)
          fd.append(key, String(value));
      return record(
        await request<unknown>(fileRoutes[action], {
          method: "POST",
          body: fd,
          signal,
        }),
      );
    },
    async exportWO(filters) {
      if (mode === "demo") return (await demo()).exportWO(filters);
      const p = new URLSearchParams({
        fecha_desde: filters.fecha_desde,
        fecha_hasta: filters.fecha_hasta,
      });
      await downloadFile(`/api/wo/exportar?${p}`, "WorkOrders.xlsx");
    },
  };
}
