import { useMemo } from "react";
import type { TableColumn } from "@/shared/ui";
import { makeColumns } from "./columns";
import { lineName, PLAN_SPECS, text } from "./model";
import type { Kind, Plan } from "./types";

const hiddenColumns: Record<Kind, readonly string[]> = {
  ASSY: [
    "lado",
    "lote_padre",
    "qr_required_count",
    "array_size",
    "bottom_producido",
    "top_producido",
  ],
  IMT: [
    "sub_assy",
    "lado",
    "lote_padre",
    "bottom_producido",
    "top_producido",
    "output",
    "entregadas_main",
  ],
  SMT: ["sub_assy", "assigned_bom_rev", "output", "entregadas_main"],
};
export function usePlanColumns(kind: Kind) {
  return useMemo<TableColumn<Plan>[]>(
    () =>
      makeColumns(
        PLAN_SPECS.filter(
          ([id]) => id !== "group_no" && !hiddenColumns[kind].includes(id),
        ),
        false,
      ).map((column) => ({
        ...column,
        className:
          column.id === "sequence"
            ? "process-production-sequence"
            : column.className,
        ...(column.id === "line"
          ? { cell: (row: Plan) => lineName(kind, row.line) }
          : column.id === "status"
            ? {
                cell: (row: Plan) => (
                  <span
                    className={`process-production-status ${row.status === "CANCELADO" ? "process-production-cancelled" : ""}`}
                  >
                    {text(row.status)}
                  </span>
                ),
              }
            : {}),
      })),
    [kind],
  );
}
