import type { TableColumn } from "@/shared/ui";
import { number, text } from "./model";
import type { ColumnSpec, Row } from "./types";
export function reportColumns(
  specs: readonly ColumnSpec[],
): TableColumn<Row>[] {
  const total = specs.reduce((sum, col) => sum + col.width, 0);
  return specs.map((col) => ({
    id: col.key,
    header: col.title,
    width: (col.width / total) * 100 + "%",
    cell: (row) => (
      <span
        className="quality-control-cell"
        title={text(row[col.key]) || undefined}
      >
        {text(row[col.key]) || "—"}
      </span>
    ),
    textValue: (row) => text(row[col.key]),
    sortValue: (row) =>
      typeof row[col.key] === "number"
        ? number(row[col.key])
        : text(row[col.key]),
  }));
}
export const oqcColumns = reportColumns([
  { key: "fecha", title: "Fecha", width: 100 },
  { key: "hora", title: "Hora", width: 90 },
  { key: "oqc_folio", title: "Folio OQC", width: 140 },
  { key: "box_code", title: "Box ID", width: 170 },
  { key: "part_number", title: "No. parte", width: 150 },
  { key: "quantity", title: "Cantidad", width: 90 },
  { key: "product_model", title: "Modelo", width: 150 },
  { key: "customer", title: "Cliente", width: 90 },
  { key: "released_by_name", title: "Liberado por", width: 155 },
]);
export const lqcDetailColumns = reportColumns([
  { key: "linea", title: "Línea", width: 80 },
  { key: "fecha", title: "Fecha", width: 100 },
  { key: "part", title: "No. parte", width: 135 },
  { key: "lot_no", title: "Lote", width: 130 },
  { key: "box_code", title: "Caja", width: 140 },
  { key: "quantity", title: "Cantidad", width: 100 },
  { key: "turno", title: "Turno", width: 100 },
  { key: "status", title: "Estado", width: 100 },
  { key: "fechas_repetidas", title: "Fechas históricas", width: 150 },
  { key: "escaneos_repetidos", title: "Escaneos históricos", width: 170 },
  { key: "serial", title: "Serial", width: 210 },
  { key: "last_scan", title: "Último escaneo", width: 160 },
]);
export const lqcSummaryColumns = (allLines: boolean) =>
  reportColumns([
    { key: "fecha", title: "Fecha", width: 100 },
    { key: "part", title: "No. parte", width: 155 },
    ...(!allLines ? [{ key: "lot_no", title: "Lote", width: 140 }] : []),
    { key: "total", title: "Total", width: 85 },
    { key: "unicas", title: "Únicas", width: 85 },
    { key: "repetidas", title: "Repetidas hist.", width: 115 },
    { key: "DIA", title: "Día", width: 85 },
    { key: "TIEMPO EXTRA", title: "T. extra", width: 85 },
    { key: "NOCHE", title: "Noche", width: 85 },
  ]);
