import type { CatalogKind, Cell, ModelRow } from "./types";
export const LIMIT = 2000;
export const NUMERIC = new Set([
  "hora_dia",
  "c_t",
  "uph",
  "price",
  "st",
  "neck_st",
  "l_b",
  "input",
  "output",
]);
export function auditColumn(column: string) {
  return /usuario|user|fecha|date|^(crea|upt|created_at|updated_at)$/i.test(
    column,
  );
}
export function visibleColumn(column: string) {
  return (
    !column.startsWith("_") &&
    !["id", "raw", "crea", "upt"].includes(column.toLowerCase())
  );
}
export function editableColumn(column: string) {
  return visibleColumn(column) && !auditColumn(column);
}
export const rowKey = (row: ModelRow) =>
  String(row.__rowhash ?? row.id ?? row.ID ?? JSON.stringify(row));
export function cleanDraft(
  values: ModelRow,
  columns: string[],
  kind: CatalogKind,
): ModelRow {
  return Object.fromEntries(
    columns.filter(editableColumn).map((column) => {
      let value: Cell = values[column] ?? "";
      if (kind === "models" && NUMERIC.has(column) && typeof value === "string")
        value = value.replace(/[,\s]/g, "");
      return [column, value === "" ? null : value];
    }),
  );
}
export function validateDraft(
  values: ModelRow,
  columns: string[],
  kind: CatalogKind,
): string[] {
  const fields = columns.filter(editableColumn);
  const errors = fields.some((column) => String(values[column] ?? "").trim())
    ? []
    : ["Captura al menos un dato del modelo."];
  if (kind === "models")
    fields.forEach((column) => {
      const value = String(values[column] ?? "").replace(/[,\s]/g, "");
      if (NUMERIC.has(column) && value && !Number.isFinite(Number(value)))
        errors.push(`${column}: captura un número válido.`);
    });
  return errors;
}
/** Original values must retain nulls, numeric types and audit fields for SMT hashing. */
export function smtPayload(
  values: ModelRow,
  original: ModelRow | null,
  columns: string[],
  actor: string,
) {
  const draft = cleanDraft(values, columns, "smt");
  const changes = original
    ? Object.fromEntries(
        Object.entries(draft).filter(
          ([key, value]) => String(value ?? "") !== String(original[key] ?? ""),
        ),
      )
    : draft;
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const audit = original
    ? { usuario_modificacion: actor, fecha_modificacion: timestamp }
    : { usuario_registro: actor, fecha_registro: timestamp };
  Object.entries(audit).forEach(([key, value]) => {
    if (columns.includes(key)) changes[key] = value;
  });
  if (!original) return changes;
  return {
    original: Object.fromEntries(
      columns.map((column) => [column, original[column] ?? null]),
    ),
    changes,
  };
}
