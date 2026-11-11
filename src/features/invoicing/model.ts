import type {
  DataRow,
  InvoiceFilters,
  LineDraft,
  PurchaseFilters,
  ValuationFilters,
} from "./types";
export const EMPTY_ROWS: DataRow[] = [];
export const text = (value: unknown): string =>
  value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
export const amount = (value: unknown) => Number(value ?? 0);
export const enabled = (value: unknown) =>
  value === true || value === 1 || value === "1";
/** Same definition as the backend's PENDIENTES view, including manual closure. */
export const invoiceIsOpen = (row: DataRow) =>
  !enabled(row.cerrado_manual) &&
  !["APLICADA", "CANCELADA"].includes(text(row.estado));
export function object(value: unknown): value is DataRow {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function rows(value: unknown): DataRow[] {
  if (!Array.isArray(value) || !value.every(object))
    throw new Error("El servidor no devolvió una lista válida.");
  return value;
}
export function record(value: unknown): DataRow {
  if (!object(value))
    throw new Error("La respuesta no tiene el formato esperado.");
  if (value.error) throw new Error(text(value.error));
  return value;
}
export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const invoiceDefaults = (): InvoiceFilters => ({
  q: "",
  estado: "",
  fecha_inicio: localToday(),
  fecha_fin: localToday(),
});
export const purchaseDefaults = (): PurchaseFilters => ({
  q: "",
  tipo: "",
  estado: "",
  fecha_inicio: "",
  fecha_fin: "",
});
export const valuationDefaults = (): ValuationFilters => ({
  numero_parte: "",
  codigo_material_recibido: "",
  pallet_no: "",
  fuente_costo: "",
  include_zero_stock: "",
});
export function dateIssue(filters: InvoiceFilters) {
  return filters.estado !== "PENDIENTES" &&
    filters.fecha_inicio &&
    filters.fecha_fin &&
    filters.fecha_inicio > filters.fecha_fin
    ? "La fecha inicial no puede ser posterior a la final."
    : "";
}
export function listParams(filters: InvoiceFilters | PurchaseFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (filters.estado === "PENDIENTES" && key.startsWith("fecha_")) continue;
    if (value.trim()) params.set(key, value.trim());
  }
  return params;
}
export function valuationParams(filters: ValuationFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value.trim()) params.set(key, value.trim());
  return params;
}
export function fileIssue(file: File | null) {
  return !file
    ? "Selecciona un archivo Excel."
    : !/\.(xlsx|xlsm|xltx|xltm)$/i.test(file.name)
      ? "Selecciona un Excel XLSX, XLSM, XLTX o XLTM."
      : file.size === 0
        ? "El archivo está vacío."
        : "";
}
export function lineDraft(row: DataRow): LineDraft {
  return Object.fromEntries(
    [
      "line_no",
      "raw_part_num",
      "numero_parte_sistema",
      "descripcion",
      "cantidad",
      "uom",
      "costo_unitario",
      "costo_total",
    ].map((key) => [key, text(row[key])]),
  ) as unknown as LineDraft;
}
export function lineIssues(draft: LineDraft) {
  const issues: string[] = [];
  if (!draft.raw_part_num.trim() || !draft.numero_parte_sistema.trim())
    issues.push("Parte raw y Parte sistema son requeridas.");
  if (!Number.isInteger(Number(draft.line_no)) || Number(draft.line_no) < 1)
    issues.push("El número de línea debe ser un entero positivo.");
  if (!Number.isFinite(Number(draft.cantidad)) || Number(draft.cantidad) <= 0)
    issues.push("La cantidad debe ser mayor a cero.");
  if (
    [draft.costo_unitario, draft.costo_total].some(
      (value) =>
        value.trim() !== "" &&
        (!Number.isFinite(Number(value)) || Number(value) < 0),
    )
  )
    issues.push("Los costos deben ser números no negativos.");
  return issues;
}
export function resultMessage(result: DataRow) {
  return Object.entries(result)
    .filter(
      ([key, value]) =>
        !["success", "records", "preview_records"].includes(key) &&
        value !== null,
    )
    .map(([key, value]) => `${key}: ${text(value)}`)
    .join(" · ");
}
