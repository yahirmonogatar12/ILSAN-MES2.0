import type { TableColumn } from "@/shared/ui";
import { text } from "./model";
import type { Row, Spec } from "./types";

export function makeColumns(
  specs: readonly Spec[],
  sortable = true,
): TableColumn<Row>[] {
  const total = specs.reduce((n, spec) => n + spec[2], 0);
  return specs.map(([id, header, size]) => ({
    id,
    header,
    width: `${(size / total) * 100}%`,
    cell: (row) => text(row[id]) || "—",
    textValue: (row) => text(row[id]),
    ...(sortable
      ? {
          sortValue: (row: Row) =>
            typeof row[id] === "number" ? (row[id] as number) : text(row[id]),
        }
      : {}),
  }));
}
