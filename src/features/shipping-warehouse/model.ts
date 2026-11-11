import type { Filters, ListKind, MovementType, Row } from "./types";

export const ROOT = "/api/almacen-embarques";
export const paths: Record<ListKind, string> = {
  entries: "entradas",
  exits: "salidas",
  returns: "retorno",
  movements: "movimientos",
  audit: "movimientos/historial",
  inventory: "inventario-general",
  catalog: "catalogo",
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function filtersFor(kind: ListKind | "qa"): Filters {
  const date = kind === "returns" || kind === "qa" ? today() : "";
  return {
    search: "",
    fecha_desde: date,
    fecha_hasta: date,
    tipo: "",
    status: "",
    accion: "",
  };
}
export function rangeError(filters: Filters) {
  return filters.fecha_desde &&
    filters.fecha_hasta &&
    filters.fecha_desde > filters.fecha_hasta
    ? "La fecha desde debe ser anterior o igual a la fecha hasta."
    : "";
}
export function filterParams(kind: ListKind | "qa", filters: Filters) {
  const issue = rangeError(filters);
  if (issue) throw new Error(issue);
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (kind !== "catalog" && kind !== "inventory") {
    if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
    if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
  }
  if (
    (kind === "returns" || kind === "movements" || kind === "audit") &&
    filters.tipo
  )
    params.set("tipo", filters.tipo);
  if (kind === "catalog" && filters.status)
    params.set("status", filters.status);
  if (kind === "audit" && filters.accion) params.set("accion", filters.accion);
  return params;
}
export function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
export function number(value: unknown) {
  const valueAsNumber = Number(value);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : 0;
}
export const formatQuantity = (value: unknown) =>
  number(value).toLocaleString("es-MX");
export function integer(value: unknown, min = 1): number | null {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^\d+$/.test(value.trim()))
  )
    return null;
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= min ? result : null;
}
export function recordId(value: unknown) {
  const id = integer(value);
  if (id === null)
    throw new Error("El registro no tiene un identificador válido.");
  return id;
}
export function movementType(value: unknown): MovementType {
  if (value === "entry" || value === "exit" || value === "return") return value;
  throw new Error("Tipo de movimiento inválido.");
}
export const rowKey = (row: Row, index: number) =>
  text(row.id ?? row.catalog_id ?? row.part_number ?? row.folio) + ":" + index;
export const movementKey = (row: Row) =>
  text(row.movement_type) + ":" + text(row.record_id ?? row.id);
export const returnIsExit = (row: Row) => number(row.loss_quantity) > 0;
export const returnIsEntry = (row: Row) =>
  !returnIsExit(row) && number(row.return_quantity) > 0;
export function returnRows(rows: readonly Row[], exit: boolean) {
  return rows.filter(exit ? returnIsExit : returnIsEntry);
}
export function receiptLines(
  rows: readonly Row[],
  quantities: Readonly<Record<string, string>>,
  complete: ReadonlySet<string>,
) {
  return rows.map((row) => {
    const part = text(row.part_number);
    const quantity = complete.has(part)
      ? Number(row.quantity)
      : quantities[part]?.trim() === "" || quantities[part] == null
        ? NaN
        : Number(quantities[part]);
    if (!Number.isFinite(quantity) || quantity < 0)
      throw new Error(
        `Confirma ${part} o captura una cantidad recibida válida.`,
      );
    if (!Array.isArray(row.packing_line_ids) || !row.packing_line_ids.length)
      throw new Error(`No hay líneas de packing para ${part}.`);
    return {
      part_number: part,
      packing_line_ids: row.packing_line_ids.map(recordId),
      cantidad_confirmada: quantity,
    };
  });
}
