import { describe, expect, it } from "vitest";
import { decodePlans, extraDecoders } from "./contracts";
import { assyPayloads } from "./requests";
import type { Api } from "./types";
import { orderPayload } from "./timeline";

describe("contratos tipados de Control de proceso", () => {
  it("conserva la ausencia de tiempos en payloads parciales de secuencias", () => {
    expect(
      JSON.parse(
        JSON.stringify(orderPayload("ASSY", [{ lot_no: "A", sequence: 2 }])),
      ),
    ).toEqual({ sequences: [{ lot_no: "A", group_no: 1, sequence: 2 }] });
  });
  it("admite planes históricos parciales sin perder trazabilidad ni cantidades cero", () => {
    const value = {
      lot_no: "LOT/001-T",
      part_no: null,
      plan_count: "0",
      array_size: 0,
      qr_required_count: 0,
      unknown_audit: { version: 1 },
    };
    expect(decodePlans([value])).toEqual([value]);
  });
  it.each(
    [
      [{ lot_no: "" }],
      [{ lot_no: 1 }],
      [{ lot_no: "A", plan_count: {} }],
      [{ lot_no: "A", line: false }],
      [{ lot_no: "A" }, { lot_no: "A" }],
    ].map((value) => ({ value })),
  )("rechaza planes con campos inválidos %j", ({ value }) =>
    expect(() => decodePlans(value)).toThrow(),
  );
  it("comprueba las distintas respuestas de herramientas ASSY", () => {
    expect(() => extraDecoders.wos([{ id: "1" }])).toThrow("WO inválida");
    expect(() =>
      extraDecoders.scan({ scan_lots: [{ linea: "M1" }], plan_options: [] }),
    ).toThrow("SCAN inválido");
    expect(() => extraDecoders.proposals([{ proposal_id: {} }])).toThrow(
      "propuesta inválida",
    );
    expect(() =>
      extraDecoders.diff({
        cambios: [{ lot_no: "A", antes: [], despues: {} }],
        nuevos: [],
        sobran: [],
      }),
    ).toThrow("cambio inválido");
    expect(
      extraDecoders.diff({ cambios: [], nuevos: [], sobran: [] }),
    ).toMatchObject({ cambios: [] });
  });
  it("exige una extensión explícita y conserva los IDs originales al importar WO", () => {
    expect(
      assyPayloads["assign-scan"]({
        linea: "M1",
        nparte: "0001/A",
        target_lot_no: "L",
        allow_extend: "true",
      }).allow_extend,
    ).toBe(false);
    expect(
      assyPayloads["import-wos"]({ wo_ids: [7, 9], import_date: "2026-11-12" })
        .wo_ids,
    ).toEqual([7, 9]);
    expect(() =>
      assyPayloads["apply-diff"]({
        proposal_id: "P",
        cambios: [{ cantidad: 3 }],
      }),
    ).toThrow("lot_no");
  });
  it("vincula el tipo del payload y de la respuesta a la operación", () => {
    const examples = (api: Api) => {
      // @ts-expect-error order writes require sequences
      void api.action("ASSY", "order", { lot_no: "A" });
      // @ts-expect-error rescheduling requires the target date
      void api.action("SMT", "reschedule", { lot_nos: ["A"] });
      // @ts-expect-error assigning SCAN requires explicit extension intent
      void api.extra("assign-scan", {
        linea: "M1",
        nparte: "A",
        target_lot_no: "L",
      });
      void api
        .extra("scan", { date_from: "2026-11-12", date_to: "2026-11-12" })
        .then((result) => {
          const plans: string[] = result.plan_options.map(
            (plan) => plan.lot_no,
          );
          return plans;
        });
    };
    expect(examples).toBeTypeOf("function");
  });
});
