import { localDate as todayIso } from "@/shared/lib/date";

import type { HistoryKind, HistoryFilters, InventoryFilters } from "./types";

export { todayIso };
export const TITLES: Record<HistoryKind, string> = {
  entradas: "Historial de entradas",
  salidas: "Historial de salidas",
  retornos: "Historial de retornos",
};
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
