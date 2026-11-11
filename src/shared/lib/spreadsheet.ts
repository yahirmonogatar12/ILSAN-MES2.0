import { loadScript } from "./loadScript";

export type SpreadsheetCell = string | number | boolean | null;
export interface Workbook {
  SheetNames: string[];
  Sheets: Record<string, Record<string, unknown>>;
}
interface SpreadsheetEngine {
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
  await loadScript("/vendor/xlsx.full.min.js");
  if (!window.XLSX) throw new Error("No se pudo cargar el lector de Excel.");
  return window.XLSX;
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
