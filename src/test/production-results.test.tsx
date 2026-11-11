import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";
import * as adapter from "@/features/production-results/api";

afterEach(() => vi.restoreAllMocks());
const routes = [
  [
    "/resultados/imd-smd-terminado",
    "IMD-SMD TERMINADO",
    "Control de inventario",
    "IMD-SMD TERMINADO",
  ],
  [
    "/resultados/reparacion-smd",
    "Inventario reparacion SMD",
    "Control de inventario",
    "Inventario reparacion SMD",
  ],
  [
    "/resultados/reparacion-assy",
    "Inventario reparacion ASSY",
    "Control de inventario",
    "Inventario reparacion ASSY",
  ],
  [
    "/resultados/inventario-exceso",
    "Inventario Exceso",
    "Control de inventario",
    "Inventario Exceso",
  ],
  [
    "/resultados/entradas-exceso",
    "Entradas Exceso",
    "Control de inventario",
    "Entradas Exceso",
  ],
  [
    "/resultados/salidas-exceso",
    "Salidas Exceso",
    "Control de inventario",
    "Salidas Exceso",
  ],
  [
    "/resultados/input-smt",
    "Historial de input SMT",
    "Consultar resultados",
    "Historial de produccion SMT",
  ],
  [
    "/resultados/input-imd",
    "Historial de input IMD",
    "Consultar resultados",
    "Historial de produccion IMD",
  ],
  [
    "/resultados/input-ensamble",
    "Historial de input ensamble",
    "Consultar resultados",
    "Historial de produccion ensamble",
  ],
  [
    "/resultados/verificacion-display",
    "Historial de verificacion display",
    "Consultar resultados",
    "Historial de verificacion display",
  ],
] as const;
function mount(path: string, demo = true) {
  if (demo) localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}
