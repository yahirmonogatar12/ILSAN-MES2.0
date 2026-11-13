import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";
import { createInvoiceApi, createPurchaseApi } from "./api";
import { UploadDialog } from "./UploadDialog";
import { UploadPanel } from "./UploadPanel";
import type { DataRow } from "./types";
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
describe("Facturas sobre la base compartida", () => {
  it("recalcula las columnas de la vista previa cuando cambia el scope", () => {
    const api = createInvoiceApi("demo");
    const props = {
      kind: "invoice" as const,
      api,
      prepared: {
        upload: {
          file: new File(["invoice"], "invoice.xlsx"),
          numero_invoice: "INV-TEST",
          tipo: "LG",
        },
        preview: {
          numero_invoice: "INV-TEST",
          lines: [{ pallet_no: "PALLET-01", part_no: "EBR00000001" }],
          warnings: [],
          duplicado: null,
        },
      },
      onClose: vi.fn(),
      onLoaded: vi.fn(),
    };
    const view = render(<UploadDialog {...props} scope="EMBARQUES" />);

    expect(screen.queryByRole("columnheader", { name: "PALLET" })).toBeNull();

    view.rerender(<UploadDialog {...props} scope="ALMACEN" />);

    expect(
      screen.getByRole("columnheader", { name: "PALLET" }),
    ).toBeInTheDocument();
  });

  it("conserva la captura lateral y envía el modo del botón, con una sola confirmación del archivo revisado", async () => {
    const file = new File(["original"], "lista-original.xlsx");
    const api = {
      ...createPurchaseApi("demo"),
      preview: vi.fn().mockResolvedValue({
        sample: [],
        warnings: [],
        bloqueado_inicial: false,
        sync: null,
      }),
      upload: vi.fn().mockResolvedValue({ carga_id: 9 }),
    };
    const saved = vi.fn();
    render(
      <UploadPanel
        kind="purchase"
        api={api}
        initial={{ LG: false, OVEN: true }}
        onLoaded={saved}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText("Archivo Excel"), file);
    await userEvent.click(screen.getByRole("button", { name: "Sincronizar" }));
    await screen.findByRole("dialog", { name: "Vista previa de compras" });
    expect(api.preview).toHaveBeenCalledExactlyOnceWith({
      file,
      tipo: "LG",
      modo: "SINCRONIZACION",
    });
    expect(api.upload).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar carga" }),
    );
    expect(api.upload).toHaveBeenCalledExactlyOnceWith({
      file,
      tipo: "LG",
      modo: "SINCRONIZACION",
    });
    await waitFor(() =>
      expect(saved).toHaveBeenCalledExactlyOnceWith({ carga_id: 9 }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Archivo Excel")).toHaveValue("");
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "OVEN");
    expect(
      screen.getByRole("button", { name: "Carga inicial" }),
    ).toBeDisabled();
  });
  it.each([
    ["/material/invoice-almacen", "Facturas / Invoice"],
    ["/material/invoice-embarques", "Invoice Embarques"],
    ["/material/valorizacion-inventario", "Valorización de inventario"],
    ["/material/lista-compras", "Lista de compras"],
  ])(
    "oculta y bloquea %s sin consultar datos cuando no tiene permiso",
    async (path, button) => {
      const fetcher = vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              url.endsWith("/api/mi-perfil")
                ? {
                    perfil: {
                      username: "qa-facturas",
                      nombre_completo: "QA",
                      rol: "operador",
                    },
                  }
                : { usuario: "qa-facturas", rol: "operador", permisos: {} },
            ),
            { headers: { "Content-Type": "application/json" } },
          ),
      );
      vi.stubGlobal("fetch", fetcher);
      mount(path, false);
      await screen.findByText("Acceso restringido");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("tab")).not.toBeInTheDocument();
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
      expect(
        modules.find((module) => module.path === path)?.permission,
      ).toEqual({
        pagina: "LISTA_DE_MATERIALES",
        seccion: "Control de material",
        boton: button,
      });
    },
  );
  it("edita una parte completa y conserva el historial de recepciones documentales en Packing", async () => {
    const fetcher = vi.fn(() => {
      throw new Error("La demo no usa HTTP");
    });
    vi.stubGlobal("fetch", fetcher);
    mount("/material/invoice-almacen");
    await userEvent.click(
      await screen.findByRole("button", { name: "INV-ALMACEN-DEMO" }),
    );
    let table = await screen.findByRole("table", { name: "Líneas invoice" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ampliar detalle" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Ampliar detalle" }),
    );
    expect(
      screen.getByRole("button", { name: "Mostrar listado" }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(table).getByRole("button", { name: "Editar línea 1" }),
    );
    let dialog = await screen.findByRole("dialog", {
      name: "Editar línea de invoice",
    });
    await userEvent.clear(within(dialog).getByLabelText("Parte sistema"));
    await userEvent.type(
      within(dialog).getByLabelText("Parte sistema"),
      "QA/74-11-A",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar línea" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Editar línea de invoice" }),
      ).not.toBeInTheDocument(),
    );
    table = screen.getByRole("table", { name: "Líneas invoice" });
    await within(table).findByText("QA/74-11-A");
    await userEvent.click(screen.getByRole("tab", { name: /^Packing/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Marcar recibido" }),
    );
    dialog = screen.getByRole("dialog", { name: "Marcar recibido" });
    await userEvent.type(
      within(dialog).getByLabelText("Comentario"),
      "Recepción documental QA",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirmar" }),
    );
    await screen.findByRole("button", { name: "Revertir recepción" });
    await userEvent.click(
      screen.getByRole("tab", { name: /^Recepciones manuales/ }),
    );
    table = screen.getByRole("table", { name: "Recepciones manuales" });
    expect(table).toHaveTextContent("RECIBIDO");
    expect(table).toHaveTextContent("Recepción documental QA");
    expect(fetcher).not.toHaveBeenCalled();
  }, 15000);
  it("Embarques presenta Part Sys completo y oculta las operaciones de aplicación de Almacén", async () => {
    mount("/material/invoice-embarques");
    await userEvent.click(
      await screen.findByRole("button", { name: "INV-EMBARQUES-DEMO" }),
    );
    const table = await screen.findByRole("table", { name: "Líneas invoice" });
    expect(table).toHaveTextContent("EBR23966228-01-A");
    expect(
      screen.queryByRole("button", { name: "Aplicar automáticamente" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desaplicar invoice" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /^Packing/ }));
    expect(
      screen.queryByRole("button", { name: "Marcar recibido" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cerrar invoice" }),
    ).toBeInTheDocument();
  });
  it("abre compras por número y tipo y confirma el cambio de cierre sin perder la identidad", async () => {
    mount("/material/lista-compras");
    const table = await screen.findByRole("table", {
      name: "Transacciones de compra",
    });
    const row = within(table)
      .getAllByRole("row")
      .find((row) => within(row).queryByRole("cell", { name: "LG" }));
    await userEvent.click(
      within(row!).getByRole("button", { name: "PO/26-001+A&B" }),
    );
    await screen.findByRole("table", { name: "Líneas de compra" });
    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar transacción" }),
    );
    const confirm = screen.getByRole("dialog", { name: "Cerrar transacción" });
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Confirmar" }),
    );
    await screen.findByRole("button", { name: "Reabrir transacción" });
    await userEvent.click(
      screen.getByRole("tab", { name: /^Lotes vinculados/ }),
    );
    expect(
      screen.getByRole("table", { name: "Lotes vinculados" }),
    ).toHaveTextContent("MAT/26-0004");
    const panel = screen.getByRole("region", {
      name: "Transacción · PO/26-001+A&B",
    });
    await userEvent.click(
      within(panel).getByRole("button", { name: "Ver Excel original" }),
    );
    const originals = await screen.findByRole("table", {
      name: "Archivos originales de compras",
    });
    expect(originals).toHaveTextContent("compras_LG_demostracion.xlsx");
    expect(originals).not.toHaveTextContent("compras_OVEN_demostracion.xlsx");
  });
  it("muestra cambios de sincronización y confirma una sola carga con el archivo previsualizado", async () => {
    let resolveUpload!: (result: DataRow) => void;
    const saved = vi.fn();
    const file = new File(["fixture"], "compras.xlsx");
    const api = {
      ...createPurchaseApi("demo"),
      preview: vi.fn().mockResolvedValue({
        sample: [
          {
            numero_parte: "RAW/01",
            numero_parte_sistema: "SYS-01-A",
            numero_transaccion: "PO/01",
            cantidad: 1,
          },
        ],
        warnings: [],
        total_lineas: 1,
        total_transacciones: 1,
        lineas_nuevas: 1,
        bloqueado_inicial: false,
        sync: {
          faltantes: 2,
          modificadas: 1,
          renombradas: 1,
          bloqueadas: [],
          protegidas: [],
          faltantes_muestra: [
            { numero_transaccion: "PO/01", numero_parte: "A-B" },
          ],
          renombradas_muestra: [
            { numero_parte: "A-B", anterior: "PO-ANTERIOR", nueva: "PO/01" },
          ],
        },
      }),
      upload: vi.fn().mockImplementation(
        () =>
          new Promise<DataRow>((resolve) => {
            resolveUpload = resolve;
          }),
      ),
    };
    render(
      <UploadDialog
        kind="purchase"
        api={api}
        initial={{ LG: false, OVEN: true }}
        onClose={vi.fn()}
        onLoaded={saved}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Modo de carga"),
      "SINCRONIZACION",
    );
    await userEvent.upload(screen.getByLabelText("Archivo Excel"), file);
    await userEvent.click(
      screen.getByRole("button", { name: "Previsualizar" }),
    );
    await screen.findByRole("table", { name: "Renglones de vista previa" });
    await userEvent.click(
      screen.getByRole("tab", { name: "Eliminaciones previstas" }),
    );
    expect(
      screen.getByRole("table", { name: "Renglones de vista previa" }),
    ).toHaveTextContent("A-B");
    await userEvent.click(
      screen.getByRole("tab", { name: "Cambios de transacción" }),
    );
    expect(
      screen.getByRole("table", { name: "Renglones de vista previa" }),
    ).toHaveTextContent("PO-ANTERIOR");
    const form = screen
      .getByRole("button", { name: "Confirmar carga" })
      .closest("form")!;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(api.upload).toHaveBeenCalledExactlyOnceWith({
      file,
      tipo: "LG",
      modo: "SINCRONIZACION",
    });
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await act(async () => resolveUpload({ total_lineas: 1 }));
    expect(saved).toHaveBeenCalledExactlyOnceWith({ total_lineas: 1 });
  });
  it("mantiene 500 por defecto y pagina valorización sin consultar otra vez el resumen", async () => {
    let summaryCalls = 0;
    const fetcher = vi.fn(async (url: string) => {
      let value: unknown;
      if (url.endsWith("/api/mi-perfil"))
        value = {
          perfil: {
            username: "qa-val",
            nombre_completo: "QA",
            rol: "operador",
          },
        };
      else if (url.endsWith("/obtener_permisos_usuario_actual"))
        value = {
          usuario: "qa-val",
          rol: "operador",
          permisos: {
            LISTA_DE_MATERIALES: {
              "Control de material": ["Valorización de inventario"],
            },
          },
        };
      else if (url.includes("/valuation/summary?")) {
        summaryCalls++;
        value = {
          success: true,
          records: [
            {
              fuente_costo: "INVOICE",
              moneda: "USD",
              lotes: 501,
              stock_total: 501,
              valor_total: 501,
            },
          ],
        };
      } else {
        const params = new URL(url, "http://local").searchParams;
        const size = Number(params.get("limit"));
        const offset = Number(params.get("offset"));
        value = {
          success: true,
          total: 501,
          limit: size,
          offset,
          records: Array.from(
            { length: Math.min(size, 501 - offset) },
            (_, index) => ({
              codigo_material_recibido: `QA-${offset + index + 1}`,
              stock_actual: 1,
              costo_unitario: "0",
              es_estimado: 0,
            }),
          ),
        };
      }
      return new Response(JSON.stringify(value), {
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetcher);
    mount("/material/valorizacion-inventario", false);
    await screen.findByRole("table", { name: "Valorización de inventario" });
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("500");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Filas por página" }),
      "10",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("table", { name: "Valorización de inventario" }),
      ).toHaveTextContent("QA-10"),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Página siguiente" }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    await within(
      screen.getByRole("table", { name: "Valorización de inventario" }),
    ).findByText("QA-11");
    expect(summaryCalls).toBe(1);
    expect(
      fetcher.mock.calls.some(([url]) => url.includes("limit=10&offset=10")),
    ).toBe(true);
  }, 20000);
});
