import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "@/core/http";
import { createReworkApi } from "./api";
import { demoReworkApi } from "./demo";
import {
  emptyDraft,
  filterParams,
  plannedAreas,
  requestPayload,
  validateRequest,
} from "./model";
afterEach(() => vi.restoreAllMocks());
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const filters = {
  desde: "2026-11-01",
  hasta: "2026-11-09",
  codigo: "",
  estado: "",
};
describe("Contratos de solicitud de retrabajo", () => {
  it("conserva búsquedas por QR/caja con su caso y omite fechas; Excel usa los mismos filtros generales", async () => {
    const example = await demoReworkApi.detail(1);
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({ success: true, records: [example] }),
    );
    vi.stubGlobal("fetch", fetcher);
    const api = createReworkApi("live"),
      signal = new AbortController().signal,
      applied = { ...filters, codigo: " smd-Old/1-A &+ ", estado: "PENDIENTE" };
    await api.list(applied, signal);
    const url = new URL(fetcher.mock.calls[0][0], "http://local");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      codigo: "smd-Old/1-A &+",
      estado: "PENDIENTE",
    });
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      signal,
      credentials: "same-origin",
    });
    const download = vi.spyOn(http, "downloadFile").mockResolvedValue();
    await api.export(applied);
    expect(download.mock.calls[0][0]).toBe(
      `/api/retrabajo/export?${filterParams(applied)}`,
    );
    expect(
      filterParams({ ...applied, desde: "inválida", hasta: "" }).has("desde"),
    ).toBe(false);
  });
  it("envía el alta con clave idempotente y la cancelación sin inventar operaciones de escaneo", async () => {
    const record = await demoReworkApi.detail(510),
      fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
        json({
          success: true,
          record,
          avisos: ["FPA 01: servicio no disponible"],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const draft = {
      ...emptyDraft(),
      np_origen: "ebr11111111",
      np_destino: "EBR22222222",
      cantidades: { EMBARQUES: "3", SMD: "2", PRODUCCION: "0" },
    };
    const payload = requestPayload(draft),
      api = createReworkApi("live");
    await api.create(payload, "key-fija");
    expect(fetcher.mock.calls[0][0]).toBe("/backend/api/retrabajo");
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("Idempotency-Key"),
    ).toBe("key-fija");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(payload);
    const cancelled = await api.cancel(510);
    expect(fetcher.mock.calls[1]).toEqual([
      "/backend/api/retrabajo/510/cancelar",
      expect.objectContaining({ method: "POST" }),
    ]);
    expect(cancelled.avisos).toEqual(["FPA 01: servicio no disponible"]);
    await expect(api.create(payload, "")).rejects.toThrow("clave");
    await expect(api.detail(-1)).rejects.toThrow("inválida");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("obtiene modelos y programación del NP destino con aborto y valida respuestas incompletas", async () => {
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
      json(
        url.includes("raw/modelos")
          ? { data: ["EBR11111111"] }
          : {
              records: [
                {
                  ic_location: "IC1",
                  micom_part_no: "SAA30091701",
                  programming_label: "SAA30091 701(52DE)",
                },
              ],
            },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const api = createReworkApi("live"),
      signal = new AbortController().signal;
    expect(await api.models(signal)).toEqual(["EBR11111111"]);
    expect(
      (await api.programming(" ebr22222222 ", signal))[0].programming_label,
    ).toBe("SAA30091 701(52DE)");
    expect(fetcher.mock.calls[1][0]).toBe(
      "/backend/api/retrabajo/programacion?part_no=EBR22222222",
    );
    expect(fetcher.mock.calls[1][1]?.signal).toBe(signal);
    fetcher.mockResolvedValueOnce(json({ records: [{}] }));
    await expect(api.list(filters)).rejects.toThrow();
    fetcher.mockResolvedValueOnce(json({ record: { id: 1 } }));
    await expect(api.detail(1)).rejects.toThrow();
  });
  it("conserva total, componentes y áreas; no convierte decimales/negativos a cantidades válidas", () => {
    const draft = {
      ...emptyDraft(),
      np_origen: " EBR11111111 ",
      np_destino: "EBR22222222",
      cantidades: { EMBARQUES: "3", SMD: "2", PRODUCCION: "0" },
      programmingEnabled: true,
      programmingPart: "EBR22222222",
      programaciones: [
        { ic_location: "IC1", programming_label: "SAA30091 701(52DE)" },
      ],
      componentes: [
        {
          key: "ui",
          tipo: "IMD" as const,
          ubicacion: " c12 ",
          np_anterior: "A/1-B",
          np_nuevo: "A/2-C",
        },
      ],
    };
    expect(validateRequest(draft, true)).toEqual([]);
    const payload = requestPayload(draft);
    expect(payload.origenes).toEqual([
      { origen: "EMBARQUES", cantidad: 3 },
      { origen: "SMD", cantidad: 2 },
    ]);
    expect(payload.componentes).toEqual([
      {
        tipo: "IMD",
        ubicacion: "C12",
        np_anterior: "A/1-B",
        np_nuevo: "A/2-C",
      },
    ]);
    expect(plannedAreas(payload)).toHaveLength(5);
    for (const raw of ["-1", "1.5", "1000", "x"])
      expect(
        validateRequest(
          {
            ...draft,
            cantidades: { EMBARQUES: raw, SMD: "0", PRODUCCION: "0" },
          },
          true,
        ).length,
      ).toBeGreaterThan(0);
    expect(
      validateRequest(
        {
          ...draft,
          cantidades: { EMBARQUES: "999", SMD: "1", PRODUCCION: "0" },
        },
        true,
      ),
    ).toContain("La cantidad total debe estar entre 1 y 999.");
    expect(
      validateRequest({ ...draft, programmingPart: "OTRO" }, true).join(),
    ).toContain("vigente");
    expect(
      validateRequest(
        {
          ...draft,
          np_destino: "EBR11111111",
          programmingEnabled: false,
          componentes: [],
        },
        true,
      ).join(),
    ).toContain("cambio de NP");
  });
  it("busca el historial antiguo por QR/caja, reutiliza la clave y conserva trazabilidad al cancelar", async () => {
    expect(
      (await demoReworkApi.list({ ...filters, codigo: "smd-Old/1-A" }))[0].id,
    ).toBe(1);
    expect(
      (await demoReworkApi.list({ ...filters, codigo: "CAJA-RT-1" }))[0]
        .created_at,
    ).toContain("2025");
    const draft = {
      ...emptyDraft(),
      np_origen: "EBR11111111",
      np_destino: "EBR22222222",
      cantidades: { EMBARQUES: "0", SMD: "1", PRODUCCION: "0" },
    };
    const payload = {
      ...requestPayload(draft),
      programaciones: [
        { ic_location: "IC1", programming_label: "SAA30091 702(53DE)" },
      ],
    };
    const created = await demoReworkApi.create(payload, "contract-idempotency");
    expect(created.programaciones[0].micom_part_no).toBe("SAA30091702");
    expect(
      (await demoReworkApi.create(payload, "contract-idempotency")).id,
    ).toBe(created.id);
    const old = await demoReworkApi.detail(1),
      cancelled = await demoReworkApi.cancel(1);
    expect(cancelled.record.escaneos).toEqual(old.escaneos);
    expect(cancelled.record.salidas_embarques).toEqual(old.salidas_embarques);
    expect(cancelled.record.estado).toBe("CANCELADA");
    await expect(demoReworkApi.cancel(1)).rejects.toThrow("cancelada");
  });
});
