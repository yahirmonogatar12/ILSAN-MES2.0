import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import { createPlanningApi } from "./api";
import { orderDefaults, pivotParams, proposalCapacity, week } from "./model";
import type { Action, PivotFilters } from "./types";
afterEach(() => vi.restoreAllMocks());
const filters: PivotFilters = {
  date_from: "2026-11-02",
  date_to: "2026-11-08",
  part: "0001-A & B",
  only_shortage: "1",
};
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function mockPivot(total = 1101) {
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
    const p = new URL(url, "http://local").searchParams,
      page = Number(p.get("page")),
      size = Math.min(200, Number(p.get("page_size")));
    const offset = (page - 1) * size;
    return json({
      success: true,
      dates: [filters.date_from],
      rows: Array.from(
        { length: Math.min(size, Math.max(0, total - offset)) },
        (_, i) => ({
          part_no: `PART-${String(offset + i + 1).padStart(4, "0")}-A`,
          qty: { [filters.date_from]: 0 },
          sched: {},
          proj: {},
          total: 0,
        }),
      ),
      total_parts: total,
      page,
      page_size: size,
      date_from: filters.date_from,
      date_to: filters.date_to,
    });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
describe("contratos del plan de producción", () => {
  it("muestra 500 partes por página sobre la API de 200 sin pérdidas, duplicados ni filtros omitidos", async () => {
    const fetcher = mockPivot(),
      api = createPlanningApi("live"),
      signal = new AbortController().signal;
    const a = await api.pivot(filters, 1, 500, signal),
      b = await api.pivot(filters, 2, 500, signal),
      c = await api.pivot(filters, 3, 500, signal);
    expect([a.rows.length, b.rows.length, c.rows.length]).toEqual([
      500, 500, 101,
    ]);
    expect([
      a.rows[0].part_no,
      b.rows[0].part_no,
      c.rows[0].part_no,
      c.rows.at(-1)?.part_no,
    ]).toEqual(["PART-0001-A", "PART-0501-A", "PART-1001-A", "PART-1101-A"]);
    expect(
      new Set([...a.rows, ...b.rows, ...c.rows].map((row) => row.part_no)).size,
    ).toBe(1101);
    expect(fetcher).toHaveBeenCalledTimes(7);
    for (const [url, init] of fetcher.mock.calls) {
      const p = new URL(url, "http://local");
      expect(p.pathname).toBe("/backend/api/part-planning/plan");
      expect(p.searchParams.get("page_size")).toBe("200");
      expect(p.searchParams.get("part")).toBe(filters.part);
      expect(p.searchParams.get("only_shortage")).toBe("1");
      expect(init).toMatchObject({ signal, credentials: "same-origin" });
    }
    expect(a.rows[0].qty).toEqual({ [filters.date_from]: 0 });
  });
  it("no hace consultas extra para páginas pequeñas ni exporta una página equivocada", async () => {
    const fetcher = mockPivot();
    const data = await createPlanningApi("live").pivot(filters, 3, 50);
    expect(data.rows[0].part_no).toBe("PART-0101-A");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rechaza un plan que cambia entre las páginas internas en lugar de perder partes", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const p = new URL(url, "http://local").searchParams;
        return json({
          success: true,
          dates: [filters.date_from],
          rows: [],
          total_parts: ++n === 1 ? 1101 : 1100,
          page: Number(p.get("page")),
          page_size: 200,
          date_from: filters.date_from,
          date_to: filters.date_to,
        });
      }),
    );
    await expect(
      createPlanningApi("live").pivot(filters, 1, 500),
    ).rejects.toThrow("cambió");
  });
  it("valida el rango antes de leer y conserva el catálogo de modelos textual", async () => {
    const fetcher = vi.fn(async () =>
      json({ success: true, data: ["0001-A", "EBR23966228-01-A"] }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(() => pivotParams({ ...filters, date_from: "2026-11-09" })).toThrow(
      "posterior",
    );
    expect(() => pivotParams({ ...filters, date_from: "2026-01-01" })).toThrow(
      "120",
    );
    expect(await createPlanningApi("live").models()).toEqual([
      "0001-A",
      "EBR23966228-01-A",
    ]);
  });
  it.each([
    ["create-po", "/api/po/crear", "POST"],
    ["create-wo", "/api/work_orders", "POST"],
    ["update-wo", "/api/wo/actualizar", "POST"],
    ["delete-wo", "/api/wo/eliminar", "DELETE"],
    ["state-wo", "/api/wo/WO-261106-0001/estado", "PUT"],
    ["import-wos", "/api/work_orders/import", "POST"],
    ["schedule", "/api/part-planning/schedule", "POST"],
    ["inventory-field", "/api/part-planning/inventory/field", "POST"],
    ["apply-proposal", "/api/part-planning/schedule/proponer/aplicar", "POST"],
    [
      "reject-proposal",
      "/api/part-planning/schedule/proponer/rechazar",
      "POST",
    ],
    ["confirm-lots", "/api/plan-proyectado/confirm", "POST"],
    ["update-lot", "/api/plan-proyectado/update", "POST"],
    ["delete-lot", "/api/plan-proyectado/delete", "POST"],
  ] as const)(
    "envía %s al contrato original con su método y payload",
    async (op, path, method) => {
      const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
        json({ success: true }),
      );
      vi.stubGlobal("fetch", fetcher);
      const payload = {
        codigo_wo: "WO-261106-0001",
        part_no: "0001-A",
        proposal_id: "PROP/A+B",
        version: 7,
        items: [{ item_id: "item-1", included: false, qty: 0 }],
      };
      await createPlanningApi("live").action(op as Action, payload);
      expect(fetcher.mock.calls[0][0]).toBe(`/backend${path}`);
      expect(fetcher.mock.calls[0][1]?.method).toBe(method);
      expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(
        payload,
      );
    },
  );
  it("mantiene archivo, hash, año, ceros y modo al confirmar el Plan LG", async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({ success: true, file_sha256: "hash-original", summary: {} }),
    );
    vi.stubGlobal("fetch", fetcher);
    const api = createPlanningApi("live"),
      file = new File(["fixture"], "Plan LG.xlsx"),
      upload = {
        file,
        plan_year: "2027",
        import_mode: "only_new",
        include_zero: "0",
      };
    const preview = await api.upload("preview-lg", upload);
    await api.upload("confirm-lg", {
      ...upload,
      file_sha256: String(preview.file_sha256),
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/backend/api/part-planning/import/preview",
      "/backend/api/part-planning/import/confirm",
    ]);
    const data = fetcher.mock.calls[1][1]?.body as FormData;
    expect(data.get("file")).toBe(file);
    expect(
      Object.fromEntries([...data].filter(([key]) => key !== "file")),
    ).toEqual({
      plan_year: "2027",
      import_mode: "only_new",
      include_zero: "0",
      file_sha256: "hash-original",
    });
    expect(fetcher.mock.calls[1][1]?.headers).not.toHaveProperty(
      "Content-Type",
    );
  });
  it("conserva fechas y filtros de PO/WO y usa el exportador de WO por período", async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({
        success: true,
        data: [
          { codigo_po: "PO/01-A", cliente: "LG_REFRIS" },
          { codigo_po: "PO/02-A", cliente: "LG_ESTUFAS" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const api = createPlanningApi("live"),
      base = { ...orderDefaults(), cliente: "LG_REFRIS", estado: "PLAN" };
    expect(await api.orders("po", base)).toHaveLength(1);
    fetcher.mockResolvedValueOnce(
      json({ success: true, data: [{ codigo_wo: "WO/01-A" }] }),
    );
    await api.orders("wo", {
      ...base,
      cliente: "",
      estado: "",
      modelo: "0001-A",
    });
    expect(fetcher.mock.calls[1][0]).toContain("incluir_planificadas=true");
    expect(fetcher.mock.calls[1][0]).toContain("modelo=0001-A");
    const exported = vi.spyOn(http, "downloadFile").mockResolvedValue();
    await api.exportWO(base);
    const p = new URL(exported.mock.calls[0][0], "http://local");
    expect(p.pathname).toBe("/api/wo/exportar");
    expect(p.searchParams.has("estado")).toBe(false);
    expect(p.searchParams.get("fecha_desde")).toBe(base.fecha_desde);
  });
  it("la revisión suma cantidades y horas editadas sin replanificar ni incluir filas excluidas", () => {
    const date = "2026-11-06",
      items = [
        { sched_date: date, linea: "M1", turno: "DIA", qty: 500, uph: 1000 },
        { sched_date: date, linea: "M1", turno: "DIA", qty: 1000, uph: 1000 },
        {
          sched_date: date,
          linea: "M2",
          turno: "DIA",
          qty: 9000,
          uph: 1000,
          included: false,
        },
      ];
    expect(
      proposalCapacity(items, [
        { fecha: date, linea: "M1", turno: "DIA", horas_max: 1 },
      ]),
    ).toEqual([
      {
        fecha: date,
        linea: "M1",
        turno: "DIA",
        horas: 1.5,
        horas_max: 1,
        cantidad: 1500,
        lotes: 2,
        excede: true,
      },
    ]);
  });
  it("la demo respeta estados de WO, confirmación/cancelación de lotes y propuestas desactualizadas", async () => {
    const fetcher = vi.fn(() => {
      throw new Error("Sin HTTP en demo");
    });
    vi.stubGlobal("fetch", fetcher);
    const api = createPlanningApi("demo"),
      date = week().date_to;
    await api.action("generate", { fecha: date });
    const before = await api.lots(date),
      lot = before.lotes[0];
    expect(lot.status).toBe("PENDIENTE");
    await api.action("confirm-lots", { fecha: date });
    expect((await api.lots(date)).lotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: lot.id, status: "CONFIRMADO" }),
      ]),
    );
    await expect(
      api.action("update-lot", { id: lot.id, field: "qty_plan", value: 900 }),
    ).rejects.toThrow("confirmado");
    await api.action("update-lot", { id: lot.id, field: "fisico", value: 0 });
    await api.action("delete-lot", { id: lot.id });
    expect((await api.lots(date)).lotes).toHaveLength(0);
    const proposal = await api.action("propose", { ...week() });
    await api.action("inventory-field", {
      part_no: "0001-A",
      field: "dif",
      value: 0,
    });
    await expect(
      api.action("apply-proposal", {
        proposal_id: proposal.proposal_id,
        version: proposal.version,
        items: proposal.proposals.map((item) => ({ ...item, included: true })),
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
