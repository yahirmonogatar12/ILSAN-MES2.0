import { rangeIssue, validDate } from "@/shared/lib/date";
import { isRecord, isNumericValue, isNullableText } from "@/shared/lib/parse";
import { record, rows } from "./model";
import type {
  Action,
  ActionResults,
  Inventory,
  Order,
  PivotFilters,
  PivotResult,
  PivotRow,
  ProjectedLot,
  ProjectedPlan,
  PurchaseOrder,
  Row,
  ScheduleItem,
  ScheduleProposal,
  WorkOrder,
} from "./types";

function inventory(value: unknown): value is Inventory {
  return (
    isRecord(value) &&
    [
      "lgemm",
      "isemm",
      "svc",
      "dif",
      "pendiente",
      "rework",
      "smt",
      "imd",
      "i0",
    ].every((key) => value[key] === undefined || isNumericValue(value[key])) &&
    ["line", "ref_date"].every(
      (key) => value[key] === undefined || isNullableText(value[key]),
    )
  );
}
function quantities(value: unknown, dates: ReadonlySet<string>): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([date, quantity]) => dates.has(date) && isNumericValue(quantity),
    )
  );
}
function pivotRow(value: Row, dates: ReadonlySet<string>): value is PivotRow {
  return (
    typeof value.part_no === "string" &&
    !!value.part_no.trim() &&
    ["qty", "sched", "proj"].every(
      (key) => value[key] === undefined || quantities(value[key], dates),
    ) &&
    ["total", "req_lg", "sched_total"].every(
      (key) => value[key] === undefined || isNumericValue(value[key]),
    ) &&
    (value.inv === undefined || value.inv === null || inventory(value.inv))
  );
}
export function decodePivot(
  value: unknown,
  expected?: { filters: PivotFilters; page: number; size: number },
): PivotResult {
  const data = record(value);
  if (
    !Array.isArray(data.dates) ||
    !data.dates.every(
      (date): date is string => typeof date === "string" && validDate(date),
    ) ||
    typeof data.date_from !== "string" ||
    !validDate(data.date_from) ||
    typeof data.date_to !== "string" ||
    !validDate(data.date_to) ||
    rangeIssue(data.date_from, data.date_to) ||
    typeof data.total_parts !== "number" ||
    !Number.isSafeInteger(data.total_parts) ||
    data.total_parts < 0 ||
    typeof data.page !== "number" ||
    !Number.isSafeInteger(data.page) ||
    data.page < 1 ||
    typeof data.page_size !== "number" ||
    !Number.isSafeInteger(data.page_size) ||
    data.page_size < 1 ||
    new Set(data.dates).size !== data.dates.length
  )
    throw new Error("El plan recibido no tiene un formato válido.");
  const from = data.date_from,
    to = data.date_to;
  if (
    data.dates.some(
      (date, index, dates) =>
        date < from || date > to || (index > 0 && date <= dates[index - 1]),
    )
  )
    throw new Error("El plan recibido no tiene un formato válido.");
  const dates = new Set(data.dates);
  const entries = rows(data.rows).map((row) => {
    if (!pivotRow(row, dates))
      throw new Error("El plan contiene una parte con datos inválidos.");
    return row;
  });
  if (
    new Set(entries.map((row) => row.part_no)).size !== entries.length ||
    entries.length > data.page_size
  )
    throw new Error(
      "El plan contiene partes duplicadas o una página inválida.",
    );
  if (
    expected &&
    (data.page !== expected.page ||
      data.page_size !== expected.size ||
      data.date_from !== expected.filters.date_from ||
      data.date_to !== expected.filters.date_to)
  )
    throw new Error(
      "El plan cambió durante la consulta. Actualiza el listado.",
    );
  return {
    ...data,
    dates: data.dates,
    rows: entries,
    date_from: data.date_from,
    date_to: data.date_to,
    total_parts: data.total_parts,
    page: data.page,
    page_size: data.page_size,
  };
}
function purchaseOrder(value: Row): value is PurchaseOrder {
  return (
    typeof value.codigo_po === "string" &&
    !!value.codigo_po.trim() &&
    ["nombre_po", "modelo", "cliente", "estado"].every(
      (key) => value[key] === undefined || isNullableText(value[key]),
    ) &&
    ["total_cantidad_entregada", "cantidad_entregada"].every(
      (key) => value[key] === undefined || isNumericValue(value[key]),
    )
  );
}
function workOrder(value: Row): value is WorkOrder {
  return (
    typeof value.codigo_wo === "string" &&
    !!value.codigo_wo.trim() &&
    (value.id === undefined ||
      (typeof value.id === "number" &&
        Number.isSafeInteger(value.id) &&
        value.id > 0)) &&
    ["modelo", "codigo_modelo", "codigo_po", "estado"].every(
      (key) => value[key] === undefined || isNullableText(value[key]),
    ) &&
    (value.cantidad_planeada === undefined ||
      isNumericValue(value.cantidad_planeada))
  );
}
export function decodeOrders(kind: "po" | "wo", value: unknown): Order[] {
  return rows(value).map((row) => {
    if (kind === "po") {
      if (!purchaseOrder(row))
        throw new Error("El servidor devolvió una orden inválida.");
      return row;
    }
    if (!workOrder(row))
      throw new Error("El servidor devolvió una orden inválida.");
    return row;
  });
}

