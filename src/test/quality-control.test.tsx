import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";
import * as adapter from "@/features/quality-control/api";
import { defaultFilters } from "@/features/quality-control/model";

afterEach(() => vi.restoreAllMocks());
const routes = [
  [
    "/calidad/maquinas",
    "Control de maquinas de calidad",
    "Control de maquinas",
  ],
  [
    "/calidad/material-smt",
    "Historial de cambio de material de SMT",
    "Historial de material",
  ],
  [
    "/calidad/material-imd",
    "Historial de cambio de material de IMD",
    "Historial de material",
  ],
  [
    "/calidad/material-assy",
    "Historial de cambio de material de ASSY",
    "Historial de material",
  ],
  [
    "/calidad/uso-pasta",
    "Historial de uso de pegamento de soldadura",
    "Historial de Sub Material",
  ],
  [
    "/calidad/uso-mask",
    "Historial de uso de mask de metal",
    "Historial de Sub Material",
  ],
  [
    "/calidad/uso-squeegee",
    "Historial de uso de squeegee",
    "Historial de Sub Material",
  ],
  ["/calidad/interlock", "Process interlock History", "Interlock History"],
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
function demoOnly() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("La demo no usa HTTP.");
    }),
  );
}
describe("Control de calidad", () => {
  it.each(routes)(
    "oculta y protege %s con su permiso exacto",
    async (path, title, group) => {
      const fetcher = vi.fn(async (url: string) =>
        Response.json(
          url.endsWith("/api/mi-perfil")
            ? {
                perfil: {
                  username: "qa-quality",
                  nombre_completo: "QA",
                  rol: "operador",
                },
              }
            : { usuario: "qa-quality", rol: "operador", permisos: {} },
        ),
      );
      vi.stubGlobal("fetch", fetcher);
      mount(path, false);
      await screen.findByText("Acceso restringido");
      expect(
        screen.queryByRole("link", { name: title }),
      ).not.toBeInTheDocument();
      expect(modules.find((item) => item.path === path)?.permission).toEqual({
        pagina: "LISTA_CONTROL_DE_CALIDAD",
        seccion: group,
        boton: title,
      });
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
    },
  );
  it("crea, edita, desactiva y elimina una estación con la línea visible en cada acción", async () => {
    demoOnly();
    const api = adapter.createQualityApi("demo");
    const save = vi.fn(api.saveStation),
      active = vi.fn(api.setActive),
      remove = vi.fn(api.deleteStation);
    vi.spyOn(adapter, "createQualityApi").mockReturnValue({
      ...api,
      saveStation: save,
      setActive: active,
      deleteStation: remove,
    });
    mount("/calidad/maquinas");
    await screen.findByRole("table", { name: "Máquinas de calidad" });
    expect(
      screen.getByRole("button", { name: "Editar ICT-01 · M1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar ICT-01 · M2" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Nueva estación" }),
    );
    let dialog = screen.getByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Código" }),
      "ICT-QA-01",
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Nombre" }),
      "Estación QA",
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Línea" }),
      "M4",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Editar ICT-QA-01 · M4" }),
    );
    dialog = screen.getByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: "Nombre" });
    await userEvent.clear(name);
    await userEvent.type(name, "Estación QA revisada");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Desactivar ICT-QA-01 · M4" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Desactivar",
      }),
    );
    await screen.findByRole("button", { name: "Activar ICT-QA-01 · M4" });
    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar ICT-QA-01 · M4" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Eliminar",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Editar ICT-QA-01 · M4" }),
      ).not.toBeInTheDocument(),
    );
    expect(save).toHaveBeenCalledTimes(2);
    const recordId = save.mock.calls[1][1];
    expect(recordId).toBeGreaterThan(0);
    expect(save.mock.calls[1][0]).toMatchObject({
      station_code: "ICT-QA-01",
      station_name: "Estación QA revisada",
      host_name: "M4",
    });
    expect(active).toHaveBeenCalledWith(recordId, false);
    expect(remove).toHaveBeenCalledWith(recordId);
  });
  it("aplica los encabezados en el servidor y exporta con los filtros consultados", async () => {
    demoOnly();
    const api = adapter.createQualityApi("demo");
    const history = vi.fn(api.history),
      download = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(adapter, "createQualityApi").mockReturnValue({
      ...api,
      history,
      exportHistory: download,
    });
    mount("/calidad/material-smt");
    let table = await screen.findByRole("table", {
      name: "Historial de cambio de material de SMT",
    });
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("500");
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar Línea" }),
    );
    const linePopup = screen.getByRole("dialog", { name: "Filtrar Línea" });
    expect(
      within(linePopup).getByRole("button", { name: "SMT A" }),
    ).toBeInTheDocument();
    expect(
      within(linePopup).getByRole("button", { name: "SMT B" }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(linePopup).getByRole("button", { name: "Cancelar" }),
    );
    await userEvent.selectOptions(screen.getByLabelText("Línea"), "SMT A");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Filtrar Slot" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Filtrar Slot" })).getByRole(
        "button",
        { name: "0" },
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    table = await screen.findByRole("table", {
      name: "Historial de cambio de material de SMT",
    });
    expect(
      within(table).getByRole("cell", { name: "NG" }).closest("tr"),
    ).toHaveClass("quality-control-rejected");
    expect(within(table).getAllByRole("cell", { name: "0" })).toHaveLength(2);
    await userEvent.selectOptions(screen.getByLabelText("Línea"), "SMT B");
    await userEvent.click(
      screen.getByRole("button", { name: "Exportar Excel" }),
    );
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(download).toHaveBeenCalledWith(
      "smt",
      { ...defaultFilters("smt"), linea: "SMT A" },
      { slot: "0" },
    );
    expect(history.mock.calls.at(-1)?.slice(2, 5)).toEqual([
      { slot: "0" },
      1,
      500,
    ]);
  });
  it("mantiene separados los filtros de paros y escáner y conserva el total de todo el conjunto", async () => {
    demoOnly();
    mount("/calidad/interlock");
    await screen.findByRole("table", { name: "Paros de interlock" });
    expect(screen.getByText("36.4s detenidos")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Incluir detecciones menores a 3 s",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await screen.findByText("38.4s detenidos");
    await userEvent.click(screen.getByRole("tab", { name: "Escáner ICT" }));
    const panel = screen.getByRole("tabpanel", { name: "Escáner ICT" });
    await within(panel).findByRole("table", { name: "Escáner ICT" });
    await userEvent.selectOptions(
      within(panel).getByLabelText("Tipo"),
      "Escaneo repetido",
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Consultar" }),
    );
    const repeated = await within(panel).findByRole("cell", {
      name: "Escaneo repetido",
    });
    expect(repeated.closest("tr")).not.toHaveClass("quality-control-rejected");
    await userEvent.click(
      screen.getByRole("tab", { name: "Paros de interlock" }),
    );
    const stops = screen.getByRole("tabpanel", { name: "Paros de interlock" });
    expect(
      within(stops).getByRole("checkbox", {
        name: "Incluir detecciones menores a 3 s",
      }),
    ).toBeChecked();
    expect(within(stops).getByText("38.4s detenidos")).toBeInTheDocument();
  });
});
