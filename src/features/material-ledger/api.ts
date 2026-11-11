import { downloadFile, request } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import { historyParams, inventoryParams } from "./model";
import type { LedgerApi, LedgerPage, LedgerRow } from "./types";
function rows(value: unknown): LedgerRow[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (row) =>
        !row ||
        Array.isArray(row) ||
        typeof row !== "object" ||
        Object.values(row).some(
          (cell) =>
            cell !== null &&
            !["string", "number", "boolean"].includes(typeof cell),
        ),
    )
  )
    throw new Error("El servidor no devolvió registros de material válidos.");
  return value;
}
function page(value: LedgerPage): LedgerPage {
  if (
    !value ||
    ![value.total, value.limit, value.offset].every(Number.isFinite) ||
    value.total < 0 ||
    value.limit < 1 ||
    value.offset < 0
  )
    throw new Error("La paginación recibida no tiene un formato válido.");
  return { ...value, data: rows(value.data) };
}
export function createLedgerApi(mode: RuntimeMode): LedgerApi {
  const demo = () => import("./demo").then((module) => module.demoApi);
  return {
    async history(kind, filters, searches, current, size, signal) {
      if (mode === "demo")
        return (await demo()).history(
          kind,
          filters,
          searches,
          current,
          size,
          signal,
        );
      const params = historyParams(filters, searches);
      params.set("limit", String(size));
      params.set("offset", String((current - 1) * size));
      return page(
        await request<LedgerPage>(
          `/api/material_admin/history/${kind}?${params}`,
          { signal },
        ),
      );
    },
    async summary(filters, signal) {
      if (mode === "demo") return (await demo()).summary(filters, signal);
      return rows(
        await request<LedgerRow[]>(
          `/api/material_admin/inventory/summary?${inventoryParams("summary", filters, {})}`,
          { signal },
        ),
      );
    },
    async lots(filters, searches, current, size, signal) {
      if (mode === "demo")
        return (await demo()).lots(filters, searches, current, size, signal);
      const params = inventoryParams("detail", filters, searches);
      params.set("limit", String(size));
      params.set("offset", String((current - 1) * size));
      return page(
        await request<LedgerPage>(
          `/api/material_admin/inventory/lots?${params}`,
          { signal },
        ),
      );
    },
    async exportHistory(kind, filters, searches) {
      if (mode === "demo")
        return (await demo()).exportHistory(kind, filters, searches);
      await downloadFile(
        `/api/material_admin/history/${kind}/export?${historyParams(filters, searches)}`,
        `historial_${kind}.xlsx`,
      );
    },
    async exportInventory(view, filters, searches) {
      if (mode === "demo")
        return (await demo()).exportInventory(view, filters, searches);
      const params = inventoryParams(view, filters, searches);
      params.set("view", view);
      await downloadFile(
        `/api/material_admin/inventory/export?${params}`,
        `inventario_${view}.xlsx`,
      );
    },
  };
}
