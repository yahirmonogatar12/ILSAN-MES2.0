import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";

const group = "Almacén de Embarques";
const page = "LISTA_CONTROL_DE_PROCESO";
const entries = "Entradas almacen embarques";
const routes = [
  ["entradas", entries],
  ["salidas", "Salidas almacen embarques"],
  ["retorno", "Retorno almacen embarques"],
  ["movimientos", "Modificar movimientos embarques"],
  ["inventario", "Inventario general embarques"],
  ["catalogo", "Catálogo números de parte embarques"],
  ["pendientes-qa", "Pendientes QA Embarques"],
] as const;

function open(path: string, enabled: string[] = []) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/api/mi-perfil"))
      return Response.json({
        perfil: {
          username: "qa-embarques",
          nombre_completo: "QA",
          rol: "operador",
        },
      });
    if (url.endsWith("/obtener_permisos_usuario_actual"))
      return Response.json({
        usuario: "qa-embarques",
        rol: "operador",
        permisos: { [page]: { [group]: enabled } },
      });
    if (url.endsWith("/entradas")) return Response.json([]);
    if (url.endsWith("/entradas/invoices"))
      return Response.json({
        rows: [
          {
            invoice_id: 17,
            numero_invoice: "INV-QA-17",
            part_number: "0001/03-C",
            packing_line_ids: [21],
            quantity: 8,
            entrada_confirmada: false,
          },
        ],
      });
    throw new Error("Solicitud inesperada.");
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

describe("Permisos de Almacén de Embarques", () => {
  it.each(routes)(
    "oculta %s del menú y protege su URL directa",
    async (slug, title) => {
      const path = "/proceso/embarques/" + slug;
      const fetcher = open(path);
      await screen.findByText("Acceso restringido");
      expect(
        screen.queryByRole("link", { name: title }),
      ).not.toBeInTheDocument();
      expect(modules.find((item) => item.path === path)?.permission).toEqual({
        pagina: page,
        seccion: group,
        boton: title,
      });
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
    },
  );

  it("permite consultar el packing de un invoice con Entradas y reserva su confirmación al permiso documental", async () => {
    const fetcher = open("/proceso/embarques/entradas", [entries]);
    await screen.findByRole("table", { name: "Entradas almacén embarques" });
    expect(screen.getByRole("link", { name: entries })).toBeVisible();
    for (const [, title] of routes.slice(1)) {
      expect(
        screen.queryByRole("link", { name: title }),
      ).not.toBeInTheDocument();
    }
    await userEvent.click(
      screen.getByRole("button", { name: "Entrada Invoice" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "INV-QA-17" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("0001/03-C")).toBeVisible();
    expect(
      within(dialog).queryByRole("button", { name: "Confirmar recepción" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(([url]) => url.includes("manual-receipts")),
    ).toBe(false);
  });
});
