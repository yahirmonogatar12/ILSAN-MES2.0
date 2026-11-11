import { createAuthGateway } from "@/core/auth/api";
import { MATERIAL_PERMISSION } from "./config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMaterialsApi } from "./api";
import { backendFetch, request } from "@/core/http";
import type { MaterialPayload } from "./types";

const payload: MaterialPayload = {
  numero_parte: "  PCB/7421-11  ",
  especificacion_material: " PCB de control ",
  propiedad_material: "Cliente",
  clasificacion: "PCB",
  unidad_empaque: "Panel",
  unidad_medida: "EA",
  vendedores: [{ vendedor: " Proveedor A ", costo: "0.1250", moneda: "USD" }],
};

beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());
function mockJson(value: unknown, status = 200) {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

describe("contrato con el backend Flask existente", () => {
  it("envía el login como formulario y conserva cookies de sesión", async () => {
    const fetcher = mockJson({ success: true });
    await createAuthGateway("live").login("operador 1", "contraseña&segura");
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/backend/login");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(init.body.get("username")).toBe("operador 1");
    expect(init.body.get("password")).toBe("contraseña&segura");
  });

  it("consulta exactamente el permiso del módulo original", async () => {
    const fetcher = mockJson({ tiene_permiso: false });
    expect(
      await createAuthGateway("live").permission(MATERIAL_PERMISSION),
    ).toBe(false);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      pagina: "LISTA_INFORMACIONBASICA",
      seccion: "Control de material",
      boton: "Control de material",
    });
  });

  it("protege códigos con /, + y & al consultar el detalle", async () => {
    const fetcher = mockJson({ record: { numero_parte: "PCB/7421+A&B" } });
    await createMaterialsApi("live").detail("PCB/7421+A&B");
    const url = new URL(fetcher.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("numero_parte")).toBe("PCB/7421+A&B");
    expect(url.pathname).toBe(
      "/backend/api/informacion_basica/control_material/materiales/detalle",
    );
  });

  it("envía filtros al servidor y las cabeceras que reconoce su permiso JSON", async () => {
    const fetcher = mockJson({ success: true, records: [], total: 0 });
    await createMaterialsApi("live").list({
      q: " PCB/74 + & ",
      clasificacion: "Circuito integrado",
    });
    const [path, init] = fetcher.mock.calls[0];
    const url = new URL(path, "http://localhost");
    expect(url.searchParams.get("q")).toBe("PCB/74 + &");
    expect(url.searchParams.get("clasificacion")).toBe("Circuito integrado");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it.each([false, true])(
    "guarda con el método correcto (edición: %s) y sin campos ajenos",
    async (editing) => {
      const fetcher = mockJson({
        success: true,
        record: { numero_parte: "PCB/7421-11" },
      });
      await createMaterialsApi("live").save(payload, editing);
      const init = fetcher.mock.calls[0][1];
      expect(init.method).toBe(editing ? "PUT" : "POST");
      expect(JSON.parse(init.body)).toEqual({
        ...payload,
        numero_parte: "PCB/7421-11",
        especificacion_material: "PCB de control",
        vendedores: [
          { vendedor: "Proveedor A", costo: "0.1250", moneda: "USD" },
        ],
      });
    },
  );

  it("solicita baja lógica por el identificador original", async () => {
    const fetcher = mockJson({ success: true });
    await createMaterialsApi("live").remove("PCB/7421-11");
    expect(fetcher.mock.calls[0][1].method).toBe("DELETE");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      numero_parte: "PCB/7421-11",
    });
  });

  it("detecta falta de permiso aunque el backend devuelva HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<div>Acceso denegado</div>", { status: 403 }),
        ),
    );
    await expect(
      createMaterialsApi("live").list({ q: "", clasificacion: "" }),
    ).rejects.toThrow("no tiene permiso");
  });

  it("una sesión expirada solicita retirar los datos autenticados", async () => {
    mockJson({ error: "Sesión expirada" }, 401);
    const expired = vi.fn();
    window.addEventListener("mes:session-expired", expired);
    await expect(
      createMaterialsApi("live").list({ q: "", clasificacion: "" }),
    ).rejects.toThrow("Sesión expirada");
    expect(expired).toHaveBeenCalledOnce();
  });

  it("un error 200/success:false no se interpreta como un guardado exitoso", async () => {
    mockJson({ success: false, error: "Material duplicado" });
    await expect(
      createMaterialsApi("live").save(payload, false),
    ).rejects.toThrow("Material duplicado");
  });

  it("no descarga páginas de login ni errores con extensión Excel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Login</html>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    await expect(
      createMaterialsApi("live").export({ q: "", clasificacion: "" }),
    ).rejects.toThrow("archivo Excel válido");
  });

  it("distingue respuestas HTML de datos JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Inicio</html>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    await expect(request("/api/mi-perfil")).rejects.toThrow(
      "página en lugar de datos",
    );
  });

  it("conserva la cancelación de una consulta y no la presenta como falla de red", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Cancelada", "AbortError")),
    );
    await expect(backendFetch("/api/consulta")).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
