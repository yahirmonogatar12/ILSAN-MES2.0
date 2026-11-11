import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMaterialsApi } from "./api";
import {
  EMPTY_MATERIAL,
  csvCell,
  materialToPayload,
  validateMaterial,
} from "./model";
import type { MaterialPayload } from "./types";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());
const draft = (): MaterialPayload => ({
  ...EMPTY_MATERIAL,
  numero_parte: "QA/74-11",
  especificacion_material: "Material de prueba",
  vendedores: [{ vendedor: "Vendedor QA", costo: "0.1250", moneda: "USD" }],
});

describe("validación compatible con Control de material", () => {
  it("acepta cero y cuatro decimales sin perder guiones ni barras del código", () => {
    const value = draft();
    value.vendedores[0].costo = "0.0000";
    expect(validateMaterial(value)).toEqual([]);
  });
  it.each(["-1", "100000000", "1.23456", "NaN", "Infinity"])(
    "rechaza el costo inválido %s",
    (cost) => {
      const value = draft();
      value.vendedores[0].costo = cost;
      expect(validateMaterial(value).length).toBeGreaterThan(0);
    },
  );
  it("detecta duplicados sin distinguir mayúsculas y la lista mayor a 100 caracteres", () => {
    const value = draft();
    value.vendedores.push(
      { vendedor: "VENDEDOR QA", costo: "1", moneda: "USD" },
      { vendedor: "X".repeat(90), costo: "1", moneda: "USD" },
    );
    expect(validateMaterial(value).join(" ")).toContain("duplicado");
    expect(validateMaterial(value).join(" ")).toContain("100 caracteres");
  });
  it("no pierde un costo capturado sin nombre de vendedor", () => {
    const value = draft();
    value.vendedores[0].vendedor = "";
    expect(validateMaterial(value)).toContain(
      "Escribe el vendedor del costo capturado.",
    );
  });
  it("neutraliza fórmulas en el CSV de demostración", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("PCB/74-11")).toBe('"PCB/74-11"');
  });
});

describe("demostración independiente del servidor real", () => {
  it("permite alta, edición, historial, filtros y baja sin ninguna solicitud HTTP", async () => {
    const fetcher = vi.fn(() => {
      throw new Error("La demostración no debe usar la red");
    });
    vi.stubGlobal("fetch", fetcher);
    const api = createMaterialsApi("demo");
    const created = await api.save(draft(), false);
    expect(created.numero_parte).toBe("QA/74-11");
    await expect(api.save(draft(), false)).rejects.toThrow("Ya existe");
    const edit = materialToPayload(await api.detail(created.numero_parte));
    edit.vendedores[0].costo = "0.2500";
    await api.save(edit, true);
    expect((await api.history(created.numero_parte, ""))[0].costo).toBe(
      "0.2500",
    );
    expect(await api.history(created.numero_parte, "")).toHaveLength(2);
    await api.save(edit, true);
    expect(await api.history(created.numero_parte, "")).toHaveLength(2);
    expect(
      (await api.list({ q: "QA/74", clasificacion: "" })).records,
    ).toHaveLength(1);
    expect((await api.detail(created.numero_parte)).fecha_registro).toBe(
      created.fecha_registro,
    );
    await api.remove(created.numero_parte);
    expect(
      (await api.list({ q: "QA/74", clasificacion: "" })).records,
    ).toHaveLength(0);
    expect(await api.history(created.numero_parte, "")).toHaveLength(2);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
