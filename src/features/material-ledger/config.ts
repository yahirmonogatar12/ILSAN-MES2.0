import type { HistoryKind, HistoryFilters, InventoryFilters } from "./types";
export const TITLES: Record<HistoryKind, string> = {
  entradas: "Historial de entradas",
  salidas: "Historial de salidas",
  retornos: "Historial de retornos",
};
/** Local calendar dates match the operator's date controls; do not shift them through UTC. */
export function todayIso(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function historyDefaults(): HistoryFilters {
  const today = todayIso();
  return { fecha_inicio: today, fecha_fin: today, texto: "" };
}
export function inventoryDefaults(): InventoryFilters {
  const today = todayIso();
  return {
    numero_parte: "",
    codigo_material_recibido: "",
    ubicacion: "",
    include_zero_stock: "false",
    only_na: "false",
    use_dates: "false",
    fecha_inicio: `${today.slice(0, 8)}01`,
    fecha_fin: today,
  };
}
