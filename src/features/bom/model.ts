import type { EcoDetail, EcoDraft, EcoRow } from "./types";
/** Old single-model differences may omit part_no; never infer it for a family. */
export function singleEcoModel(eco: EcoDetail): string | undefined {
  const models = new Set(
    [
      ...(eco.scope || []).map((row) => String(row.part_no || "").trim()),
      ...String(eco.scope_parts || "")
        .split(",")
        .map((part) => part.trim()),
      String(eco.part_no || "").trim(),
    ].filter(Boolean),
  );
  return Number(eco.scope_count || 0) > 1 || models.size !== 1
    ? undefined
    : [...models][0];
}
export const isKs = (row: EcoRow) =>
  row.origen?.toUpperCase() === "KS" || String(row.id).startsWith("ks-");
export function normalizeDraft(draft: EcoDraft): EcoDraft {
  return {
    ...draft,
    eco_no: draft.eco_no.trim().toUpperCase(),
    part_no: draft.part_no.trim().toUpperCase(),
    family: draft.family.trim().toUpperCase(),
    suffixes: draft.suffixes.trim(),
    item_name: draft.item_name.trim(),
    notes: draft.notes.trim(),
  };
}
export function validateEco(
  draft: EcoDraft,
  parts: string[],
  file: File | null,
): string[] {
  const errors: string[] = [];
  if (!draft.eco_no.trim()) errors.push("Captura el número de ECO.");
  if (!draft.effective_at) errors.push("Captura la fecha efectiva.");
  if (draft.kind === "FAMILY" ? !parts.length : !draft.part_no.trim())
    errors.push(
      draft.kind === "FAMILY"
        ? "Resuelve la familia y sus sufijos antes de importar."
        : "Selecciona el modelo o número de parte.",
    );
  if (!file) errors.push("Selecciona el Excel modificado.");
  else if (!/\.(xlsx|xlsm)$/i.test(file.name))
    errors.push("Selecciona un archivo Excel XLSX o XLSM.");
  return errors;
}
export function allowedAction(
  row: EcoRow,
  action: "approve" | "cancel" | "delete",
  create: boolean,
  approve: boolean,
) {
  if (isKs(row)) return false;
  if (action === "approve") return approve && row.status === "DRAFT";
  return (
    create &&
    (action === "cancel" ? row.status === "DRAFT" : row.status !== "APPROVED")
  );
}