describe("Control de resultados", () => {
  it("muestra únicamente el historial autorizado y envía sus criterios por HTTP", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/api/mi-perfil"))
        return Response.json({
          perfil: {
            username: "qa-result-allowed",
            nombre_completo: "QA",
            rol: "operador",
          },
        });
      if (url.endsWith("/obtener_permisos_usuario_actual"))
        return Response.json({
          usuario: "qa-result-allowed",
          rol: "operador",
          permisos: {
            LISTA_DE_CONTROL_DE_RESULTADOS: {
              "Consultar resultados": ["Historial de produccion SMT"],
            },
          },
        });
      if (url.includes("/api/control_resultados/historial_produccion_smt?"))
        return Response.json({
          success: true,
          rows: [
            {
              numero: 1,
              linea: "SMT A",
              fecha: "2026-11-11",
              hora: "08:00:00",
              qr: "0001/A+02&B",
              lote: "SMT-0001",
            },
          ],
          total: 1,
          page: 1,
          per_page: 500,
        });
      throw new Error("Solicitud inesperada " + url);
    });
    vi.stubGlobal("fetch", fetcher);
    mount("/resultados/input-smt", false);
    await screen.findByRole("cell", { name: "0001/A+02&B" });
    expect(
      screen.getByRole("link", { name: "Historial de input SMT" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Historial de input IMD" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Inventario Exceso" }),
    ).not.toBeInTheDocument();
    const requests = fetcher.mock.calls.filter(([url]) =>
      url.includes("/api/control_resultados/"),
    );
    expect(requests).toHaveLength(1);
    expect(
      new URL(requests[0][0], "http://mes").searchParams.get("per_page"),
    ).toBe("500");
  });
  it.each(routes)(
    "oculta y protege %s con su permiso original",
    async (path, title, group, permission) => {
      const fetcher = vi.fn(async (url: string) =>
        Response.json(
          url.endsWith("/api/mi-perfil")
            ? {
                perfil: {
                  username: "qa-results",
                  nombre_completo: "QA",
                  rol: "operador",
                },
              }
            : { usuario: "qa-results", rol: "operador", permisos: {} },
        ),
      );
      vi.stubGlobal("fetch", fetcher);
      mount(path, false);
      await screen.findByText("Acceso restringido");
      expect(
        screen.queryByRole("link", { name: title }),
      ).not.toBeInTheDocument();
      expect(modules.find((item) => item.path === path)?.permission).toEqual({
        pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
        seccion: group,
        boton: permission,
      });
      expect(
        fetcher.mock.calls.every(
          ([url]) =>
            !url.includes("/control_resultados/") &&
            !url.includes("/reparacion_"),
        ),
      ).toBe(true);
    },
  );
  it.each(routes)("abre %s en demo usando tablas y 500 filas", async (path) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("La demo no usa HTTP.");
      }),
    );
    mount(path);
    const table = await screen.findByRole("table");
    expect(table).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("500");
    expect(screen.getByRole("button", { name: "Exportar Excel" })).toHaveClass(
      "success",
    );
  });
  it("conserva la consulta al cambiar entre las vistas de reparación", async () => {
    mount("/resultados/reparacion-assy");
    await screen.findByRole("table");
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Parte o modelo" }),
      "0001/A+02&B",
    );
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await userEvent.click(
      screen.getByRole("tab", { name: "Detalle de movimientos" }),
    );
    await screen.findByRole("table", {
      name: "Reparación ASSY · Detalle de movimientos",
    });
    expect(
      await screen.findByRole("columnheader", { name: /Línea salida PCB/ }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Stock actual" }));
    expect(
      screen.getByRole("searchbox", { name: "Parte o modelo" }),
    ).toHaveValue("0001/A+02&B");
  });
  it("reinicia la página cuando cambia un filtro de encabezado remoto", async () => {
    const base = adapter.createResultsApi("demo");
    const report = vi.fn(base.report);
    vi.spyOn(adapter, "createResultsApi").mockReturnValue({ ...base, report });
    mount("/resultados/input-smt");
    await screen.findByRole("table");
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    await waitFor(() => expect(report.mock.calls.at(-1)?.[3]).toBe(2));
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar Línea" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Filtrar Línea" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "SMT A" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Aplicar" }),
    );
    await waitFor(() =>
      expect(report.mock.calls.at(-1)?.slice(2, 5)).toEqual([
        { linea: "SMT A" },
        1,
        500,
      ]),
    );
  });
  it("invalida el lote de cierre al reemplazar el CSV y permite confirmar una sola vez", async () => {
    const base = adapter.createResultsApi("demo");
    const data = {
      batchId: null,
      valid: false,
      metadata: {},
      rows: [
        {
          part_number: "0001-A",
          system_quantity: 10,
          physical_quantity: 9,
          difference_quantity: -1,
          status: "diferencia",
        },
      ],
      summary: {},
      history: [],
      errors: [],
    };
    const preview = vi.fn(async () => ({ ...data, batchId: 17, valid: true }));
    let resolveConfirm: (value: {
      message: string;
      history: never[];
    }) => void = () => {};
    const confirm = vi.fn(
      () =>
        new Promise<{ message: string; history: never[] }>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    vi.spyOn(adapter, "createResultsApi").mockReturnValue({
      ...base,
      closure: async () => data,
      previewClosure: preview,
      confirmClosure: confirm,
    });
    mount("/resultados/inventario-exceso");
    await screen.findByRole("table");
    await userEvent.click(
      screen.getByRole("button", { name: "Cierre de inventario" }),
    );
    const upload = await screen.findByLabelText("CSV de inventario físico");
    await userEvent.upload(
      upload,
      new File(["part_number,current_qty\n0001-A,9"], "conteo.csv", {
        type: "text/csv",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeEnabled(),
    );
    await userEvent.upload(
      upload,
      new File(["bad"], "otro.csv", { type: "text/csv" }),
    );
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    const commit = screen.getByRole("button", {
      name: "Confirmar cierre",
    });
    await userEvent.dblClick(commit);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(17);
    resolveConfirm({ message: "Cierre guardado", history: [] });
    await screen.findByText("Cierre guardado");
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeDisabled();
  });
});
