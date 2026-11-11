export interface WorksheetCell {
  column: number;
  text: string;
  colSpan: number;
  rowSpan: number;
}
export interface WorksheetView {
  columns: { label: string; width: number }[];
  rows: { number: number; height?: number; cells: WorksheetCell[] }[];
  totalRows: number;
  limited: boolean;
}
type Point = { r: number; c: number };
type Range = { s: Point; e: Point };
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
function columnName(index: number) {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
}
/** Bounded text-only worksheet. Uses stored formatted values and merges, never workbook HTML. */
export function worksheetView(
  source: Record<string, unknown>,
  range: Range,
  visibleRows = 500,
): WorksheetView {
  const start = { r: Math.max(0, range.s.r), c: Math.max(0, range.s.c) };
  const endColumn = Math.min(range.e.c, start.c + 99);
  const width = Math.max(1, endColumn - start.c + 1);
  const totalRows = Math.max(0, range.e.r - start.r + 1);
  const count = Math.min(
    totalRows,
    visibleRows,
    10000,
    Math.floor(100000 / width),
  );
  const lastRow = start.r + count - 1;
  const merges = (
    Array.isArray(source["!merges"]) ? source["!merges"] : []
  ).filter((value): value is Range => {
    const merge = record(value),
      s = record(merge.s),
      e = record(merge.e);
    return (
      [s.r, s.c, e.r, e.c].every(Number.isSafeInteger) &&
      Number(s.r) <= Number(e.r) &&
      Number(s.c) <= Number(e.c)
    );
  });
  const covered = new Set<string>();
  const anchors = new Map<string, { colSpan: number; rowSpan: number }>();
  for (const merge of merges) {
    const top = Math.max(start.r, merge.s.r),
      bottom = Math.min(lastRow, merge.e.r);
    const left = Math.max(start.c, merge.s.c),
      right = Math.min(endColumn, merge.e.c);
    if (top > bottom || left > right) continue;
    anchors.set(`${top}:${left}`, {
      rowSpan: bottom - top + 1,
      colSpan: right - left + 1,
    });
    for (let r = top; r <= bottom; r++)
      for (let c = left; c <= right; c++)
        if (r !== top || c !== left) covered.add(`${r}:${c}`);
  }
  const columnMeta = Array.isArray(source["!cols"]) ? source["!cols"] : [];
  const rowMeta = Array.isArray(source["!rows"]) ? source["!rows"] : [];
  return {
    totalRows,
    limited:
      totalRows > Math.min(10000, Math.floor(100000 / width)) ||
      range.e.c > endColumn,
    columns: Array.from({ length: width }, (_, index) => {
      const meta = record(columnMeta[start.c + index]);
      const pixels = Number(meta.wpx) || Number(meta.wch) * 7 + 5 || 120;
      return {
        label: columnName(start.c + index),
        width: Math.max(24, Math.min(pixels, 800)),
      };
    }),
    rows: Array.from({ length: count }, (_, index) => {
      const r = start.r + index,
        cells: WorksheetCell[] = [];
      for (let c = start.c; c <= endColumn; c++) {
        if (covered.has(`${r}:${c}`)) continue;
        const cell = record(source[`${columnName(c)}${r + 1}`]);
        const value = cell.w ?? cell.v;
        cells.push({
          column: c,
          text: value === null || value === undefined ? "" : String(value),
          colSpan: 1,
          rowSpan: 1,
          ...anchors.get(`${r}:${c}`),
        });
      }
      const meta = record(rowMeta[r]);
      const height =
        Number(meta.hpx) || (Number(meta.hpt) * 4) / 3 || undefined;
      return {
        number: r + 1,
        height: height ? Math.max(18, Math.min(height, 300)) : undefined,
        cells,
      };
    }),
  };
}
