import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";
afterEach(() => vi.restoreAllMocks());
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
describe("Material por áreas sobre componentes compartidos", () => {
  it.each([
    ["smd", "SMD"],
    ["micom", "Micom"],
    ["imd", "IMD"],
    ["assy", "ASSY"],
    ["ipm", "IPM"],
  ])(
    "oculta y bloquea %s con su permiso propio antes de consultar datos",
    async (area, title) => {
      const fetcher = vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              url.endsWith("/api/mi-perfil")
                ? {
                    perfil: {
                      username: "qa-area",
                      nombre_completo: "QA",
                      rol: "operador",
                    },
                  }
                : { usuario: "qa-area", rol: "operador", permisos: {} },
            ),
            { headers: { "Content-Type": "application/json" } },
          ),
      );
      vi.stubGlobal("fetch", fetcher);
      mount(`/material/${area}`, false);
      await screen.findByText("Acceso restringido");
      expect(
        modules.find((module) => module.path === `/material/${area}`)
          ?.permission,
      ).toEqual({
        pagina: "LISTA_DE_MATERIALES",
        seccion: "Material por áreas",
        boton: `Control de material ${title}`,
      });
      expect(
        screen.queryByRole("link", { name: `Control de material ${title}` }),
      ).not.toBeInTheDocument();
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
    },
  );
  it("ASSY permanece identificado como pendiente sin simular inventarios ni solicitar una API inexistente", async () => {
    const fetcher = vi.fn(() => {
      throw new Error("No debe consultar datos");
    });
    vi.stubGlobal("fetch", fetcher);
    mount("/material/assy");
    await screen.findByText("Consulta pendiente de habilitación");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Exportar Excel" }),
    ).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("abre inventario general con 500 filas, filtra otras páginas y conserva filtros propios al cambiar de modo y pestaña", async () => {
    const fetcher = vi.fn(() => {
      throw new Error("La demo no usa HTTP");
    });
    vi.stubGlobal("fetch", fetcher);
    mount("/material/smd");
    let table = await screen.findByRole("table", {
      name: "Material SMD · Inventario general",
    });
    expect(screen.getByRole("combobox", { name: "Consulta" })).toHaveValue(
      "inventario",
    );
    expect(screen.getByRole("combobox", { name: "Modo" })).toHaveValue(
      "general",
    );
    expect(screen.getByLabelText("Filas por página")).toHaveValue("500");
    expect(screen.queryByLabelText("Fecha desde")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar PART NO" }),
    );
    const popup = screen.getByRole("dialog", { name: "Filtrar PART NO" });
    await userEvent.type(
      within(popup).getByRole("searchbox"),
      "SMD-PARTE-1101-A",
    );
    await userEvent.click(
      within(popup).getByRole("button", { name: "Aplicar" }),
    );
    table = await screen.findByRole("table", {
      name: "Material SMD · Inventario general",
    });
    await within(table).findByText("SMD-PARTE-1101-A");
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(2),
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Modo" }),
      "detallado",
    );
    table = await screen.findByRole("table", {
      name: "Material SMD · Inventario detallado",
    });
    await within(table).findByText("SMD/26-0001-A");
    await userEvent.click(
      screen.getByRole("link", { name: "Control de material Micom" }),
    );
    await screen.findByRole("table", {
      name: "Material Micom · Inventario virgen general",
    });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Consulta" }),
      "inventario_chamber",
    );
    await screen.findByRole("table", {
      name: "Material Micom · Inventario chamber general",
    });
    expect(
      screen.getByRole("columnheader", { name: /PROGRAMACIÓN/ }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("tab", { name: "Control de material SMD" }),
    );
    expect(screen.getByRole("combobox", { name: "Modo" })).toHaveValue(
      "detallado",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Modo" }),
      "general",
    );
    table = await screen.findByRole("table", {
      name: "Material SMD · Inventario general",
    });
    await within(table).findByText("SMD-PARTE-1101-A");
    expect(
      within(table).queryByText("SMD-PARTE-0001-A"),
    ).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  }, 30000);
  it("mantiene fechas solo para movimientos y ofrece el inventario completo de IPM", async () => {
    mount("/material/ipm");
    await screen.findByRole("table", {
      name: "Material IPM · Inventario virgen general",
    });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Consulta" }),
      "inventario_completo",
    );
    await screen.findByRole("table", {
      name: "Material IPM · Inventario completo general",
    });
    expect(
      screen.getByRole("columnheader", { name: /PART NO IPM/ }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Consulta" }),
      "entradas",
    );
    await screen.findByLabelText("Fecha desde");
    await userEvent.clear(screen.getByLabelText("Fecha desde"));
    await userEvent.type(screen.getByLabelText("Fecha desde"), "2026-12-31");
    await userEvent.clear(screen.getByLabelText("Fecha hasta"));
    await userEvent.type(screen.getByLabelText("Fecha hasta"), "2026-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await screen.findByText(
      "La fecha inicial no puede ser posterior a la final.",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Consulta" }),
      "inventario",
    );
    await screen.findByRole("table", {
      name: "Material IPM · Inventario virgen general",
    });
    expect(screen.queryByLabelText("Fecha desde")).not.toBeInTheDocument();
  }, 20000);
});
