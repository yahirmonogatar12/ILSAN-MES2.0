import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useCellEditor } from "@/shared/ui";
import type { usePlanning } from "./components";
import { cellInteger, object, text } from "./model";
import type { PivotRow, Row } from "./types";

export function usePivotCells(
  auth: Pick<ReturnType<typeof usePlanning>, "api" | "client" | "scope">,
  setError: Dispatch<SetStateAction<string>>,
  setResult: Dispatch<SetStateAction<Row | null>>,
) {
  const editor = useCellEditor();
  const [capture, setCapture] = useState({ linea: "", turno: "DIA" });
  const saveCell = useCallback(
    async (
      row: PivotRow,
      kind: "inventory" | "schedule",
      field: string,
      raw: string,
    ) => {
      const part = text(row.part_no);
      try {
        setError("");
        const value = cellInteger(raw, kind === "schedule" ? 0 : undefined);
        const linea = (
          capture.linea.trim() || (object(row.inv) ? text(row.inv.line) : "")
        )
          .trim()
          .toUpperCase();
        if (kind === "schedule" && value > 0 && !linea)
          throw new Error(
            "Selecciona una línea de schedule para una cantidad positiva.",
          );
        await auth.api.action(
          kind === "inventory" ? "inventory-field" : "schedule",
          kind === "inventory"
            ? {
                part_no: part,
                field,
                value,
              }
            : {
                part_no: part,
                sched_date: field,
                sched_qty: raw.trim() === "" ? null : value,
                linea,
                turno: capture.turno,
              },
        );
        setResult(null);
        await auth.client.invalidateQueries({
          queryKey: ["production-planning", auth.scope],
        });
        return kind === "schedule" && raw.trim() === "" ? "" : String(value);
      } catch (cause) {
        const issue =
          cause instanceof Error
            ? cause
            : new Error("No se pudo guardar la celda.");
        setError(
          `${part} · ${kind === "inventory" ? field.toUpperCase() : field}: ${issue.message}`,
        );
        throw issue;
      }
    },
    [auth.api, auth.client, auth.scope, capture, setError, setResult],
  );

  return { editor, capture, setCapture, saveCell };
}
