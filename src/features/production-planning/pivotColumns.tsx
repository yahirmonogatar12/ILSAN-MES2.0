import { useMemo, type Dispatch, type SetStateAction } from "react";
import { EditableCell, type TableColumn } from "@/shared/ui";
import { INV_FIELDS, numeric, object, text } from "./model";
import type { PivotViewRow } from "./pivot";
import type { usePivotCells } from "./usePivotCells";

export function usePivotColumns({
  dates,
  projection,
  writable,
  cells,
  setError,
}: {
  dates: string[];
  projection: boolean;
  writable: boolean;
  cells: ReturnType<typeof usePivotCells>;
  setError: Dispatch<SetStateAction<string>>;
}) {
  const { editor, saveCell } = cells;
  return useMemo(() => {
    const grouped = (row: PivotViewRow) => ({
      rowSpan: row._kind === "P" ? 3 : 0,
    });
    const common: TableColumn<PivotViewRow>[] = [
      {
        id: "part_no",
        header: "NÚMERO DE PARTE",
        width: projection ? 170 : 190,
        cellSpan: projection ? grouped : undefined,
        cell: (row) => (
          <span
            title={
              object(row.inv)
                ? `Referencia: ${text(row.inv.ref_date)} · Línea: ${text(row.inv.line)}`
                : undefined
            }
          >
            {text(row.part_no)}
          </span>
        ),
      },
    ];
    if (projection) {
      common.push({
        id: "req_lg",
        header: "REQ LG",
        width: 85,
        cellSpan: grouped,
        cell: (row) => numeric(row.req_lg),
      });
      for (const field of INV_FIELDS)
        common.push({
          id: field,
          header: field.toUpperCase(),
          width: 75,
          cellSpan: grouped,
          cell: (row) => (
            <EditableCell
              editor={editor}
              cellId={JSON.stringify(["inventory", row.part_no, field])}
              label={`Editar ${field.toUpperCase()} ${text(row.part_no)}`}
              value={row.inv?.[field] ?? null}
              formatValue={(value) => (value === "" ? "—" : numeric(value))}
              disabled={!writable}
              onSave={(value) => saveCell(row, "inventory", field, value)}
              onCancel={() => setError("")}
            />
          ),
        });
      common.push({
        id: "kind",
        header: "TIPO",
        width: 55,
        cell: (row) => (
          <span
            className={`production-planning-${text(row._kind).toLowerCase()}`}
          >
            {text(row._kind)}
          </span>
        ),
      });
    }
    common.push({
      id: "total",
      header: "TOTAL",
      width: 95,
      cell: (row) => {
        if (row._kind === "P") return numeric(row.total);
        if (row._kind === "S") return numeric(row.sched_total ?? 0);
        const vals = dates
          .map((day) => (object(row.proj) ? row.proj[day] : null))
          .filter((v) => v !== null && v !== undefined);
        return vals.length ? numeric(vals.at(-1)) : "—";
      },
    });
    for (const date of dates)
      common.push({
        id: date,
        header: `${date.slice(8)}/${date.slice(5, 7)}`,
        width: 90,
        cell: (row) => {
          const source =
              row._kind === "P"
                ? row.qty
                : row._kind === "S"
                  ? row.sched
                  : row.proj,
            value = object(source) ? source[date] : null;
          return row._kind === "S" ? (
            <EditableCell
              editor={editor}
              cellId={JSON.stringify(["schedule", row.part_no, date])}
              label={`Editar schedule ${text(row.part_no)} ${date}`}
              value={value ?? null}
              formatValue={(value) => (value === "" ? "—" : numeric(value))}
              disabled={!writable}
              onSave={(value) => saveCell(row, "schedule", date, value)}
              onCancel={() => setError("")}
            />
          ) : (
            <span
              className={
                Number(value) < 0 ? "production-planning-negative" : undefined
              }
            >
              {value === null || value === undefined ? "—" : numeric(value)}
            </span>
          );
        },
      });
    const totalWidth = common.reduce(
      (sum, column) => sum + Number(column.width),
      0,
    );
    return common.map((column) => ({
      ...column,
      width: `${(Number(column.width) / totalWidth) * 100}%`,
    }));
  }, [dates, projection, writable, editor, saveCell, setError]);
}
