import { isNullableText, isNumericValue, isRecord } from "@/shared/lib/parse";
import { record, rows } from "./model";
import type {
  Extra,
  ExtraResults,
  Plan,
  Proposal,
  ProposalChange,
  ProposalDiff,
  Row,
  ScanLot,
  ScanResult,
  WorkOrder,
} from "./types";
function plan(value: Row): value is Plan {
  return (
    typeof value.lot_no === "string" &&
    !!value.lot_no.trim() &&
    [
      "working_date",
      "line",
      "part_no",
      "wo_code",
      "po_code",
      "model_code",
      "project",
      "process",
      "status",
      "shift",
      "turno",
      "lado",
      "lote_padre",
      "assigned_bom_rev",
    ].every((key) => value[key] === undefined || isNullableText(value[key])) &&
    [
      "plan_count",
      "input",
      "output",
      "produced",
      "produced_count",
      "ct",
      "uph",
      "routing",
      "group_no",
      "sequence",
      "qr_required_count",
      "array_size",
    ].every((key) => value[key] === undefined || isNumericValue(value[key]))
  );
}
export function decodePlans(value: unknown): Plan[] {
  const plans = rows(value).map((row) => {
    if (!plan(row)) throw new Error("El servidor devolvió un plan inválido.");
    return row;
  });
  if (new Set(plans.map((row) => row.lot_no)).size !== plans.length)
    throw new Error("El servidor devolvió lotes sin identificador único.");
  return plans;
}
function workOrder(value: Row): value is WorkOrder {
  return (
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    ["wo_code", "codigo_wo", "modelo"].every(
      (key) => value[key] === undefined || isNullableText(value[key]),
    ) &&
    (value.cantidad_planeada === undefined ||
      isNumericValue(value.cantidad_planeada)) &&
    (value.ya_importado === undefined ||
      value.ya_importado === null ||
      typeof value.ya_importado === "boolean" ||
      typeof value.ya_importado === "number")
  );
}
function scanLot(value: Row): value is ScanLot {
  return (
    typeof value.linea === "string" &&
    typeof value.nparte === "string" &&
    !!value.linea.trim() &&
    !!value.nparte.trim() &&
    (value.cantidad_total === undefined || isNumericValue(value.cantidad_total))
  );
}
function proposal(value: Row): value is Proposal {
  return (
    typeof value.proposal_id === "string" &&
    !!value.proposal_id.trim() &&
    (value.version === undefined ||
      (typeof value.version === "number" &&
        Number.isSafeInteger(value.version)))
  );
}
function change(value: Row): value is ProposalChange {
  return (
    typeof value.lot_no === "string" &&
    isRecord(value.antes) &&
    isRecord(value.despues) &&
    ["campos", "aplicables"].every(
      (key) =>
        value[key] === undefined ||
        (Array.isArray(value[key]) &&
          value[key].every((field) => typeof field === "string")),
    )
  );
}
function scan(value: unknown): ScanResult {
  const data = record(value);
  return {
    ...data,
    scan_lots: rows(data.scan_lots).map((row) => {
      if (!scanLot(row))
        throw new Error("El servidor devolvió un grupo SCAN inválido.");
      return row;
    }),
    plan_options: decodePlans(data.plan_options),
  };
}
function diff(value: unknown): ProposalDiff {
  const data = record(value);
  if (
    (data.proposal_id !== undefined && typeof data.proposal_id !== "string") ||
    (data.version !== undefined &&
      (typeof data.version !== "number" || !Number.isSafeInteger(data.version)))
  )
    throw new Error("El servidor devolvió una propuesta inválida.");
  return {
    ...data,
    proposal_id: data.proposal_id,
    version: data.version,
    cambios: rows(data.cambios).map((row) => {
      if (!change(row))
        throw new Error("La propuesta contiene un cambio inválido.");
      return row;
    }),
    nuevos: rows(data.nuevos),
    sobran: rows(data.sobran),
  };
}
export const extraDecoders: {
  [A in Extra]: (value: unknown) => ExtraResults[A];
} = {
  wos: (value) =>
    rows(value).map((row) => {
      if (!workOrder(row))
        throw new Error("El servidor devolvió una WO inválida.");
      return row;
    }),
  proposals: (value) =>
    rows(value).map((row) => {
      if (!proposal(row))
        throw new Error("El servidor devolvió una propuesta inválida.");
      return row;
    }),
  scan,
  diff,
  "assign-scan": record,
  "create-scan": record,
  "import-wos": record,
  "apply-diff": record,
  "import-proposal": record,
};
