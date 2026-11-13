import { DataGrid, DataTable, type TableColumn } from "@/shared/ui";
import type { Row } from "./types";
import type { PpmPeriod, PpmReport } from "./reportTypes";
import { reportColumns } from "./reportColumns";
import { number, text } from "./model";
import { pivotRows, weeklyRows } from "./reportRows";
function periodColumns(
  periods: { key: string; label: string }[],
  leading: TableColumn<Row>[],
): TableColumn<Row>[] {
  return [
    ...leading,
    ...periods.map((period) => ({
      id: period.key,
      header: period.label,
      width: 100 / (periods.length + leading.length) + "%",
      cell: (row: Row) => (
        <span
          className={
            row.metric === "ppm" &&
            number(row[period.key]) > number(row["target:" + period.key])
              ? "quality-control-over-target"
              : undefined
          }
        >
          {number(row[period.key]).toLocaleString("es-MX")}
        </span>
      ),
    })),
  ];
}
const item: TableColumn<Row> = {
  id: "item",
  header: "Item",
  width: "100px",
  cell: (row) => text(row.item),
};
export function PpmTrendTable({
  periods,
  label,
}: {
  periods: PpmPeriod[];
  label: string;
}) {
  const rows = pivotRows(periods).map((row) => ({
    ...row,
    ...Object.fromEntries(
      periods.map((period) => ["target:" + period.key, period.target]),
    ),
  }));
  return (
    <DataTable
      label={label}
      rows={rows}
      columns={periodColumns(periods, [item])}
      rowKey={(row) => text(row.metric)}
      layout="fixed"
      minWidth={Math.max(640, (periods.length + 1) * 82)}
    />
  );
}
const topColumns = reportColumns([
  { key: "part_number", title: "Proyecto", width: 180 },
  { key: "model", title: "Modelo", width: 180 },
  { key: "inspected", title: "TTL PDN", width: 110 },
  { key: "defects", title: "TTL DEFECT", width: 110 },
  { key: "ppm", title: "PPM", width: 100 },
]).map((col) =>
  col.id === "ppm"
    ? {
        ...col,
        cell: (row: Row) => (
          <span
            className={
              number(row.ppm) > number(row.target)
                ? "quality-control-over-target"
                : undefined
            }
          >
            {number(row.ppm).toLocaleString("es-MX")}
          </span>
        ),
      }
    : col,
);
export function PpmTopTable({ report }: { report: PpmReport }) {
  return (
    <DataGrid
      label="Detalle Top 5"
      rows={report.topDetails.map((row) => ({ ...row }))}
      columns={topColumns}
      rowKey={(row) => text(row.part_number)}
      layout="fixed"
      minWidth={680}
    />
  );
}
export function PpmWeeklyTable({ report }: { report: PpmReport }) {
  const rows = weeklyRows(report);
  const line: TableColumn<Row> = {
    id: "line",
    header: "Línea",
    width: "90px",
    cell: (row) => text(row.line),
    cellSpan: (row) => ({ rowSpan: row.index === 0 ? 3 : 0, colSpan: 1 }),
  };
  return (
    <DataTable
      label="Detalle PPM por línea y semana"
      rows={rows}
      columns={periodColumns(report.weekly.periods, [line, item])}
      rowKey={(row, index) => text(row.line) + ":" + index}
      layout="fixed"
      minWidth={Math.max(900, (report.weekly.periods.length + 2) * 80)}
      rowProps={(row) => ({
        className:
          row.metric === "ppm" ? "quality-control-week-end" : undefined,
      })}
    />
  );
}
