import {
  today,
  validDate,
  rangeIssue as dateRangeIssue,
} from "@/shared/lib/date";
import { jsonText as text } from "@/shared/lib/text";
import { isRecord, requiredText, requiredNumber } from "@/shared/lib/parse";

import type {
  Field,
  Filters,
  Kind,
  Row,
  Spec,
  PlanValues,
  PlanUpdate,
} from "./types";

export { today, validDate, text };

export function record(value: unknown): Row {
  if (!isRecord(value))
    throw new Error("El servidor devolvió una respuesta inválida.");
  return value as Row;
}
export function rows(value: unknown): Row[] {
  if (!Array.isArray(value))
    throw new Error("El servidor no devolvió una lista válida.");
  return value.map(record);
}
export const BASES: Record<Kind, string> = {
  ASSY: "/api/plan",
  IMT: "/api/plan-imd",
  SMT: "/api/plan-smt",
};
export const SHIFTS = ["DIA", "TIEMPO EXTRA", "NOCHE"];
const LINE_NAMES: Record<Kind, Record<string, string>> = {
  SMT: { SA: "SMT A", SB: "SMT B", SC: "SMT C", SD: "SMT D", SE: "SMT E" },
  IMT: { P1: "PANA A", P2: "PANA B", P3: "PANA C", P4: "PANA D" },
  ASSY: {},
};
export const lineName = (kind: Kind, value: unknown) =>
  LINE_NAMES[kind][text(value)] || text(value);

export function defaults(): Filters {
  return {
    start: today(),
    end: today(),
    line: "",
    view: "groups",
    proceso: "",
    part_number: "",
  };
}

