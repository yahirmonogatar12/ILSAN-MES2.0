import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlanningApi } from "./api";
import {
  decodeOrders,
  decodePivot,
  decodeProjectedPlan,
  decodeScheduleProposal,
} from "./contracts";
import { actionPayloads } from "./requests";
import type { PlanningApi } from "./types";
const from = "2026-11-02",
  to = "2026-11-08";
afterEach(() => vi.unstubAllGlobals());
const response = () => ({
  date_from: from,
  date_to: to,
  dates: [from],
  total_parts: 1,
  page: 1,
  page_size: 200,
  rows: [
    {
      part_no: "0001/A-01",
      total: "0",
      qty: { [from]: 0 },
      sched: {},
      proj: { [from]: null },
      inv: null,
    },
  ],
});
describe("contratos tipados de planificación", () => {
  it("rechaza partes repetidas entre páginas remotas con metadatos válidos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const page = Number(
          new URL(url, "http://local").searchParams.get("page"),
        );
        return new Response(
          JSON.stringify({
            ...response(),
            total_parts: 400,
            page,
            rows: Array.from({ length: 200 }, (_, index) => ({
              part_no: `DUP-${index}`,
            })),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    await expect(
      createPlanningApi("live").pivot(
        { date_from: from, date_to: to, part: "", only_shortage: "" },
        1,
        500,
      ),
    ).rejects.toThrow("cambió");
  });
  it("conserva partes completas, ceros, números textuales, inventario ausente y metadatos históricos", () => {
    const value = { ...response(), legacy: { revision: 1 } };
    expect(decodePivot(value)).toEqual(value);
  });
  it.each([
    { date_from: undefined },
    { date_to: 1 },
    { date_from: "2026-02-30" },
    { date_from: to, date_to: from },
    { dates: [from, from] },
    { dates: ["2026-11-09"] },
    { dates: [to, from] },
    { page: 0 },
    { page_size: 0 },
    { total_parts: -1 },
    { rows: [{ part_no: "A", qty: { [from]: {} } }] },
    { rows: [{ part_no: "A", inv: { lgemm: false } }] },
    { rows: [{ part_no: "A" }, { part_no: "A" }] },
  ])("rechaza respuestas inválidas %j", (patch) => {
    expect(() => decodePivot({ ...response(), ...patch })).toThrow();
  });
  it("detecta metadatos que pertenecen a otra página o consulta", () => {
    const expected = {
      filters: { date_from: from, date_to: to, part: "", only_shortage: "" },
      page: 1,
      size: 200,
    };
    expect(decodePivot(response(), expected).rows).toHaveLength(1);
    expect(() => decodePivot({ ...response(), page: 2 }, expected)).toThrow(
      "cambió",
    );
    expect(() =>
      decodePivot({ ...response(), date_to: "2026-11-09" }, expected),
    ).toThrow("cambió");
  });
  it("comprueba el tipo de orden y sus cantidades, admitiendo campos históricos opcionales", () => {
    expect(
      decodeOrders("wo", [
        { codigo_wo: "WO/A-01", cantidad_planeada: "0", codigo_po: null },
      ]),
    ).toHaveLength(1);
    expect(() => decodeOrders("wo", [{ codigo_po: "PO-A" }])).toThrow(
      "orden inválida",
    );
    expect(() =>
      decodeOrders("po", [{ codigo_po: "PO-A", cantidad_entregada: {} }]),
    ).toThrow();
  });
  it("comprueba los IDs de lotes y los ítems de las propuestas", () => {
    expect(() =>
      decodeProjectedPlan({ lotes: [{ id: "1" }], lineas: [] }),
    ).toThrow();
    expect(() =>
      decodeScheduleProposal({ proposal_id: "P", version: 1, proposals: [{}] }),
    ).toThrow();
    const item = {
      item_id: "I",
      part_no: "A",
      sched_date: from,
      linea: "M1",
      turno: "DIA",
      qty: 0,
    };
    expect(
      decodeScheduleProposal({
        proposal_id: "P",
        version: 1,
        proposals: [item],
      }).proposals[0],
    ).toEqual(item);
    expect(() =>
      decodeScheduleProposal({
        proposal_id: "P",
        version: 1,
        proposals: [item, item],
      }),
    ).toThrow("repetidos");
  });
  it("comprueba capturas dinámicas antes de enviarlas al adaptador", () => {
    expect(() =>
      actionPayloads["update-wo"]({ codigo_wo: "WO-A", modelo: "A" }),
    ).toThrow("cantidad_planeada");
    expect(() =>
      actionPayloads["import-wos"]({ wo_ids: ["1"], import_date: from }),
    ).toThrow("selección");
    expect(
      actionPayloads["inventory-field"]({
        part_no: "0001-A",
        field: "dif",
        value: "0",
      }),
    ).toMatchObject({ value: 0 });
    expect(
      actionPayloads.schedule({
        part_no: "0001-A",
        sched_date: from,
        sched_qty: null,
        linea: "",
        turno: "DIA",
      }),
    ).toMatchObject({ sched_qty: null });
  });
  it("exige los campos del payload al compilar cada operación", () => {
    const examples = (api: PlanningApi) => {
      // @ts-expect-error inventory writes require a numeric value
      void api.action("inventory-field", { part_no: "A", field: "dif" });
      // @ts-expect-error WO creation requires an operating date
      void api.action("create-wo", { modelo: "A", cantidad_planeada: 1 });
      void api.action("schedule", {
        part_no: "A",
        sched_date: from,
        // @ts-expect-error schedule removal uses null, not a text quantity
        sched_qty: "",
        linea: "",
        turno: "DIA",
      });
    };
    expect(examples).toBeTypeOf("function");
  });
});
