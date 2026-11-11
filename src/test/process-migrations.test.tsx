import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";
describe("Permisos de retrabajo y Control de proceso", () => {
  it.each([
    [
      "/produccion/retrabajo",
      "Solicitud de retrabajo",
      "LISTA_CONTROLDEPRODUCCION",
      "Retrabajo",
      "Solicitud de retrabajo",
    ],
    [
      "/proceso/produccion-assy",
      "Control de produccion ASSY",
      "LISTA_CONTROL_DE_PROCESO",
      "Control de produccion",
      "Control de produccion ASSY",
    ],
    [
      "/proceso/produccion-imt",
      "Control de produccion IMT",
      "LISTA_CONTROL_DE_PROCESO",
      "Control de produccion",
      "Control de produccion IMT",
    ],
    [
      "/proceso/produccion-smt",
      "Control de produccion SMT",
      "LISTA_CONTROL_DE_PROCESO",
      "Control de produccion",
      "Control de produccion SMT Plan",
    ],
    [
      "/proceso/historial-operacion",
      "Historial de operacion por proceso",
      "LISTA_CONTROL_DE_PROCESO",
      "Control de produccion",
      "Historial de operacion por proceso",
    ],
    [
      "/proceso/salida-lineas",
      "Control de salida de lineas",
      "LISTA_CONTROL_DE_PROCESO",
      "Control de produccion",
      "Control de salida de lineas",
    ],
  ])(
    "oculta y bloquea %s antes de consultar datos",
    async (path, title, pagina, seccion, boton) => {
      const fetcher = vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              url.endsWith("/api/mi-perfil")
                ? {
                    perfil: {
                      username: "qa-process",
                      nombre_completo: "QA",
                      rol: "operador",
                    },
                  }
                : { usuario: "qa-process", rol: "operador", permisos: {} },
            ),
            { headers: { "Content-Type": "application/json" } },
          ),
      );
      vi.stubGlobal("fetch", fetcher);
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppProviders>
            <App />
          </AppProviders>
        </MemoryRouter>,
      );
      await screen.findByText("Acceso restringido");
      expect(
        screen.queryByRole("link", { name: title }),
      ).not.toBeInTheDocument();
      expect(
        modules.find((module) => module.path === path)?.permission,
      ).toEqual({ pagina, seccion, boton });
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
    },
  );
  it.each([
    "/plan-main",
    "/plan-main-assy-ajax",
    "/plan-imd",
    "/plan-main-imd-ajax",
    "/plan-smt",
    "/plan-main-smt-ajax",
    "/historial-operacion-proceso-ajax",
    "/control-salida-lineas-ajax",
    "/control_produccion/retrabajo",
  ])("mantiene el alias %s dentro de un solo descriptor", (path) => {
    expect(
      modules.filter((module) => module.legacyPaths?.includes(path)),
    ).toHaveLength(1);
  });
});
