import { isValidElement, type ReactNode } from "react";
import type { ColumnFilters, TableColumn } from "./types";

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node))
    return nodeText(node.props.children);
  return "";
}
/** A custom cell component supplies textValue; filtering never executes component render functions. */
export function cellText<T>(column: TableColumn<T>, row: T): string {
  return (
    column.textValue ? column.textValue(row) : nodeText(column.cell(row))
  ).trim();
}
/** Excel-style unique values: numeric order, duplicates removed, blanks at the end. */
export function distinctValues(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()))].sort((a, b) =>
    a === ""
      ? 1
      : b === ""
        ? -1
        : a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }),
  );
}
/** Across columns filters are AND; each column accepts any checked value. */
export function filterTableRows<T>(
  rows: readonly T[],
  columns: readonly TableColumn<T>[],
  filters: ColumnFilters,
): T[] {
  const active = columns
    .filter(
      (column) =>
        column.filterable !== false && filters[column.id] !== undefined,
    )
    .map((column) => ({ column, allowed: new Set(filters[column.id]) }));
  return rows.filter((row) =>
    active.every(({ column, allowed }) => allowed.has(cellText(column, row))),
  );
}
