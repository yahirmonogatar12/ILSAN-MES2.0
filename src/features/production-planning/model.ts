import {
  today,
  validDate,
  rangeIssue as dateRangeIssue,
} from "@/shared/lib/date";
import { jsonText as text } from "@/shared/lib/text";
import { isRecord as object } from "@/shared/lib/parse";

import type { OrderFilters, PivotFilters, Row, Spec } from "./types";
import type { TableColumn } from "@/shared/ui";

export { today, validDate, text, object };
export const TURNOS = ["DIA", "TIEMPO EXTRA", "NOCHE"] as const;
export function cellInteger(value: string, minimum?: number): number {
  const raw = value.trim();
  if (raw && !/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw))
    throw new Error("Captura una cantidad entera válida.");
  const number = Number(raw.replaceAll(",", ""));
  if (
    !Number.isSafeInteger(number) ||
    (minimum !== undefined && number < minimum)
  )
    throw new Error(
      minimum === 0
        ? "La cantidad debe ser un entero mayor o igual a cero."
        : "La cantidad está fuera del rango permitido.",
    );
  return number;
}
export const INV_FIELDS = [
  "lgemm",
  "isemm",
  "svc",
  "dif",
  "pendiente",
  "rework",
  "smt",
  "imd",
] as const;

export function record(value: unknown): Row {
  if (!object(value))
    throw new Error("La respuesta no tiene el formato esperado.");
  return value;
}
export function rows(value: unknown): Row[] {
  if (!Array.isArray(value) || !value.every(object))
    throw new Error("El servidor no devolvió registros válidos.");
  return value;
}

