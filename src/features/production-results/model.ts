import type { Closure, Filters, Row, ViewSpec } from "./types";

export function text(value: unknown): string {
  return value == null ? "" : String(value);
}
export function number(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
export function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("El servidor devolvió un registro inválido.");
  const result = value as Row;
  if (result.status === "error")
    throw new Error(text(result.message) || "No se pudo consultar el reporte.");
  return result;
}
export function rows(value: unknown): Row[] {
  if (!Array.isArray(value))
    throw new Error("El servidor devolvió una lista inválida.");
  return value.map(object);
}
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function filterIssue(filters: Filters): string {
  const from = filters.fecha_desde || filters.fecha_inicio || filters.desde;
  const to = filters.fecha_hasta || filters.fecha_fin || filters.hasta;
  if (from && to && from > to)
    return "La fecha desde debe ser anterior o igual a la fecha hasta.";
  for (const key of ["hora_desde", "hora_hasta"]) {
    if (
      filters[key] &&
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(filters[key])
    )
      return "Las horas deben usar el formato HH:mm o HH:mm:ss.";
  }
  if (
    filters.hora_desde &&
    filters.hora_hasta &&
    filters.hora_desde > filters.hora_hasta
  )
    return "La hora desde debe ser anterior o igual a la hora hasta.";
  return "";
}
/** Only allow declared filters and column criteria. Never coerce identifiers to numbers. */
export function reportParams(
  spec: ViewSpec,
  filters: Filters,
  searches: Filters,
  page: number,
  perPage: number,
) {
  const params = new URLSearchParams(
    typeof spec.params === "function" ? spec.params(filters) : spec.params,
  );
  for (const [key, value] of Object.entries(filters)) {
    if (
      value.trim() &&
      (spec.fields.some((field) => field.key === key) || key === "fecha")
    )
      params.set(key, value.trim());
  }
  if (spec.remote) {
    params.set("page", String(page));
    params.set("per_page", String(perPage));
    for (const column of spec.columns) {
      if (
        column.key !== "numero" &&
        column.filterable !== false &&
        searches[column.key]?.trim()
      )
        params.set("cf_" + column.key, searches[column.key].trim());
    }
  }
  return params;
}
export function closure(value: unknown): Closure {
  const data = object(value);
  const preview = object(data.preview ?? {});
  const batchId = Number(data.batchId);
  return {
    batchId: Number.isSafeInteger(batchId) && batchId > 0 ? batchId : null,
    valid: data.valid === true,
    metadata: object(data.metadata ?? {}),
    rows: rows(preview.rows ?? []),
    summary: object(preview.summary ?? {}),
    history: rows(data.history ?? []),
    errors: Array.isArray(data.errors) ? data.errors.map(text) : [],
  };
}
