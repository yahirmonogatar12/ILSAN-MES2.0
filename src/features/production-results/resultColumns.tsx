import type { TableColumn } from "@/shared/ui";
import { number, text } from "./model";
import type { ColumnSpec, Row } from "./types";

export function columnsFor(specs: readonly ColumnSpec[]): TableColumn<Row>[] {
  const totalWidth = specs.reduce((sum, column) => sum + column.width, 0);
  return specs.map((column) => ({
    id: column.key,
    header: column.title,
    width: (100 * column.width) / totalWidth + "%",
    textValue: (row) => text(row[column.key]),
    searchValue: column.searchValue,
    searchLabel: column.searchLabel,
    sortValue: (row) =>
      column.numeric ? number(row[column.key]) : text(row[column.key]),
    filterable: column.key !== "numero" && column.filterable !== false,
    cell: (row) => {
      const raw = row[column.key];
      const value =
        raw == null || raw === ""
          ? "—"
          : column.numeric
            ? number(raw).toLocaleString("es-MX")
            : text(raw);
      return (
        <span className="production-results-cell" title={value}>
          {value}
        </span>
      );
    },
  }));
}
