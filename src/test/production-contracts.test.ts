import { describe, expect, it, vi } from "vitest";
import { createCatalogApi } from "@/features/model-catalog/api";
import { smtPayload } from "@/features/model-catalog/model";
import { createFpaApi } from "@/features/fpa/api";
import { validateRequest } from "@/features/fpa/model";
import { createBomApi } from "@/features/bom/api";
import { allowedAction, validateEco } from "@/features/bom/model";
import type { EcoDraft, EcoRow } from "@/features/bom/types";
import { request } from "@/core/http";

function mockJson(value: unknown, status = 200) {
  const fetcher = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const draft: EcoDraft = {
  kind: "SINGLE",
  eco_no: "ECO-QA-1",
  part_no: "EBR80757401",
  family: "EBR807574",
  suffixes: "01,02",
  effective_at: "2026-11-04T08:00",
  item_name: "Modelo QA",
  notes: "Conservar datos",
};
const eco: EcoRow = {
  id: 12,
  eco_no: "ECO-QA-1",
  part_no: "EBR80757401",
  bom_revision: "002",
  effective_at: draft.effective_at,
  status: "DRAFT",
  origen: "MES",
};

describe("contratos de los cuatro módulos migrados", () => {
  it.each([
    { page: 2, total: 1200, first: 501, last: 1000, calls: [3, 4, 5] },
    { page: 3, total: 1050, first: 1001, last: 1050, calls: [6] },
  ])(
    "FPA compone la página $page de 500 sobre páginas físicas de 200",
    async ({ page, total, first, last, calls }) => {
      const signal = new AbortController().signal;
      const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
        const params = new URL(url, "http://localhost").searchParams;
        const physicalPage = Number(params.get("page"));
        const size = Number(params.get("pageSize"));
        const start = (physicalPage - 1) * size;
        return new Response(
          JSON.stringify({
            data: Array.from(
              { length: Math.max(0, Math.min(size, total - start)) },
              (_, index) => ({ id: start + index + 1 }),
            ),
            meta: { total, page: physicalPage, pageSize: size },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      });
      vi.stubGlobal("fetch", fetcher);
      const result = await createFpaApi("live").list(
        {
          folio: "QA",
          fpaPartNumber: "",
          requester: "",
          status: "",
          dateFrom: "",
          dateTo: "",
        },
        page,
        500,
        signal,
      );
      expect(result.data.map((row) => row.id)).toEqual(
        Array.from({ length: last - first + 1 }, (_, index) => first + index),
      );
      expect(result.meta).toMatchObject({ total, page, pageSize: 500 });
      expect(
        fetcher.mock.calls.map(([url]) =>
          Number(new URL(url, "http://localhost").searchParams.get("page")),
        ),
      ).toEqual(calls);
      for (const [url, init] of fetcher.mock.calls) {
        expect(
          new URL(url, "http://localhost").searchParams.get("pageSize"),
        ).toBe("200");
        expect(new URL(url, "http://localhost").searchParams.get("folio")).toBe(
          "QA",
        );
        expect(init?.signal).toBe(signal);
      }
    },
  );
  it("SMT conserva originales, nulls, ceros, auditoría y hash al editar", async () => {
    const original = {
      __rowhash: "abc/123",
      part_no: "EBR-A",
      uph: 0,
      linea: null,
      usuario: "Operador previo",
      fecha_registro: "2026-01-01",
    };
    const columns = ["part_no", "uph", "linea", "usuario", "fecha_registro"];
    const payload = smtPayload(
      { part_no: "EBR-A", uph: "10", linea: "" },
      original,
      columns,
      "QA",
    );
    expect(payload).toEqual({
      original: {
        part_no: "EBR-A",
        uph: 0,
        linea: null,
        usuario: "Operador previo",
        fecha_registro: "2026-01-01",
      },
      changes: { uph: "10" },
    });
    const fetcher = mockJson({ ok: true });
    await createCatalogApi("smt", "live").save(
      { part_no: "EBR-A", uph: "10", linea: "" },
      original,
      columns,
      "QA",
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      "/backend/control-modelos/api/rows/abc%2F123",
    );
    expect(fetcher.mock.calls[0][1]?.method).toBe("PUT");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(payload);
    await createCatalogApi("smt", "live").remove(original);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      original: {
        part_no: "EBR-A",
        uph: 0,
        linea: null,
        usuario: "Operador previo",
        fecha_registro: "2026-01-01",
      },
    });
  });
  it("Modelos consulta raw con búsqueda del servidor y límite explícito", async () => {
    const fetcher = mockJson({
      columns: ["id", "part_no"],
      rows: [],
      total: 0,
    });
    const signal = new AbortController().signal;
    await createCatalogApi("models", "live").list("EBR/1 + &", signal);
    const url = new URL(fetcher.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/backend/api/mysql/data");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      table: "raw",
      limit: "2000",
      offset: "0",
      search: "EBR/1 + &",
    });
    expect(fetcher.mock.calls[0][1]?.signal).toBe(signal);
  });
  it("Modelos usa los sobres originales, conserva identificación y no envía auditoría editable", async () => {
    const fetcher = mockJson({ success: true, partes: 2 });
    const api = createCatalogApi("models", "live");
    const original = {
      ID: 7,
      part_no: "A",
      model: "Anterior",
      uph: 100,
      Usuario: "Anterior",
    };
    await api.save(
      { part_no: "A", model: "Nuevo", uph: "1,200", Usuario: "Manipulado" },
      original,
      ["ID", "part_no", "model", "uph", "Usuario"],
      "QA",
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      original,
      new: { part_no: "A", model: "Nuevo", uph: "1200" },
    });
    await api.remove(original);
    expect(fetcher.mock.calls[1][0]).toBe("/backend/api/mysql/delete");
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      table: "raw",
      id: 7,
    });
    await api.familyLines("EBR807574", "ASSY-A,ASSY-B");
    expect(fetcher.mock.calls[2][0]).toBe("/backend/api/mysql/familia-lineas");
  });
  it("un ok:false o errores de validación no se interpreta como un guardado exitoso", async () => {
    mockJson({ ok: false, error: "Rowhash no coincide" });
    await expect(
      request("/control-modelos/api/rows", { method: "POST" }),
    ).rejects.toThrow("Rowhash no coincide");
    mockJson(
      { success: false, errors: ["Falta item_no", "Cantidad inválida"] },
      400,
    );
    await expect(
      createBomApi("live").importEco(draft, [], new File(["x"], "bom.xlsx")),
    ).rejects.toThrow("Falta item_no\nCantidad inválida");
  });
  it("FPA pagina en servidor y envía el contrato MICOM, clave de idempotencia y motivos", async () => {
    let fetcher = mockJson({ data: [], meta: { total: 0 } });
    const api = createFpaApi("live");
    await api.list(
      {
        folio: "FPA/1",
        fpaPartNumber: "EBR 1",
        requester: "QA",
        status: "PARCIAL",
        dateFrom: "2026-11-01",
        dateTo: "2026-11-04",
      },
      2,
      50,
    );
    const url = new URL(fetcher.mock.calls[0][0], "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      page: "2",
      pageSize: "50",
      fpaPartNumber: "EBR 1",
      dateFrom: "2026-11-01",
      dateTo: "2026-11-04",
    });
    fetcher = mockJson({ data: { id: 9 } });
    const payload = {
      fpaPartNumber: "EBR/1",
      pgmMicom: "PGM1 LOTE1",
      micomQuantity: 20,
      pgmComp: "",
      compQuantity: 0,
    };
    await api.create(payload, "clave-inmutable-qa");
    expect(fetcher.mock.calls[0][0]).toBe("/backend/api/control-fpa/requests");
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      "Idempotency-Key": "clave-inmutable-qa",
    });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(payload);
    await api.adjust(9, { reason: "Prueba de ajuste", micomQuantity: 18 });
    expect(fetcher.mock.calls[1][0]).toBe(
      "/backend/api/control-fpa/requests/9/quantities",
    );
    expect(fetcher.mock.calls[1][1]?.method).toBe("PATCH");
  });
  it("FPA respeta cantidades enteras, parte requerida y límites del código PGM real", () => {
    expect(
      validateRequest({
        fpaPartNumber: "EBR1",
        pgmMicom: "PGM1 LOTE1",
        micomQuantity: "8",
        pgmComp: "",
        compQuantity: "0",
      }),
    ).toEqual([]);
    const errors = validateRequest({
      fpaPartNumber: "",
      pgmMicom: "sin-separador",
      micomQuantity: "1.5",
      pgmComp: "",
      compQuantity: "1000",
    });
    expect(errors.join(" ")).toMatch(/número de parte/);
    expect(errors.join(" ")).toMatch(/entero entre 0 y 999/);
    expect(errors.join(" ")).toMatch(/separados por un espacio/);
  });
  it("BOM consulta revisión/classification sin alterar los nombres originales", async () => {
    const api = createBomApi("live");
    let fetcher = mockJson([{ modelo: "EBR80757401" }]);
    expect(await api.models()).toEqual(["EBR80757401"]);
    fetcher = mockJson([]);
    await api.list({
      modelo: "EBR80757401",
      classification: "SMD",
      bom_revision: "001",
    });
    expect(fetcher.mock.calls[0][0]).toBe("/backend/listar_bom");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      modelo: "EBR80757401",
      classification: "SMD",
      bom_revision: "001",
    });
  });
  it.each(["SINGLE", "FAMILY", "NEW_BOM"] as const)(
    "BOM envía Excel multipart con el alcance %s, dejando al navegador el boundary",
    async (kind) => {
      const fetcher = mockJson({ success: true, eco_id: 1 });
      const file = new File(["contenido"], "bom.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      await createBomApi("live").importEco(
        { ...draft, kind },
        ["EBR80757401", "EBR80757402"],
        file,
      );
      const [url, init] = fetcher.mock.calls[0];
      expect(url).toBe(
        `/backend/api/ecos/${kind === "FAMILY" ? "from-excel-family" : "from-excel"}`,
      );
      expect(init?.headers).not.toHaveProperty("Content-Type");
      const body = init?.body as FormData;
      expect(body.get("eco_no")).toBe(draft.eco_no);
      expect((body.get("file") as File).name).toBe("bom.xlsx");
      if (kind === "FAMILY") {
        expect(body.get("scope_parts")).toBe("EBR80757401,EBR80757402");
        expect(body.get("family_prefix")).toBe("EBR807574");
        expect(body.has("part_no")).toBe(false);
      } else {
        expect(body.get("part_no")).toBe("EBR80757401");
        expect(body.get("bom_mode")).toBe(
          kind === "NEW_BOM" ? "NEW_BOM" : null,
        );
      }
    },
  );
  it("BOM separa ECN KS de ECO MES y conserva los permisos de publicación e inmutabilidad", async () => {
    const fetcher = mockJson({ data: {} });
    const api = createBomApi("live");
    await api.detail({ ...eco, id: "ks-34", origen: "KS" });
    expect(fetcher.mock.calls[0][0]).toBe("/backend/api/ecn-ks/34");
    expect(allowedAction(eco, "approve", false, false)).toBe(false);
    expect(allowedAction(eco, "approve", false, true)).toBe(true);
    expect(
      allowedAction({ ...eco, status: "APPROVED" }, "delete", true, true),
    ).toBe(false);
    expect(allowedAction({ ...eco, origen: "KS" }, "cancel", true, true)).toBe(
      false,
    );
    expect(
      validateEco(
        { ...draft, kind: "FAMILY" },
        [],
        new File(["x"], "bom.xlsx"),
      ),
    ).toContain("Resuelve la familia y sus sufijos antes de importar.");
  });
});
