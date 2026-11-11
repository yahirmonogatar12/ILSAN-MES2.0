import type { TableColumn } from "@/shared/ui";
import { COLUMNS, NUMERIC_COLUMNS } from "./config";
import { cellText, numberText } from "./model";
import type { AreaRow, AreaView } from "./types";
export function columnsFor(view: AreaView): TableColumn<AreaRow>[] {
  const specs = COLUMNS[view],
    total = specs.reduce((sum, spec) => sum + spec[2], 0);
  return specs.map(([id, header, weight]) => ({
    id,
    header,
    width: `${(weight / total) * 100}%`,
    cell: (row) =>
      NUMERIC_COLUMNS.has(id) ? numberText(row[id]) : cellText(row[id]),
    textValue: (row) => cellText(row[id]),
    className: id === "stock" ? "material-areas-stock" : undefined,
  }));
}
