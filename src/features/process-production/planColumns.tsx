import { useMemo } from "react";
import { ArrowDown, ArrowUp, Ban, MoveRight, Pencil } from "lucide-react";
import { TableRowActions, type TableColumn } from "@/shared/ui";
import { makeColumns } from "./columns";
import { lineName, PLAN_SPECS, text } from "./model";
import type { Kind, Plan, PlanDialog } from "./types";

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
export function usePlanColumns({
  kind,
  calculated,
  ready,
  dirty,
  busy,
  open,
  reorder,
}: {
  kind: Kind;
  calculated: Plan[];
  ready: boolean;
  dirty: boolean;
  busy: boolean;
  open: (dialog: PlanDialog) => void;
  reorder: (lot: string, target: string) => void;
}) {
  const positions = useMemo(
    () => new Map(calculated.map((row, index) => [row.lot_no, index])),
    [calculated],
  );
  return useMemo<TableColumn<Plan>[]>(
    () => [
      ...makeColumns(
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
        width: `${parseFloat(String(column.width)) * 0.89}%`,
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
      {
        id: "actions",
        header: "ACCIONES",
        width: "11%",
        filterable: false,
        cell: (row) => {
          const index = positions.get(row.lot_no) ?? -1;
          const previous = calculated[index - 1],
            next = calculated[index + 1];
          return (
            <TableRowActions
              actions={[
                {
                  id: "edit",
                  label: `Editar ${row.lot_no}`,
                  icon: <Pencil size={14} />,
                  disabled: !ready || dirty || busy,
                  onClick: () => open({ type: "edit", row }),
                },
                {
                  id: "cancel",
                  label: `${row.status === "CANCELADO" ? "Reactivar" : "Cancelar"} ${row.lot_no}`,
                  icon: <Ban size={14} />,
                  tone: "danger",
                  disabled: !ready || dirty || busy,
                  onClick: () => open({ type: "cancel", row }),
                },
                {
                  id: "up",
                  label: `Subir ${row.lot_no}`,
                  icon: <ArrowUp size={14} />,
                  disabled:
                    !ready ||
                    busy ||
                    !previous ||
                    previous._bucket !== row._bucket,
                  onClick: () =>
                    previous && reorder(row.lot_no, previous.lot_no),
                },
                {
                  id: "down",
                  label: `Bajar ${row.lot_no}`,
                  icon: <ArrowDown size={14} />,
                  disabled:
                    !ready || busy || !next || next._bucket !== row._bucket,
                  onClick: () => next && reorder(row.lot_no, next.lot_no),
                },
                ...(kind === "ASSY"
                  ? [
                      {
                        id: "group",
                        label: `Mover de grupo ${row.lot_no}`,
                        icon: <MoveRight size={14} />,
                        disabled: !ready || busy,
                        onClick: () => open({ type: "group", row }),
                      },
                    ]
                  : []),
              ]}
            />
          );
        },
      },
    ],
    [kind, calculated, positions, ready, dirty, busy, open, reorder],
  );
}
