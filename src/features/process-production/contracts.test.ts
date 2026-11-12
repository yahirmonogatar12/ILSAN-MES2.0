import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import { createApi } from "./api";
import { demoApi } from "./demo";
import {
  defaults,
  fieldIssues,
  planFields,
  planPayload,
  reportParams,
} from "./model";
import {
  autoArrange,
  calculateTimeline,
  moveRow,
  orderPayload,
} from "./timeline";
import type { Row } from "./types";
afterEach(() => vi.restoreAllMocks());
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("Fork de Control de producción en Control de proceso", () => {
  it.each([
    ["scan", "/api/plan/input-main/scan-lots", "GET"],
    ["assign-scan", "/api/plan/input-main/assign-lot", "POST"],
    ["create-scan", "/api/plan/input-main/create-plan", "POST"],
    ["wos", "/api/work_orders", "GET"],
    ["import-wos", "/api/work_orders/import", "POST"],
    ["proposals", "/api/plan/propuestas-ia", "GET"],
    ["diff", "/api/plan/propuesta-ia/diff", "POST"],
    ["apply-diff", "/api/plan/propuesta-ia/aplicar-cambios", "POST"],
    ["import-proposal", "/api/plan/importar-propuesta-ia", "POST"],
  ] as const)("respeta el contrato ASSY %s", async (name, path, method) => {
    const value =
      name === "wos" || name === "proposals"
        ? []
        : name === "scan"
          ? { scan_lots: [], plan_options: [] }
          : name === "diff"
            ? { cambios: [], nuevos: [], sobran: [] }
            : { success: true };
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      json(value),
    );
    vi.stubGlobal("fetch", fetcher);
    const payload = {
        proposal_id: "ID/01+A&B",
        date_from: "2026-11-09",
        include_import_status: 1,
        allow_extend: true,
      },
      signal = new AbortController().signal;
    await createApi("live").extra(name, payload, signal);
    const [url, init] = fetcher.mock.calls[0];
    expect(new URL(url, "http://local").pathname).toBe(`/backend${path}`);
    expect(init).toMatchObject({ method, signal });
    if (method === "POST")
      expect(JSON.parse(String(init?.body))).toEqual(payload);
    else
      expect(new URL(url, "http://local").searchParams.get("proposal_id")).toBe(
        "ID/01+A&B",
      );
  });
  it.each([
    ["ASSY", "/api/plan", "pending"],
    ["IMT", "/api/plan-imd", "pending-reschedule"],
    ["SMT", "/api/plan-smt", "pending"],
  ] as const)(
    "consulta %s y sus pendientes con fechas y abortos",
    async (kind, base, pending) => {
      const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
        json([
          {
            lot_no: "LOT/01-A",
            qr_required_count: 0,
            array_size: 0,
            lado: "TOP",
            lote_padre: "LOT/01",
          },
        ]),
      );
      vi.stubGlobal("fetch", fetcher);
      const api = createApi("live"),
        filters = defaults(),
        signal = new AbortController().signal;
      expect((await api.plans(kind, filters, signal))[0]).toMatchObject({
        lot_no: "LOT/01-A",
        qr_required_count: 0,
        array_size: 0,
        lote_padre: "LOT/01",
      });
      await api.pending(kind, filters, signal);
      expect(fetcher.mock.calls[0][0]).toBe(
        `/backend${base}?start=${filters.start}&end=${filters.end}`,
      );
      expect(fetcher.mock.calls[1][0]).toBe(
        `/backend${base}/${pending}?start=${filters.start}&end=${filters.end}`,
      );
      expect(fetcher.mock.calls[1][1]).toMatchObject({
        signal,
        credentials: "same-origin",
      });
    },
  );
  it.each([
    ["ASSY", "status", "/api/plan/status"],
    ["IMT", "status", "/api/plan-imd/update"],
    ["SMT", "status", "/api/plan-smt/update"],
    ["ASSY", "order", "/api/plan/save-sequences"],
    ["SMT", "reschedule", "/api/plan-smt/reschedule"],
  ] as const)(
    "envía %s %s al contrato correcto",
    async (kind, action, path) => {
      const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
        json({ success: true }),
      );
      vi.stubGlobal("fetch", fetcher);
      const payload = {
        lot_no: "L/0-A",
        status: "PAUSADO",
        pause_reason: "Sin material",
        lot_nos: ["L/0-A"],
        new_working_date: "2026-11-10",
      };
      await createApi("live").action(kind, action, payload);
      expect(fetcher.mock.calls[0][0]).toBe(`/backend${path}`);
      expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
      expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(
        payload,
      );
    },
  );
  it("conserva QR/array cero, revisiones y partes completas, y no ofrece campos que el update no guarda", () => {
    const values = {
      lot_no: "SMT-01-T",
      part_no: "EBR/01-A",
      working_date: "2026-11-09",
      line: "SA",
      shift: "DIA",
      plan_count: "0",
      qr_required_count: "0",
      array_size: "0",
      lado: "TOP",
      wo_code: "NO-CAMBIAR",
      po_code: "NO-CAMBIAR",
      unknown: "no",
    };
    const payload = planPayload("SMT", values, true);
    expect(payload).toMatchObject({
      lot_no: "SMT-01-T",
      part_no: "EBR/01-A",
      plan_count: 0,
      qr_required_count: 0,
      array_size: 0,
      lado: "TOP",
    });
    expect(payload).not.toHaveProperty("wo_code");
    expect(payload).not.toHaveProperty("po_code");
    expect(payload).not.toHaveProperty("unknown");
    expect(
      planFields("ASSY", false).some((field) => field.key === "sequence"),
    ).toBe(false);
    expect(
      fieldIssues(planFields("SMT", true), {
        ...values,
        qr_required_count: "21",
      }).join(),
    ).toContain("QR requeridos");
    expect(
      planPayload(
        "ASSY",
        { ...values, assigned_bom_rev: "01", turno: "NOCHE" },
        true,
      ),
    ).toMatchObject({ assigned_bom_rev: "01", turno: "NOCHE" });
  });
  it.each(["IMT", "SMT"] as const)(
    "envía el mismo archivo multipart en la importación %s",
    async (kind) => {
      const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
        json({ success: true, imported: 2 }),
      );
      vi.stubGlobal("fetch", fetcher);
      const file = new File(["xlsx"], "original.xlsx"),
        api = createApi("live");
      await api.upload(kind, file, "2026-11-09");
      expect(fetcher.mock.calls[0][0]).toBe(
        `/backend/api/plan-${kind === "IMT" ? "imd" : "smt"}/import-excel`,
      );
      const body = fetcher.mock.calls[0][1]?.body as FormData;
      expect(body.get("file")).toBe(file);
      expect(body.get("working_date")).toBe("2026-11-09");
      expect(
        new Headers(fetcher.mock.calls[0][1]?.headers).get("Content-Type"),
      ).toBeNull();
      await expect(api.upload("ASSY", file, "2026-11-09")).rejects.toThrow(
        "Work Orders",
      );
    },
  );
  it("mantiene N/A y los filtros remotos de encabezado también en el Excel de operaciones", async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({
        success: true,
        data: [
          {
            lote: "SMT-0-T",
            plan_count: 0,
            input_count: 0,
            output_count: "N/A",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const api = createApi("live"),
      filters = { ...defaults(), proceso: "SMT" },
      searches = { part_no: "0001/01-A & B", input: "0" };
    expect(
      (await api.report("operations", filters, searches)).rows[0],
    ).toMatchObject({ plan: 0, input: 0, output: "N/A" });
    const params = new URL(fetcher.mock.calls[0][0], "http://local")
      .searchParams;
    expect(Object.fromEntries(params)).toMatchObject({
      proceso: "SMT",
      cf_part_no: "0001/01-A & B",
      cf_input: "0",
    });
    const download = vi.spyOn(http, "downloadFile").mockResolvedValue();
    await api.exportReport("operations", filters, searches);
    expect(download.mock.calls[0][0]).toBe(
      `/api/historial-operacion-proceso/export?${params}`,
    );
    expect(
      Object.fromEntries(
        reportParams(
          "outputs",
          { ...filters, part_number: "PART/01-A" },
          searches,
        ),
      ),
    ).toEqual({
      fecha_desde: filters.start,
      fecha_hasta: filters.end,
      part_number: "PART/01-A",
    });
  });
  it("exporta los planes y orden completos por POST mediante el transporte binario compartido", async () => {
    const requestFile = vi
        .spyOn(http, "requestFile")
        .mockResolvedValue({ blob: new Blob(["xlsx"]), name: "plan.xlsx" }),
      download = vi.spyOn(http, "saveDownload").mockImplementation(() => {});
    const plans = [
      {
        lot_no: "L/0",
        group_no: 2,
        qr_required_count: 0,
        array_size: 0,
        planned_start: "2026-11-09 07:30:00",
      },
    ];
    await createApi("live").export("SMT", plans);
    expect(requestFile.mock.calls[0]).toEqual([
      "/api/plan-smt/export-excel",
      "plan_SMT.xlsx",
      undefined,
      false,
      { method: "POST", body: JSON.stringify({ plans }) },
    ]);
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "plan.xlsx");
  });
  it("el lector binario central admite POST y conserva cookies, contenido y nombre del archivo", async () => {
    const fetcher = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response("xlsx", {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="plan-original.xlsx"',
          },
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await http.requestFile(
      "/api/plan/export-excel",
      "fallback.xlsx",
      undefined,
      false,
      { method: "POST", body: '{"plans":[]}' },
    );
    expect(result.name).toBe("plan-original.xlsx");
    expect(await result.blob.text()).toBe("xlsx");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      body: '{"plans":[]}',
    });
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("Content-Type"),
    ).toBe("application/json");
  });
  it("detecta listas inválidas y lotes repetidos antes de permitir acciones", async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      json([{ lot_no: "L1" }, { lot_no: "L1" }]),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(createApi("live").plans("ASSY", defaults())).rejects.toThrow(
      "único",
    );
    fetcher.mockResolvedValueOnce(json({ success: true }));
    await expect(
      createApi("live").extra("scan", {
        date_from: defaults().start,
        date_to: defaults().end,
      }),
    ).rejects.toThrow();
  });
  it("porta el acomodo por líneas, descansos y fechas locales sin perder campos del lote", () => {
    const source: Row[] = [
      {
        lot_no: "L2",
        line: "M2",
        working_date: "2026-11-09",
        plan_count: 2000,
        uph: 1000,
        status: "PLAN",
        qr_required_count: 0,
        sequence: 1,
      },
      {
        lot_no: "L1",
        line: "M1",
        working_date: "2026-11-09",
        plan_count: 4000,
        uph: 1000,
        status: "PLAN",
        sequence: 1,
      },
      {
        lot_no: "LC",
        line: "M1",
        working_date: "2026-11-09",
        plan_count: 1000,
        uph: 1000,
        status: "CANCELADO",
        sequence: 2,
      },
    ];
    const arranged = autoArrange(source, 2);
    expect(arranged.find((row) => row.lot_no === "L1")?.group_no).toBe(1);
    expect(arranged.find((row) => row.lot_no === "L2")?.group_no).toBe(2);
    const timeline = calculateTimeline("ASSY", arranged);
    expect(timeline.find((row) => row.lot_no === "L1")).toMatchObject({
      inicio: "07:30",
      fin: "11:45",
      effective_minutes: 240,
      breaks_minutes: 15,
      planned_start: "2026-11-09 07:30:00",
    });
    expect(timeline.find((row) => row.lot_no === "LC")).toMatchObject({
      inicio: "—",
      effective_minutes: 0,
    });
    expect(
      orderPayload("ASSY", timeline).sequences.find(
        (row) => row.lot_no === "L1",
      )?.planned_start,
    ).toBe("2026-11-09 07:30:00");
    expect(() => moveRow("SMT", source, "L2", "L1")).toThrow("línea");
    expect(calculateTimeline("SMT", [source[0]])[0].qr_required_count).toBe(0);
    const overnight = calculateTimeline("ASSY", [
      { ...source[0], plan_count: 24000 },
    ])[0];
    expect(String(overnight.planned_end)).toMatch(/^2026-11-10 /);
  });
  it("la demo conserva la pareja BOTTOM/TOP, QR cero y sublotes al reprogramar", async () => {
    const result = await demoApi.action("SMT", "create", {
      working_date: defaults().end,
      line: "SA",
      part_no: "0001/01-A",
      plan_count: 1000,
      array_size: 0,
      qr_required_count: 0,
      lado: "BOTTOM",
    });
    const plans = await demoApi.plans("SMT", defaults());
    expect(plans.find((row) => row.lot_no === result.lot_top)).toMatchObject({
      lote_padre: result.lot_no,
      lado: "TOP",
      array_size: 0,
      qr_required_count: 0,
    });
    await demoApi.action("SMT", "reschedule", {
      lot_nos: [String(result.lot_top)],
      new_working_date: defaults().end,
    });
    expect(
      (await demoApi.plans("SMT", defaults())).some((row) =>
        String(row.lot_no).startsWith(`${result.lot_top}-`),
      ),
    ).toBe(true);
  });
});
