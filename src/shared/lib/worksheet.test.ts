import { expect, it } from "vitest";
import { worksheetView } from "./worksheet";
it("preserva posiciones vacías, valores formateados y combinaciones al extender la vista", () => {
  const source = {
    A1: { v: "Invoice" },
    A2: { v: 7, w: "0007" },
    B2: { v: 0 },
    C2: { v: false },
    "!cols": [{ wpx: 180 }],
    "!merges": [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 498, c: 0 }, e: { r: 501, c: 0 } },
    ],
  };
  const range = { s: { r: 0, c: 0 }, e: { r: 700, c: 2 } };
  const first = worksheetView(source, range);
  expect(first.rows).toHaveLength(500);
  expect(first.rows[0].cells).toEqual([
    { column: 0, text: "Invoice", colSpan: 3, rowSpan: 1 },
  ]);
  expect(first.rows[1].cells.map((cell) => cell.text)).toEqual([
    "0007",
    "0",
    "false",
  ]);
  expect(first.rows[2].cells.map((cell) => cell.text)).toEqual(["", "", ""]);
  expect(first.columns[0].width).toBe(180);
  expect(first.rows[498].cells[0].rowSpan).toBe(2);
  const more = worksheetView(source, range, 1000);
  expect(more.rows).toHaveLength(701);
  expect(more.rows[498].cells[0].rowSpan).toBe(4);
});
it("limita el tamaño del DOM incluso con rangos y combinaciones enormes", () => {
  const view = worksheetView(
    { "!merges": [{ s: { r: 0, c: 0 }, e: { r: 999999, c: 9999 } }] },
    { s: { r: 0, c: 0 }, e: { r: 999999, c: 9999 } },
    50000,
  );
  expect(view.columns).toHaveLength(100);
  expect(view.rows).toHaveLength(1000);
  expect(view.rows[0].cells[0]).toMatchObject({ colSpan: 100, rowSpan: 1000 });
  expect(view.limited).toBe(true);
});
