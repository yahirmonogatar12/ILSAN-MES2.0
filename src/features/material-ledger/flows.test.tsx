import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { historyDefaults } from "./config";
import { modules } from "@/app/registry";
afterEach(() => vi.restoreAllMocks());
function demo(path: string) {
  localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
  const fetcher = vi.fn(() => {
    throw new Error("La demo no debe usar HTTP");
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
  return fetcher;
}
describe("módulos administrativos de material", () => {
  it.each([
    ["/material/historial-entradas", "Historial de entradas"],
    ["/material/historial-salidas", "Historial de salidas"],
    ["/material/historial-retornos", "Historial de retornos"],
    ["/material/inventario-actual", "Inventario actual"],
  ])(
    "protege %s con su permiso exacto antes de consultar datos",
    async (path, title) => {
      const fetcher = vi.fn(
        async (url: string, _init?: RequestInit) =>
          new Response(
            JSON.stringify(
              url.endsWith("/api/mi-perfil")
                ? {
                    perfil: {
                      username: "qa",
                      nombre_completo: "QA",
                      rol: "operador",
                    },
                  }
                : { usuario: "qa", rol: "operador", permisos: {} },
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
        modules.find((module) => module.path === path)?.permission,
      ).toEqual({
        pagina: "LISTA_DE_MATERIALES",
        seccion: "Control de material",
        boton: title,
      });
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
      expect(
        fetcher.mock.calls.some(([url]) =>
          url.includes("/api/material_admin/"),
        ),
      ).toBe(false);
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    },
  );
  it("mantiene tres historiales en pestañas, conserva página y consulta filtros en todo el conjunto", async () => {
    const fetcher = demo("/material/historial-entradas");
    const table = await screen.findByRole("table", {
      name: "Historial de entradas",
    });
    expect(screen.getByLabelText("Desde")).toHaveValue(
      historyDefaults().fecha_inicio,
    );
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("500");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Filas por página" }),
      "10",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Página anterior" }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      screen.getByRole("link", { name: "Historial de salidas" }),
    );
    await screen.findByRole("table", { name: "Historial de salidas" });
    await userEvent.click(
      screen.getByRole("link", { name: "Historial de retornos" }),
    );
    await screen.findByRole("table", { name: "Historial de retornos" });
    await userEvent.click(
      screen.getByRole("tab", { name: "Historial de entradas" }),
    );
    expect(
      await screen.findByRole("table", { name: "Historial de entradas" }),
    ).toBe(table);
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("10");
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeEnabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar INVOICE" }),
    );
    let popup = screen.getByRole("dialog", { name: "Filtrar INVOICE" });
    await userEvent.type(within(popup).getByRole("searchbox"), "INV-24");
    await userEvent.click(
      within(popup).getByRole("button", { name: "Aplicar" }),
    );
    await within(table).findByText("INV-24");
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(2),
    );
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar INVOICE" }),
    );
    popup = screen.getByRole("dialog", { name: "Filtrar INVOICE" });
    await userEvent.clear(within(popup).getByRole("searchbox"));
    await userEvent.type(within(popup).getByRole("searchbox"), "NO-EXISTE");
    await userEvent.click(
      within(popup).getByRole("button", { name: "Aplicar" }),
    );
    await screen.findByText("Sin registros");
    await userEvent.click(
      screen.getByRole("button", { name: "Quitar filtros de columnas" }),
    );
    await within(table).findByText("INV-2");
    expect(fetcher).not.toHaveBeenCalled();
  }, 20000);
  it("abre lotes desde el resumen conservando la versión y aplica existencias/N-A/fechas", async () => {
    const fetcher = demo("/material/inventario-actual");
    await screen.findByRole("table", { name: "Resumen de inventario" });
    await userEvent.click(screen.getByRole("button", { name: "0CE105VK6DC" }));
    const table = await screen.findByRole("table", {
      name: "Detalle de inventario por lote",
    });
    expect(screen.getByLabelText("Número de parte")).toHaveValue(
      "0CE105VK6DC-01-A",
    );
    expect(within(table).getAllByText("01-A").length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText("Existencias"), "true");
    await userEvent.selectOptions(screen.getByLabelText("Lotes"), "true");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(3),
    );
    expect(within(table).getByText("MAT/26-0001")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Periodo"), "true");
    await userEvent.clear(screen.getByLabelText("Desde"));
    await userEvent.type(screen.getByLabelText("Desde"), "2026-12-31");
    await userEvent.clear(screen.getByLabelText("Hasta"));
    await userEvent.type(screen.getByLabelText("Hasta"), "2026-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await screen.findByText(
      "La fecha inicial no puede ser posterior a la final.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    await screen.findByRole("table", { name: "Resumen de inventario" });
    expect(screen.getByLabelText("Número de parte")).toHaveValue("");
    expect(fetcher).not.toHaveBeenCalled();
  }, 20000);
});
