import { loadScript } from "./loadScript";

export const SPREADSHEET_VERSION = "0.20.3";
export const SPREADSHEET_SCRIPT = "/vendor/xlsx-0.20.3.full.min.js";
export const MAX_SPREADSHEET_BYTES = 200 * 1024 * 1024;

export type SpreadsheetCell = string | number | boolean | null;
export interface Workbook {
  SheetNames: string[];
  Sheets: Record<string, Record<string, unknown>>;
}
interface SpreadsheetEngine {
  version: string;
  read(buffer: ArrayBuffer, options: Record<string, unknown>): Workbook;
  writeFile(workbook: Workbook, filename: string): void;
  write(workbook: Workbook, options: Record<string, unknown>): ArrayBuffer;
  utils: {
    book_new(): Workbook;
    book_append_sheet(
      workbook: Workbook,
      sheet: Record<string, unknown>,
      name: string,
    ): void;
    aoa_to_sheet(
      rows: readonly (readonly SpreadsheetCell[])[],
    ): Record<string, unknown>;
    sheet_to_json<T>(
      sheet: Record<string, unknown>,
      options: Record<string, unknown>,
    ): T[];
    decode_range(range: string): {
      s: { r: number; c: number };
      e: { r: number; c: number };
    };
    encode_col(column: number): string;
  };
}
declare global {
  interface Window {
    XLSX?: SpreadsheetEngine;
  }
}
/** Optional local engine. No network/CDN dependency or initial bundle import. */
export async function spreadsheetEngine() {
  await loadScript(SPREADSHEET_SCRIPT);
  if (window.XLSX?.version !== SPREADSHEET_VERSION)
    throw new Error(
      "No se pudo cargar la versión actual del lector de Excel. Recarga la página.",
    );
  return window.XLSX;
}
/** Check before loading the engine or allocating the file's ArrayBuffer. */
export function validateSpreadsheetSize(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_SPREADSHEET_BYTES)
    throw new Error(
      "La vista previa de Excel admite archivos con datos de hasta 200 MB.",
    );
}
export async function exportSpreadsheet(
  name: string,
  sheets: readonly {
    name: string;
    rows: readonly (readonly SpreadsheetCell[])[];
  }[],
) {
  const engine = await spreadsheetEngine();
  const book = engine.utils.book_new();
  for (const sheet of sheets)
    engine.utils.book_append_sheet(
      book,
      engine.utils.aoa_to_sheet(sheet.rows),
      sheet.name.slice(0, 31),
    );
  engine.writeFile(book, name.replace(/[\\/]/g, "_"));
}
