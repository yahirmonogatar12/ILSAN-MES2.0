import type { TableColumn } from "@/shared/ui";
import { formatQuantity, number, text } from "./model";
import type { Row } from "./types";

export type ColumnSpec = readonly [
  key: string,
  label: string,
  width: number,
  quantity?: boolean,
];

export function columnsFor(specs: readonly ColumnSpec[]): TableColumn<Row>[] {
  const total = specs.reduce((sum, spec) => sum + spec[2], 0);
  return specs.map(([id, header, width, quantity]) => ({
    id,
    header,
    width: (100 * width) / total + "%",
    cell: (row) =>
      row[id] == null || row[id] === ""
        ? "—"
        : quantity
          ? formatQuantity(row[id])
          : text(row[id]),
    textValue: (row) => text(row[id]),
    sortValue: (row) => (quantity ? number(row[id]) : text(row[id])),
  }));
}

export interface Field {
  key: string;
  label: string;
  type?:
    | "date"
    | "datetime-local"
    | "time"
    | "number"
    | "password"
    | "textarea";
  options?: readonly { value: string; label: string }[];
  min?: number;
  step?: number | "any";
  required?: boolean;
  readOnly?: boolean;
  maxLength?: number;
}

export const deleteFields: Field[] = [
  {
    key: "password",
    label: "Contraseña actual",
    type: "password",
    required: true,
  },
  {
    key: "notes",
    label: "Comentario de eliminación",
    type: "textarea",
    required: true,
  },
];
