import {
  exportSpreadsheet,
  type SpreadsheetCell,
} from "@/shared/lib/spreadsheet";
import type { ColumnSpec } from "./columns";
import { text } from "./model";
import type { DataRow } from "./types";

export interface ExportSheet {
  name: string;
  specs: readonly ColumnSpec[];
  rows: readonly DataRow[];
}

export async function exportRows(
  name: string,
  columns: readonly ColumnSpec[],
  rows: readonly DataRow[],
  extraSheets: readonly ExportSheet[] = [],
) {
  const sheetRows = (
    specs: readonly ColumnSpec[],
    data: readonly DataRow[],
  ): SpreadsheetCell[][] => [
    specs.map((column) => column[1]),
    ...data.map((row) =>
      specs.map(([key, , , numeric]) => {
        const value =
          key === "archivo_nombre"
            ? row.archivo_nombre || row.archivo_ruta
            : key === "pallet_no"
              ? row.pallet_no || row.pallet_no_original
              : row[key];
        return value == null
          ? ""
          : numeric &&
              text(value).trim() !== "" &&
              Number.isFinite(Number(value))
            ? Number(value)
            : typeof value === "boolean"
              ? value
              : text(value);
      }),
    ),
  ];
  await exportSpreadsheet(`${name}.xlsx`, [
    { name: "Consulta", rows: sheetRows(columns, rows) },
    ...extraSheets.map((sheet) => ({
      name: sheet.name,
      rows: sheetRows(sheet.specs, sheet.rows),
    })),
  ]);
}
