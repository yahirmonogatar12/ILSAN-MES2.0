import { describe, expect, it } from "vitest";
import { pivotExport, pivotFields, pivotRows } from "./pivot";
describe("projection presentation data", () => {
  it("keeps consecutive P/S/I rows and preserves historical quantities", () => {
    const rows = [
      {
        part_no: "A",
        inv: null,
        qty: { "2026-11-12": "0" },
        sched: { "2026-11-12": null },
        proj: { "2026-11-12": -5 },
      },
      { part_no: "B", total: 0 },
    ];
    const result = pivotRows(rows, true);
    expect(result.map((row) => [row.part_no, row._kind])).toEqual([
      ["A", "P"],
      ["A", "S"],
      ["A", "I"],
      ["B", "P"],
      ["B", "S"],
      ["B", "I"],
    ]);
    expect(result[0].qty?.["2026-11-12"]).toBe("0");
    expect(result[1].sched?.["2026-11-12"]).toBeNull();
    expect(result[2].proj?.["2026-11-12"]).toBe(-5);
    expect(rows[0]).not.toHaveProperty("_kind");
  });
  it("keeps projection and LG export values aligned with their respective dates", () => {
    const source = [
      {
        part_no: "A",
        qty: { "2026-11-12": 0 },
        sched: { "2026-11-12": "20" },
        proj: { "2026-11-12": -2 },
        total: 0,
        sched_total: "20",
      },
    ];
    const projection = pivotExport(
      ["2026-11-12"],
      pivotRows(source, true),
      true,
    );
    expect(
      projection.rows.map((row) => [row._kind, row["2026-11-12"], row._total]),
    ).toEqual([
      ["P", 0, 0],
      ["S", "20", "20"],
      ["I", -2, -2],
    ]);
    expect(projection.specs.map(([key]) => key)).toEqual([
      "part_no",
      "_kind",
      "_total",
      "2026-11-12",
    ]);
    const lg = pivotExport(["2026-11-12"], pivotRows(source, false), false);
    expect(lg.rows).toHaveLength(1);
    expect(lg.specs.map(([key]) => key)).toEqual([
      "part_no",
      "_total",
      "2026-11-12",
    ]);
  });
  it("keeps shortage filters limited to projection", () => {
    expect(pivotFields(false).map((field) => field.key)).not.toContain(
      "only_shortage",
    );
    expect(pivotFields(true).map((field) => field.key)).toContain(
      "only_shortage",
    );
  });
});
