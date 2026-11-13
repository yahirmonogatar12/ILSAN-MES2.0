import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  SPREADSHEET_SCRIPT,
  SPREADSHEET_VERSION,
  type Workbook,
} from "./spreadsheet";

const script = readFileSync("public" + SPREADSHEET_SCRIPT);
const context = createContext({ ArrayBuffer, Uint8Array });
runInContext(script.toString("utf8"), context, { timeout: 5000 });
const engine = context.XLSX as NonNullable<Window["XLSX"]>;
const readOptions = {
  type: "array",
  cellHTML: false,
  cellFormula: false,
  cellStyles: true,
};
function workbook(): Workbook {
  const book = engine.utils.book_new();
  const sheet = engine.utils.aoa_to_sheet([
    ["Invoice · México", null, "수량"],
    ["Número de parte", "Cantidad", "Fecha"],
    ["0001/A+02&B", 0, 45292],
    ["=texto de origen", 1234.5, null],
  ]);
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  sheet["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }];
  sheet["!rows"] = [{ hpt: 30 }];
  sheet.C3 = { t: "n", v: 45292, z: "yyyy-mm-dd" };
  engine.utils.book_append_sheet(book, sheet, "INVOICE(CONVERTED)");
  engine.utils.book_append_sheet(
    book,
    engine.utils.aoa_to_sheet([["Otra hoja", "001"]]),
    "Packing",
  );
  return book;
}
describe("pinned local SheetJS distribution", () => {
  it("loads the verified release and retains the upstream license notice", () => {
    expect(engine.version).toBe(SPREADSHEET_VERSION);
    expect(createHash("sha256").update(script).digest("hex")).toBe(
      "cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41",
    );
    expect(script.toString("utf8")).toContain(
      "xlsx.js (C) 2013-present SheetJS",
    );
  });
  it.each(["xlsx", "xls", "xlsb", "ods"])(
    "roundtrips %s with multiple sheets, codes, zeros, dates and merged cells",
    (bookType) => {
      const result = engine.read(
        engine.write(workbook(), { bookType, type: "array" }),
        readOptions,
      );
      expect(Array.from(result.SheetNames)).toEqual([
        "INVOICE(CONVERTED)",
        "Packing",
      ]);
      const sheet = result.Sheets["INVOICE(CONVERTED)"];
      expect(sheet.A3).toMatchObject({ v: "0001/A+02&B", t: "s" });
      expect(sheet.B3).toMatchObject({ v: 0 });
      expect(sheet.C3).toMatchObject({ v: 45292 });
      if (bookType !== "ods")
        expect(sheet.C3).toMatchObject({ w: "2024-01-01" });
      expect(sheet.A4).toMatchObject({ v: "=texto de origen", t: "s" });
      expect(sheet["!merges"]).toEqual([
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      ]);
      expect(result.Sheets.Packing.B1).toMatchObject({ v: "001", t: "s" });
    },
  );
  it("reads a UTF-8 CSV with BOM, non-ASCII text and zero quantities", () => {
    const buffer = new TextEncoder().encode(
      "\uFEFFParte,Cantidad,Descripción\nQA-1,0,서울 México\n",
    ).buffer;
    const sheet = engine.read(buffer, readOptions).Sheets.Sheet1;
    expect(sheet.B2).toMatchObject({ v: 0 });
    expect(sheet.C2).toMatchObject({ v: "서울 México" });
  });
});
// @vitest-environment node