export function dayAfter(value: string, count: number) {
  const day = new Date(`${value}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + count);
  return day.toISOString().slice(0, 10);
}
export function week(): PivotFilters {
  const date = today(),
    dow = new Date(`${date}T12:00:00Z`).getUTCDay(),
    monday = dayAfter(date, -((dow + 6) % 7));
  return {
    date_from: monday,
    date_to: dayAfter(monday, 6),
    part: "",
    only_shortage: "",
  };
}
export function orderDefaults(): OrderFilters {
  const date = today();
  return {
    fecha_desde: date,
    fecha_hasta: date,
    estado: "",
    cliente: "",
    modelo: "",
  };
}

export function rangeIssue(start: string, end: string, maxDays?: number) {
  if (!validDate(start) || !validDate(end)) return "Selecciona ambas fechas.";
  return dateRangeIssue(start, end, maxDays);
}
export function pivotParams(filters: PivotFilters) {
  const issue = rangeIssue(filters.date_from, filters.date_to, 120);
  if (issue) throw new Error(issue);
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value.trim()) values.set(key, value.trim());
  return values;
}
export function orderParams(filters: OrderFilters, kind: "po" | "wo") {
  const values = new URLSearchParams();
  for (const key of [
    "fecha_desde",
    "fecha_hasta",
    "estado",
    ...(kind === "wo" ? ["modelo"] : []),
  ]) {
    const v = filters[key as keyof OrderFilters];
    if (v) values.set(key, v);
  }
  if (kind === "wo") values.set("incluir_planificadas", "true");
  return values;
}
const numberFormat = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 12,
});
export const numeric = (v: unknown) =>
  v == null || v === ""
    ? ""
    : Number.isFinite(Number(v))
      ? numberFormat.format(Number(v))
      : text(v);
export function makeColumns(
  specs: readonly Spec[],
  custom: Record<string, (row: Row) => React.ReactNode> = {},
): TableColumn<Row>[] {
  const total = specs.reduce((n, s) => n + s[2], 0);
  return specs.map(([id, header, w]) => ({
    id,
    header,
    width: `${(w / total) * 100}%`,
    cell: custom[id] || ((row: Row) => text(row[id])),
    textValue: (row) => text(row[id]),
  }));
}
export function cleanFields(values: Row, keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, values[key]]));
}
/** Review totals only; scheduling rules and final capacity checks remain on the server. */
export function proposalCapacity(
  items: readonly Row[],
  baseline: readonly Row[],
): Row[] {
  const grouped = new Map<string, Row>();
  for (const item of items) {
    if (item.included === false) continue;
    const fecha = text(item.sched_date),
      linea = text(item.linea),
      turno = text(item.turno),
      key = `${fecha}|${linea}|${turno}`;
    let group = grouped.get(key);
    if (!group) {
      const reference = baseline.find(
        (row) =>
          text(row.fecha) === fecha &&
          text(row.linea) === linea &&
          text(row.turno) === turno,
      );
      group = {
        fecha,
        linea,
        turno,
        horas: 0,
        horas_max: reference?.horas_max ?? null,
        cantidad: 0,
        lotes: 0,
      };
      grouped.set(key, group);
    }
    group.cantidad = Number(group.cantidad) + Number(item.qty);
    group.lotes = Number(group.lotes) + 1;
    group.horas =
      Number(group.horas) + Number(item.qty) / Number(item.uph || 1);
    group.excede =
      group.horas_max === null
        ? null
        : Number(group.horas) > Number(group.horas_max);
  }
  return [...grouped.values()].map((row) => ({
    ...row,
    horas: Math.round(Number(row.horas) * 10000) / 10000,
  }));
}
export function fileIssue(file: File | null) {
  return !file
    ? "Selecciona un archivo Excel."
    : !file.size
      ? "El archivo está vacío."
      : !/\.(xlsx|xls|xlsm|xltx|xltm)$/i.test(file.name)
        ? "Selecciona un archivo Excel válido."
        : "";
}
export const PO_SPECS: readonly Spec[] = [
  ["codigo_po", "CÓDIGO PO", 120],
  ["nombre_po", "NOMBRE PO", 130],
  ["fecha_registro", "FECHA REGISTRO", 95],
  ["cliente", "CLIENTE", 80],
  ["modelo", "CÓDIGO MODELO", 115],
  ["nombre_modelo", "NOMBRE MODELO", 145],
  ["proveedor", "PROVEEDOR", 90],
  ["total_cantidad_entregada", "CANTIDAD PLANEADA", 95],
  ["cantidad_entregada", "COMPLETADA", 85],
  ["estado", "ESTADO", 85],
  ["codigo_entrega", "CÓDIGO ENTREGA", 100],
  ["fecha_entrega", "FECHA ENTREGA", 95],
  ["usuario_creacion", "CREADO POR", 100],
  ["modificado", "MODIFICADO", 130],
];
export const WO_SPECS: readonly Spec[] = [
  ["codigo_wo", "CÓDIGO WO", 125],
  ["estado", "ESTADO", 105],
  ["fecha_operacion", "FECHA OPERACIÓN", 110],
  ["linea", "LÍNEA", 75],
  ["codigo_modelo", "CÓDIGO MODELO", 120],
  ["nombre_modelo", "NOMBRE MODELO", 165],
  ["cantidad_planeada", "CANTIDAD PLANEADA", 115],
  ["codigo_po", "CÓDIGO PO", 110],
  ["modificador", "MODIFICADOR", 100],
  ["fecha_modificacion", "MODIFICADO", 145],
];
export const LOT_SPECS: readonly Spec[] = [
  ["lot_no", "LOTE", 120],
  ["part_no", "PART NO", 125],
  ["model", "MODELO", 120],
  ["main_sub", "MAIN", 75],
  ["linea", "LÍNEA", 85],
  ["uph", "UPH", 75],
  ["estandar_pack", "PACK", 70],
  ["faltante", "FALTANTE", 90],
  ["qty_plan", "CANTIDAD", 100],
  ["time_horas", "HORAS", 80],
  ["turno", "TURNO", 105],
  ["fisico", "FÍSICO", 85],
  ["falta", "FALTA", 85],
  ["pct", "%", 65],
  ["comentario", "COMENTARIO", 150],
  ["status", "ESTADO", 100],
];
export const HISTORY_SPECS: readonly Spec[] = [
  ["imported_at", "FECHA", 140],
  ["original_filename", "ARCHIVO", 220],
  ["plan_year", "AÑO", 65],
  ["date_from", "DESDE", 95],
  ["date_to", "HASTA", 95],
  ["parts_count", "PARTES", 75],
  ["dates_count", "FECHAS", 75],
  ["records_count", "REGISTROS", 90],
  ["zero_records_count", "CEROS", 75],
  ["warning_count", "AVISOS", 70],
  ["import_mode", "MODO", 120],
  ["imported_by", "USUARIO", 105],
  ["status", "ESTADO", 95],
];
