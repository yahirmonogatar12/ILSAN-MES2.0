import { useMemo } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button, CheckboxField, TableRowActions } from "@/shared/ui";
import { makeColumns, text } from "./model";
import type { Row } from "./types";
import type { OrdersController } from "./useOrders";
export function useOrderColumns(state: OrdersController) {
  const { kind, specs, selected, setSelected, list, canCreateWO, setDialog } =
    state;
  const columns = useMemo(
    () => [
      ...(kind === "wo"
        ? [
            {
              id: "selection",
              header: "SELECCIÓN",
              filterable: false,
              width: "5%",
              cell: (row: Row) => (
                <CheckboxField
                  aria-label={`Seleccionar ${text(row.codigo_wo)}`}
                  checked={selected.has(Number(row.id))}
                  disabled={
                    row.estado !== "CREADA" ||
                    !Number(row.id) ||
                    list.isFetching
                  }
                  onChange={(event) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (event.target.checked) next.add(Number(row.id));
                      else next.delete(Number(row.id));
                      return next;
                    })
                  }
                />
              ),
            },
          ]
        : []),
      ...makeColumns(specs).map((col) => ({
        ...col,
        width: `${parseFloat(String(col.width)) * (kind === "wo" ? 0.84 : 0.9)}%`,
      })),
      {
        id: "actions",
        header: "ACCIONES",
        filterable: false,
        width: kind === "wo" ? "11%" : "10%",
        cell: (row: Row) =>
          kind === "po" ? (
            canCreateWO.data && !canCreateWO.isError ? (
              <Button
                size="sm"
                disabled={list.isFetching}
                onClick={() => setDialog({ type: "linked-wo", row })}
              >
                Crear WO
              </Button>
            ) : null
          ) : (
            <TableRowActions
              actions={[
                ...(row.estado === "CREADA"
                  ? [
                      {
                        id: "edit",
                        label: `Editar ${text(row.codigo_wo)}`,
                        icon: <Pencil size={15} />,
                        disabled: list.isFetching || list.isError,
                        onClick: () => setDialog({ type: "edit", row }),
                      },
                      {
                        id: "delete",
                        label: `Eliminar ${text(row.codigo_wo)}`,
                        icon: <Trash2 size={15} />,
                        disabled: list.isFetching || list.isError,
                        tone: "danger" as const,
                        onClick: () => setDialog({ type: "remove", row }),
                      },
                    ]
                  : []),
                {
                  id: "state",
                  label: `Cambiar estado ${text(row.codigo_wo)}`,
                  icon: <RefreshCw size={15} />,
                  disabled: list.isFetching || list.isError,
                  onClick: () => setDialog({ type: "state", row }),
                },
              ]}
            />
          ),
      },
    ],
    [
      kind,
      specs,
      selected,
      list.isFetching,
      list.isError,
      canCreateWO.data,
      canCreateWO.isError,
    ],
  );
  return columns;
}
