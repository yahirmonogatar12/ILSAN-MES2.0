import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";
import * as adapter from "@/features/product-tracking/api";
import { lookup } from "@/features/product-tracking/demo";
import { today } from "@/features/product-tracking/model";
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
const routes = [
  ["/reporte/product-tracking", "Production Tracking By Process"],
  ["/reporte/trazabilidad-pcb", "Trazabilidad de PCB"],
] as const;
describe("Pantallas Product Tracking", () => {
  it.each(routes)(
    "oculta y protege %s sin el permiso original",
    async (path, permission) => {
      const fetcher = vi.fn(async (url: string) =>
        Response.json(
          url.endsWith("/api/mi-perfil")
            ? {
                perfil: {
                  username: "qa-tracking",
                  nombre_completo: "QA",
                  rol: "operador",
                },
              }
            : { usuario: "qa-tracking", rol: "operador", permisos: {} },
        ),
      );
      vi.stubGlobal("fetch", fetcher);
      mount(path, false);
      await screen.findByText("Acceso restringido");
      expect(
        screen.queryByRole("link", { name: permission }),
      ).not.toBeInTheDocument();
      expect(
        modules.find((module) => module.path === path)?.permission,
      ).toEqual({
        pagina: "LISTA_DE_CONTROL_DE_REPORTE",
        seccion: "Product Tracking",
        boton: permission,
      });
      expect(
        fetcher.mock.calls.some(
          ([url]) =>
            url.includes("/production_tracking/") ||
            url.includes("/trazabilidad_pcb/"),
        ),
      ).toBe(false);
    },
  );
  it("consulta por Enter, separa piezas y conserva el estado entre pestañas", async () => {
    mount("/reporte/product-tracking");
    const input = await screen.findByRole("searchbox", {
      name: "Código de la pieza (QR o barcode)",
    });
    expect(input).toHaveFocus();
    await userEvent.type(input, "0001/A+02&B{Enter}");
    const table = await screen.findByRole("table", {
      name: "Etapas de producción",
    });
    await within(table).findByText("Reemplazado por 0001/A+02&B");
    expect(table.querySelectorAll(".table-group-header")).toHaveLength(2);
    expect(within(table).getAllByText("N/A").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("500");
    expect(screen.getByRole("button", { name: "Exportar Excel" })).toHaveClass(
      "success",
    );
    await userEvent.click(
      screen.getByRole("tab", { name: "Varias piezas (importar Excel)" }),
    );
    await userEvent.click(screen.getByRole("tab", { name: "Una pieza" }));
    expect(
      screen.getByRole("searchbox", {
        name: "Código de la pieza (QR o barcode)",
      }),
    ).toHaveValue("0001/A+02&B");
    expect(
      within(table).getByText("Reemplazado por 0001/A+02&B"),
    ).toBeVisible();
  });
  it("conecta las tres vistas y abre las verificaciones del PCB", async () => {
    mount("/reporte/trazabilidad-pcb");
    await userEvent.type(
      await screen.findByRole("searchbox", { name: "PCB (QR / barcode)" }),
      "QA-PCB-0001{Enter}",
    );
    const table = await screen.findByRole("table", {
      name: "Materiales del PCB",
    });
    await within(table).findAllByText("#0");
    expect(within(table).getAllByRole("cell", { name: "0" })).toHaveLength(3);
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Historial de verificaciones (1)",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Historial de verificaciones",
    });
    await within(dialog).findByRole("cell", { name: "ROHM" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cerrar" }),
    );
    await userEvent.click(
      screen.getByRole("tab", { name: "Por lote de producción" }),
    );
    expect(
      within(
        screen.getByRole("tabpanel", { name: "Por lote de producción" }),
      ).getByLabelText("Desde"),
    ).toHaveValue(today());
    await screen.findAllByRole("cell", { name: "COMPLETED" });
    await userEvent.click(
      screen.getByRole("tab", { name: "Por lote de proveedor (inversa)" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ingresa un lote de proveedor o material.",
    );
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Lote proveedor / material" }),
      "20261111",
    );
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    const inverse = screen.getByRole("table", {
      name: "PCBs por lote de proveedor",
    });
    expect(
      await within(inverse).findAllByRole("cell", { name: "QA-PCB-0001" }),
    ).toHaveLength(3);
  });
  it("exporta los filtros aplicados y conserva los ceros al editar el borrador", async () => {
    const base = adapter.createTrackingApi("demo");
    const exportTrace = vi.fn(async () => {});
    vi.spyOn(adapter, "createTrackingApi").mockReturnValue({
      ...base,
      exportTrace,
    });
    mount("/reporte/trazabilidad-pcb");
    const input = await screen.findByRole("searchbox", {
      name: "PCB (QR / barcode)",
    });
    await userEvent.type(input, "QA-PCB-0001{Enter}");
    await screen.findByRole("button", {
      name: "Historial de verificaciones (1)",
    });
    await userEvent.clear(input);
    await userEvent.type(input, "0001/A+02&B");
    await userEvent.click(
      screen.getByRole("button", { name: "Exportar Excel" }),
    );
    await waitFor(() =>
      expect(exportTrace).toHaveBeenCalledWith("por_pcb", {
        pcb: "QA-PCB-0001",
        proceso: "",
      }),
    );
  });
  it("alinea la fecha inicial del lote con el día informado por el servidor", async () => {
    const base = adapter.createTrackingApi("demo");
    const serverDate = new Date(Date.parse(today()) - 86400000)
      .toISOString()
      .slice(0, 10);
    const trace = vi.fn(async () => ({
      items: [],
      message: "",
      fecha_hoy: serverDate,
    }));
    vi.spyOn(adapter, "createTrackingApi").mockReturnValue({ ...base, trace });
    mount("/reporte/trazabilidad-pcb");
    await userEvent.click(
      await screen.findByRole("tab", { name: "Por lote de producción" }),
    );
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("tabpanel", { name: "Por lote de producción" }),
        ).getByLabelText("Desde"),
      ).toHaveValue(serverDate),
    );
    expect(trace).toHaveBeenCalledTimes(2);
  });
  it("conserva el Excel al compactar y descarta su resultado al elegir otro", async () => {
    const media = window.matchMedia("");
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      ...media,
      media: query,
      matches: query === "(max-width: 620px)",
    }));
    const base = adapter.createTrackingApi("demo"),
      source = await lookup("0001/A+02&B");
    const batch = vi.fn(async (_file: File, _signal?: AbortSignal) => ({
      ...source,
      items: [{ ...source.items[0], codigo: "0001/A+02&B" }],
      etapas: source.items[0].etapas.map((stage) => stage.etapa),
      total: 1,
      encontrados: 1,
      no_encontrados: 0,
    }));
    vi.spyOn(adapter, "createTrackingApi").mockReturnValue({ ...base, batch });
    mount("/reporte/product-tracking");
    await userEvent.click(
      await screen.findByRole("tab", {
        name: "Varias piezas (importar Excel)",
      }),
    );
    const file = new File(["xlsx"], "codigos.xlsx");
    await userEvent.upload(
      screen.getByLabelText("Archivo Excel con los códigos"),
      file,
    );
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    const table = screen.getByRole("table", { name: "Tracking por lote" });
    await within(table).findAllByText("0001/A+02&B");
    expect(batch.mock.calls[0][0]).toBe(file);
    const input = screen.getByLabelText(
      "Archivo Excel con los códigos",
    ) as HTMLInputElement;
    expect(input).not.toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar archivo" }),
    );
    expect(input).toBeVisible();
    expect(input.files?.[0]).toBe(file);
    await userEvent.upload(
      screen.getByLabelText("Archivo Excel con los códigos"),
      new File(["otro"], "otro.xlsx"),
    );
    expect(within(table).queryByText("0001/A+02&B")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Consultar" })).toBeEnabled();
  });
});