function projectedLot(value: Row): value is ProjectedLot {
  return (
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    ["lot_no", "part_no", "status"].every(
      (key) => value[key] === undefined || isNullableText(value[key]),
    ) &&
    ["qty_plan", "fisico"].every(
      (key) => value[key] === undefined || isNumericValue(value[key]),
    )
  );
}
export function decodeProjectedPlan(value: unknown): ProjectedPlan {
  const data = record(value);
  if (
    data.lineas_activas !== undefined &&
    (!Array.isArray(data.lineas_activas) ||
      !data.lineas_activas.every(
        (line): line is string => typeof line === "string",
      ))
  )
    throw new Error("El servidor devolvió líneas inválidas.");
  return {
    ...data,
    lotes: rows(data.lotes).map((row) => {
      if (!projectedLot(row))
        throw new Error("El servidor devolvió un lote proyectado inválido.");
      return row;
    }),
    lineas: rows(data.lineas),
    lineas_activas: data.lineas_activas,
  };
}
function scheduleItem(value: Row): value is ScheduleItem {
  return (
    ["item_id", "part_no", "sched_date", "linea", "turno"].every(
      (key) => typeof value[key] === "string",
    ) &&
    typeof value.item_id === "string" &&
    !!value.item_id.trim() &&
    typeof value.qty === "number" &&
    Number.isFinite(value.qty)
  );
}
export function decodeScheduleProposal(value: unknown): ScheduleProposal {
  const data = record(value);
  if (
    typeof data.proposal_id !== "string" ||
    !data.proposal_id.trim() ||
    typeof data.version !== "number" ||
    !Number.isSafeInteger(data.version)
  )
    throw new Error("El servidor no devolvió una propuesta revisable.");
  const proposals = rows(data.proposals).map((row) => {
    if (!scheduleItem(row))
      throw new Error("La propuesta contiene una fila inválida.");
    return row;
  });
  if (new Set(proposals.map((row) => row.item_id)).size !== proposals.length)
    throw new Error("La propuesta contiene identificadores repetidos.");
  return {
    ...data,
    proposal_id: data.proposal_id,
    version: data.version,
    proposals,
  };
}
export const actionDecoders: {
  [A in Action]: (value: unknown) => ActionResults[A];
} = {
  "create-po": record,
  "create-wo": record,
  "update-wo": record,
  "delete-wo": record,
  "state-wo": record,
  "link-wo": record,
  "import-wos": record,
  schedule: record,
  "inventory-field": record,
  propose: decodeScheduleProposal,
  "apply-proposal": record,
  "reject-proposal": record,
  generate: record,
  "generate-faltantes": record,
  "generate-schedule": record,
  "acomodar-ia": record,
  "confirm-lots": record,
  "config-lines": record,
  "add-lot": record,
  "update-lot": record,
  "delete-lot": record,
};
