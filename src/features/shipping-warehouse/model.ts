import { today, rangeIssue as dateRangeIssue } from "@/shared/lib/date";
import { number } from "@/shared/lib/parse";
import { jsonText as text } from "@/shared/lib/text";

import type { Filters, ListKind, MovementType, Row } from "./types";

export { today, number, text };

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
  return dateRangeIssue(filters.fecha_desde, filters.fecha_hasta);
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

export const movementEditFields = [
  { column: "fecha", key: "fecha", label: "Fecha", type: "date" },
  { column: "hora", key: "hora", label: "Hora", type: "time" },
  {
    column: "display_quantity",
    key: "cantidad",
    label: "Cantidad",
    type: "number",
  },
  { column: "zone_code", key: "zona", label: "Zona", type: "text" },
  {
    column: "location_value",
    key: "ubicacion_destino",
    label: "Ubicación / Destino",
    type: "text",
  },
  {
    column: "departure_code",
    key: "departure",
    label: "Departure",
    type: "text",
  },
] as const;

export type MovementEdit = {
  row: Row;
  values: Record<string, string>;
};

export function editableMovementFields(row: Row) {
  return movementEditFields.filter(
    (field) => field.key !== "departure" || row.movement_type === "exit",
  );
}

export function captureMovementEdit(row: Row): MovementEdit {
  return {
    row,
    values: Object.fromEntries(
      editableMovementFields(row).map((field) => [
        field.key,
        text(row[field.column]),
      ]),
    ),
  };
}

export function buildMovementReview(edit: MovementEdit): {
  changes: Row;
  differences: Row[];
  issue: string;
} {
  const differences: Row[] = [];
  const changes: Row = {};

  for (const field of editableMovementFields(edit.row)) {
    const before = text(edit.row[field.column]).trim();
    const after = text(edit.values[field.key]).trim();
    if (before === after) continue;

    if ((field.key === "fecha" || field.key === "hora") && !after) {
      return {
        changes: {},
        differences: [],
        issue: field.label + " es obligatoria.",
      };
    }

    if (field.key === "cantidad") {
      const quantity = integer(after, 0);
      if (quantity === null) {
        return {
          changes: {},
          differences: [],
          issue: "Captura una cantidad entera válida.",
        };
      }
      changes[
        edit.row.movement_type === "return"
          ? returnIsExit(edit.row)
            ? "loss_quantity"
            : "return_quantity"
          : "quantity"
      ] = quantity;
    } else if (field.key === "fecha" || field.key === "hora") {
      const date = text(edit.values.fecha).trim();
      const time = text(edit.values.hora).trim();
      if (!date || !time) {
        return {
          changes: {},
          differences: [],
          issue: !date ? "Fecha es obligatoria." : "Hora es obligatoria.",
        };
      }
      changes.movement_at = `${date} ${time}`;
    } else if (field.key === "zona") {
      changes.zone_code = after;
    } else if (field.key === "ubicacion_destino") {
      changes[
        edit.row.movement_type === "exit" ? "destination_area" : "location_code"
      ] = after;
    } else if (field.key === "departure") {
      changes.departure_code = after;
    }

    differences.push({ label: field.label, before, after });
  }

  return {
    changes,
    differences,
    issue: differences.length ? "" : "No hay cambios por guardar.",
  };
}

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
