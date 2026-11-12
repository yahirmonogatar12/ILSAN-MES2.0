import { rangeIssue as dateRangeIssue } from "@/shared/lib/date";
import type {
  CellValue,
  HistoryFilters,
  InventoryFilters,
  InventoryView,
  Searches,
} from "./types";
export function validateDates(
  start: string,
  end: string,
  required = false,
): string {
  if (required && (!start || !end))
    return "Captura ambas fechas para consultar el periodo.";
  return dateRangeIssue(start, end);
}
export function historyParams(filters: HistoryFilters, searches: Searches) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim());
  });
  appendSearches(params, searches);
  return params;
}
export function appendSearches(params: URLSearchParams, searches: Searches) {
  Object.entries(searches).forEach(([key, value]) => {
    if (value.trim()) {
      const text =
        ["in_quarantine", "cancelado"].includes(key) &&
        value.trim().toLocaleLowerCase() === "sí"
          ? "Si"
          : value.trim();
      params.set(`cf_${key}`, text);
    }
  });
}
export function inventoryParams(
  view: InventoryView,
  filters: InventoryFilters,
  searches: Searches,
) {
  const params = new URLSearchParams();
  for (const key of ["numero_parte", "ubicacion"] as const)
    if (filters[key].trim()) params.set(key, filters[key].trim());
  if (filters.include_zero_stock === "true")
    params.set("include_zero_stock", "true");
  if (filters.use_dates === "true") {
    params.set("fecha_inicio", filters.fecha_inicio);
    params.set("fecha_fin", filters.fecha_fin);
  }
  if (view === "detail") {
    if (filters.codigo_material_recibido.trim())
      params.set(
        "codigo_material_recibido",
        filters.codigo_material_recibido.trim(),
      );
    if (filters.only_na === "true") params.set("only_na", "true");
    appendSearches(params, searches);
  }
  return params;
}
export function displayValue(
  value: CellValue | undefined,
  field: string,
): string {
  if (["in_quarantine", "cancelado"].includes(field))
    return value === true || value === 1 || value === "1" ? "Sí" : "No";
  if (value == null || value === "") return "—";
  if (field === "costo_unitario" || field === "costo_total") {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("en-US", {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        })
      : String(value);
  }
  return String(value);
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
