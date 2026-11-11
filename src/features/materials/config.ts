import type { PermissionRule } from "@/core/auth/types";
import type { Filters } from "./types";
export const MATERIAL_PERMISSION: PermissionRule = {
  pagina: "LISTA_INFORMACIONBASICA",
  seccion: "Control de material",
  boton: "Control de material",
};
export const DEFAULT_FILTERS: Filters = { q: "", clasificacion: "" };
export function decodeFilters(value: unknown): Filters {
  const object =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    q: typeof object.q === "string" ? object.q.slice(0, 120) : "",
    clasificacion:
      typeof object.clasificacion === "string" ? object.clasificacion : "",
  };
}
/** Keys include runtime/user scope to avoid exposing a previous session's data. */
export const materialKeys = {
  all: (scope: string) => ["materials", scope] as const,
  list: (scope: string, filters: Filters) =>
    ["materials", scope, "list", filters] as const,
  catalogs: (scope: string) => ["materials", scope, "catalogs"] as const,
  history: (scope: string, part: string, vendor: string) =>
    ["materials", scope, "history", part, vendor] as const,
};
