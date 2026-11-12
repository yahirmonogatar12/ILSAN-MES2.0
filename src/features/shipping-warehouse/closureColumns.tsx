import { Button, type TableColumn } from "@/shared/ui";
import { columnsFor, ExportAction, type Warehouse } from "./components";
import { formatQuantity, recordId, text } from "./model";
import type { Row } from "./types";

function statusBadge(value: unknown) {
  const status = text(value) || "pendiente";
  const tone =
    status === "igual" || status === "confirmed"
      ? "positive"
      : status === "diferencia" || status === "draft"
        ? "warning"
        : "neutral";
  return (
    <span
      className={
        "shipping-warehouse-closure-status shipping-warehouse-closure-status-" +
        tone
      }
    >
      {status}
    </span>
  );
}
export const closurePreviewColumns: TableColumn<Row>[] = columnsFor([
  ["part_number", "NO. PARTE", 18],
  ["product_model", "MODELO", 15],
  ["system_quantity", "SISTEMA ACTUAL", 12, true],
  ["csv_current_qty", "CSV ACTUAL", 12, true],
  ["difference_quantity", "DIFERENCIA", 12, true],
  ["applied_initial_quantity", "INV. INICIAL", 12, true],
  ["status", "ESTADO", 19],
]).map((column) =>
  column.id === "status"
    ? { ...column, cell: (row) => statusBadge(row.status) }
    : column,
);

export function closureHistoryColumns(
  warehouse: Warehouse,
  pending: boolean,
  select: (row: Row) => void,
): TableColumn<Row>[] {
  const columns = columnsFor([
    ["closure_label", "CIERRE", 16],
    ["closure_month", "MES", 12],
    ["date", "FECHA", 14],
    ["user", "USUARIO", 14],
    ["accuracy_pct", "ACCURACY", 10, true],
    ["status", "ESTADO", 14],
  ]).map((column) => ({
    ...column,
    width: parseFloat(String(column.width)) * 0.8 + "%",
    ...(column.id === "status"
      ? { cell: (row: Row) => statusBadge(row.status) }
      : {}),
    ...(column.id === "accuracy_pct"
      ? { cell: (row: Row) => formatQuantity(row.accuracy_pct ?? 0) + "%" }
      : {}),
  }));
  return [
    ...columns,
    {
      id: "action",
      header: "ACCIÓN",
      width: "20%",
      filterable: false,
      cell: (row) => (
        <div className="shipping-warehouse-inline">
          <Button size="sm" disabled={pending} onClick={() => select(row)}>
            {row.status === "draft" ? "Retomar" : "Ver"}
          </Button>
          <ExportAction
            label="Excel"
            run={() => warehouse.api.closureExport(recordId(row.id))}
            disabled={pending || row.status !== "confirmed"}
          />
        </div>
      ),
    },
  ];
}