export function rangeIssue(filters: Pick<Filters, "start" | "end">) {
  if (!validDate(filters.start) || !validDate(filters.end))
    return "Selecciona ambas fechas.";
  return dateRangeIssue(filters.start, filters.end);
}
export function planParams(filters: Filters) {
  const issue = rangeIssue(filters);
  if (issue) throw new Error(issue);
  return new URLSearchParams({ start: filters.start, end: filters.end });
}
export function reportParams(
  kind: "operations" | "outputs",
  filters: Filters,
  searches: Record<string, string>,
) {
  const params =
    kind === "operations"
      ? planParams(filters)
      : new URLSearchParams({
          fecha_desde: filters.start,
          fecha_hasta: filters.end,
          part_number: filters.part_number.trim(),
        });
  if (rangeIssue(filters)) throw new Error(rangeIssue(filters));
  if (kind === "operations") {
    if (filters.proceso) params.set("proceso", filters.proceso);
    Object.entries(searches).forEach(([key, value]) => {
      if (value.trim()) params.set(`cf_${key}`, value.trim());
    });
  }
  return params;
}
export const REPORTS = {
  operations: "/api/historial-operacion-proceso",
  outputs: "/api/control-salida-lineas",
};
export function planFields(kind: Kind, editing: boolean): Field[] {
  const fields: Field[] = [
    {
      key: "working_date",
      label: "Fecha de operación",
      type: "date",
      required: true,
      readOnly: editing && kind === "ASSY",
    },
    {
      key: "line",
      label: "Línea",
      required: true,
      ...(kind !== "ASSY"
        ? {
            type: "select" as const,
            options: (kind === "SMT"
              ? ["SA", "SB", "SC", "SD", "SE"]
              : ["P1", "P2", "P3", "P4"]
            ).map((value) => ({ value, label: lineName(kind, value) })),
          }
        : {}),
    },
    {
      key: "part_no",
      label: "Número de parte",
      required: true,
      readOnly: editing && kind === "ASSY",
    },
    {
      key: "plan_count",
      label: "Cantidad del plan",
      type: "number",
      min: 0,
      step: 1,
      required: true,
    },
    {
      key: kind === "ASSY" ? "turno" : "shift",
      label: "Turno",
      type: "select",
      options: SHIFTS.map((value) => ({ value, label: value })),
    },
    ...(!editing || kind !== "ASSY"
      ? [
          {
            key: "group_no",
            label: "Grupo",
            type: "number" as const,
            min: 1,
            max: 12,
            step: 1,
          },
          {
            key: "sequence",
            label: "Secuencia",
            type: "number" as const,
            min: 1,
            step: 1,
          },
        ]
      : []),
    { key: "wo_code", label: "WO", readOnly: editing && kind !== "ASSY" },
    { key: "po_code", label: "PO", readOnly: editing && kind !== "ASSY" },
    ...(kind !== "ASSY" || editing
      ? [
          { key: "model_code", label: "Modelo" },
          { key: "project", label: "Proyecto" },
          { key: "ct", label: "CT", type: "number" as const, min: 0 },
          { key: "uph", label: "UPH", type: "number" as const, min: 0 },
        ]
      : []),
    ...(kind !== "ASSY"
      ? [
          { key: "process", label: "Proceso" },
          {
            key: "qr_required_count",
            label: "QR requeridos",
            type: "number" as const,
            min: 0,
            max: 20,
            step: 1,
          },
          {
            key: "array_size",
            label: "Array",
            type: "number" as const,
            min: 0,
            max: 100,
            step: 1,
          },
        ]
      : []),
    ...(kind === "SMT"
      ? [
          {
            key: "lado",
            label: "Lado",
            type: "select" as const,
            options: [
              { value: "", label: "Una cara" },
              { value: "BOTTOM", label: "BOTTOM" },
              { value: "TOP", label: "TOP" },
            ],
          },
        ]
      : []),
  ];
  return fields.filter(
    (field) => !(kind === "ASSY" && field.key === "sequence"),
  );
}
export function fieldIssues(fields: readonly Field[], values: Row) {
  return fields.flatMap((field) => {
    const raw = text(values[field.key]).trim();
    if (field.required && !raw) return [`${field.label} es obligatorio.`];
    if (field.type === "date" && raw && !validDate(raw))
      return [`${field.label} no es válida.`];
    if (
      field.type === "number" &&
      raw &&
      (!Number.isFinite(Number(raw)) ||
        (field.step === 1 && !Number.isSafeInteger(Number(raw))) ||
        (field.min !== undefined && Number(raw) < field.min) ||
        (field.max !== undefined && Number(raw) > field.max))
    )
      return [`${field.label} está fuera del rango permitido.`];
    return [];
  });
}
export function planPayload(kind: Kind, values: Row, editing: true): PlanUpdate;
export function planPayload(
  kind: Kind,
  values: Row,
  editing: false,
): PlanValues;
export function planPayload(
  kind: Kind,
  values: Row,
  editing: boolean,
): PlanValues | PlanUpdate;
export function planPayload(
  kind: Kind,
  values: Row,
  editing: boolean,
): PlanValues | PlanUpdate {
  const numeric = new Set([
    "plan_count",
    "ct",
    "uph",
    "group_no",
    "sequence",
    "qr_required_count",
    "array_size",
  ]);
  const allowed = new Set(
    planFields(kind, editing)
      .filter((field) => !field.readOnly)
      .map((field) => field.key),
  );
  const payload = Object.fromEntries(
    Object.entries(values)
      .filter(
        ([key]) =>
          allowed.has(key) || key === "lot_no" || key === "assigned_bom_rev",
      )
      .map(([key, value]) => [
        key,
        numeric.has(key) ? Number(value ?? 0) : text(value).trim(),
      ]),
  );
  if (editing)
    return { ...payload, lot_no: requiredText(payload.lot_no, "lot_no") };
  return {
    ...payload,
    working_date: requiredText(payload.working_date, "working_date"),
    line: requiredText(payload.line, "line"),
    part_no: requiredText(payload.part_no, "part_no"),
    plan_count: requiredNumber(payload.plan_count, "plan_count"),
  };
}
export const PLAN_SPECS: readonly Spec[] = [
  ["group_no", "GRUPO", 60],
  ["sequence", "SEC.", 50],
  ["lot_no", "LOTE", 155],
  ["wo_code", "WO", 110],
  ["po_code", "PO", 100],
  ["working_date", "FECHA", 90],
  ["line", "LÍNEA", 70],
  ["_shift", "TURNO", 80],
  ["model_code", "MODELO", 110],
  ["part_no", "NÚMERO DE PARTE", 140],
  ["sub_assy", "SUB-ASSY", 85],
  ["assigned_bom_rev", "BOM REV.", 70],
  ["project", "PROYECTO", 90],
  ["process", "PROCESO", 70],
  ["ct", "CT", 50],
  ["uph", "UPH", 55],
  ["plan_count", "PLAN", 70],
  ["input", "INPUT", 70],
  ["output", "OUTPUT", 70],
  ["entregadas_main", "ENTREGADAS M.", 85],
  ["status", "ESTADO", 110],
  ["lado", "LADO", 75],
  ["lote_padre", "LOTE PADRE", 150],
  ["qr_required_count", "QR", 50],
  ["array_size", "ARRAY", 50],
  ["bottom_producido", "BOTTOM", 70],
  ["top_producido", "TOP", 60],
  ["tiempo_produccion", "DURACIÓN", 80],
  ["inicio", "INICIO", 70],
  ["fin", "FIN", 70],
];
export const OPERATION_SPECS: readonly Spec[] = [
  ["proceso", "PROCESO", 80],
  ["fecha", "FECHA", 100],
  ["linea", "LÍNEA", 90],
  ["wo", "WO", 140],
  ["lote", "LOTE", 160],
  ["part_no", "NÚMERO DE PARTE", 140],
  ["modelo", "MODELO", 150],
  ["plan", "PLAN", 80],
  ["input", "INPUT", 80],
  ["output", "OUTPUT", 80],
  ["status", "ESTADO", 110],
];
export const OUTPUT_SPECS: readonly Spec[] = [
  ["fecha", "PERÍODO", 155],
  ["part_number", "NÚMERO DE PARTE", 145],
  ["product_model", "MODELO", 130],
  ["lineas", "LÍNEAS", 90],
  ["lotes", "LOTES", 150],
  ["produced_quantity", "PRODUCCIÓN", 90],
  ["production_boxes", "CAJAS PROD.", 80],
  ["oqc_quantity", "LIBERACIÓN OQC", 100],
  ["pending_oqc", "PENDIENTE OQC", 100],
  ["warehouse_quantity", "ENTRADAS ALMACÉN", 110],
  ["pending_warehouse", "PENDIENTE ALMACÉN", 110],
  ["oqc_statuses", "ESTADOS OQC", 140],
  ["estado", "ESTADO", 130],
];
