import type { FilterField } from "@/shared/ui";
import { object } from "./model";
import type { PivotFilters, PivotRow, Row, Spec } from "./types";

export interface PivotViewRow extends PivotRow {
  _kind: "P" | "S" | "I";
}
export function pivotRows(
  records: readonly PivotRow[],
  projection: boolean,
): PivotViewRow[] {
  return records.flatMap((row) =>
    projection
      ? [
          { ...row, _kind: "P" },
          { ...row, _kind: "S" },
          { ...row, _kind: "I" },
        ]
      : [{ ...row, _kind: "P" }],
  );
}

export function pivotFields(projection: boolean) {
  const fields: FilterField<PivotFilters>[] = [
    { key: "date_from", label: "Fecha desde", type: "date" },
    { key: "date_to", label: "Fecha hasta", type: "date" },
    { key: "part", label: "Buscar parte", type: "search" },
    ...(projection
      ? [
          {
            key: "only_shortage",
            label: "Existencias proyectadas",
            type: "select",
            options: [
              { value: "", label: "Todas" },
              { value: "1", label: "Solo faltantes desde hoy" },
            ],
          } as FilterField<PivotFilters>,
        ]
      : []),
  ];

  return fields;
}
export function pivotExport(
  dates: string[],
  records: PivotViewRow[],
  projection: boolean,
) {
  const specs: Spec[] = [
    ["part_no", "NÚMERO DE PARTE", 180],
    ...(projection ? [["_kind", "TIPO", 60] as Spec] : []),
    ["_total", "TOTAL", 90],
    ...dates.map((date) => [date, date, 100] as Spec),
  ];
  const rows: Row[] = records.map((row) => {
    const source =
      row._kind === "P" ? row.qty : row._kind === "S" ? row.sched : row.proj;
    return {
      ...row,
      ...(object(source) ? source : {}),
      _total:
        row._kind === "P"
          ? row.total
          : row._kind === "S"
            ? row.sched_total
            : (row.proj?.[dates.at(-1) ?? ""] ?? null),
    };
  });
  return { specs, rows };
}
