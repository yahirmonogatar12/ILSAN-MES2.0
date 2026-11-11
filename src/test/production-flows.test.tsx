import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { NewRequest } from "@/features/fpa/FpaForms";
import { createFpaApi } from "@/features/fpa/api";

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
describe("flujo de módulos de producción migrados", () => {
  it("registra, edita y elimina un modelo SMT y aplica líneas a una familia RAW", async () => {
    const fetcher = demo("/informacion-basica/modelos-smt");
    await screen.findByRole("table", { name: "Modelos SMT" });
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
    let dialog = screen.getByRole("dialog", { name: "Registrar modelo" });
    await userEvent.type(
      within(dialog).getByLabelText("part_no"),
      "QA-SMT-MIG-01",
    );
    await userEvent.type(within(dialog).getByLabelText("model"), "Modelo QA");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Registrar modelo" }),
    );
    await screen.findByRole("button", { name: "Editar QA-SMT-MIG-01" });
    await userEvent.click(
      screen.getByRole("button", { name: "Editar QA-SMT-MIG-01" }),
    );
    dialog = screen.getByRole("dialog", { name: "Editar modelo" });
    await userEvent.clear(within(dialog).getByLabelText("model"));
    await userEvent.type(
      within(dialog).getByLabelText("model"),
      "Modelo QA editado",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );
    await screen.findByText("Modelo QA editado");
    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar QA-SMT-MIG-01" }),
    );
    dialog = screen.getByRole("dialog", { name: "Eliminar modelo" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Eliminar" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Editar QA-SMT-MIG-01" }),
      ).not.toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("link", { name: "Control de modelos" }),
    );
    await screen.findByRole("table", { name: "Modelos base" });
    await userEvent.click(
      screen.getByRole("button", { name: "Líneas por familia" }),
    );
    dialog = screen.getByRole("dialog", { name: "Líneas por familia" });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Familia" }),
      "EBR807574",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Líneas permitidas"),
      "ASSY-QA",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Aplicar a la familia" }),
    );
    await waitFor(() => expect(screen.getAllByText("ASSY-QA")).toHaveLength(2));
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(fetcher).not.toHaveBeenCalled();
  }, 20000);

  it("crea una solicitud FPA con los códigos completos y ajusta sus cantidades con motivo", async () => {
    const fetcher = demo("/informacion-basica/fpa");
    await screen.findByRole("table", { name: "Solicitudes FPA" });
    await userEvent.click(
      screen.getByRole("button", { name: "Nueva solicitud" }),
    );
    let dialog = screen.getByRole("dialog", { name: "Nueva solicitud FPA" });
    await userEvent.type(
      within(dialog).getByLabelText(/Número de parte FPA/),
      "QA-FPA-MIG-01",
    );
    await userEvent.type(
      within(dialog).getByLabelText("PGM MAIN / MICOM"),
      "PGM-QA LOTE-01",
    );
    await userEvent.clear(within(dialog).getByLabelText("Cantidad MICOM"));
    await userEvent.type(within(dialog).getByLabelText("Cantidad MICOM"), "16");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Crear solicitud" }),
    );
    await screen.findByText("QA-FPA-MIG-01");
    await userEvent.click(
      screen.getByRole("button", { name: "Ajustar FPA-DEMO-2" }),
    );
    dialog = await screen.findByRole("dialog", {
      name: "Detalle FPA · FPA-DEMO-2",
    });
    await within(dialog).findByLabelText("Nueva cantidad MICOM");
    await userEvent.clear(
      within(dialog).getByLabelText("Nueva cantidad MICOM"),
    );
    await userEvent.type(
      within(dialog).getByLabelText("Nueva cantidad MICOM"),
      "8",
    );
    await userEvent.type(
      within(dialog).getByLabelText(/Motivo obligatorio/),
      "Ajuste QA",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar ajuste" }),
    );
    const table = await screen.findByRole("table", { name: "Solicitudes FPA" });
    await waitFor(() =>
      expect(
        within(table).getByRole("row", { name: /QA-FPA-MIG-01/ }),
      ).toHaveTextContent("0 / 0 / 8 · saldo 8"),
    );
    expect(fetcher).not.toHaveBeenCalled();
  }, 15000);

  it("simula la importación de ECO, muestra diferencias, publica y retira acciones de un aprobado", async () => {
    const fetcher = demo("/informacion-basica/bom");
    await screen.findByText("Selecciona un modelo");
    await userEvent.type(screen.getByLabelText("Modelo"), "EBR80757401");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await screen.findByRole("table", { name: "Componentes BOM" });
    await userEvent.click(screen.getByRole("button", { name: "Crear ECO" }));
    let dialog = screen.getByRole("dialog", { name: "Crear ECO" });
    await userEvent.clear(within(dialog).getByLabelText(/Número de ECO/));
    await userEvent.type(
      within(dialog).getByLabelText(/Número de ECO/),
      "QA-ECO-MIG-01",
    );
    await userEvent.upload(
      within(dialog).getByLabelText(/Excel modificado/),
      new File(["contenido demo"], "bom_qa.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    // jsdom validates its internal FileList, while user-event shims the public
    // getter. Submit the form event; domain validation still checks the File.
    // Browser QA separately exercises the native required-file control.
    fireEvent.submit(dialog.querySelector("form")!);
    dialog = await screen.findByRole("dialog", {
      name: "Detalle ECO · QA-ECO-MIG-01",
    });
    await within(dialog).findByRole("table", { name: "Modificados del ECO" });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Aprobar ECO" }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Aprobar ECO" }),
    );
    const confirmation = screen.getByRole("dialog", {
      name: "Aprobar y publicar ECO",
    });
    await userEvent.click(
      within(confirmation).getByRole("button", { name: "Aprobar y publicar" }),
    );
    await within(dialog).findByText("APPROVED");
    expect(
      within(dialog).queryByRole("button", { name: "Borrar ECO" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Aprobar ECO" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Adjuntar" }),
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  }, 20000);

  it("reintentar una captura FPA tras un fallo de red reutiliza la clave sin reintentar automáticamente", async () => {
    const saved = vi.fn();
    const api = {
      ...createFpaApi("demo"),
      create: vi
        .fn()
        .mockRejectedValueOnce(new Error("Red interrumpida"))
        .mockResolvedValue({ id: 99, folio: "FPA-QA-99" }),
    };
    render(<NewRequest api={api} onClose={vi.fn()} onSaved={saved} />);
    await userEvent.type(
      screen.getByLabelText(/Número de parte FPA/),
      "FPA-RETRY",
    );
    await userEvent.type(
      screen.getByLabelText("PGM MAIN / MICOM"),
      "PGM-QA LOTE01",
    );
    await userEvent.clear(screen.getByLabelText("Cantidad MICOM"));
    await userEvent.type(screen.getByLabelText("Cantidad MICOM"), "8");
    await userEvent.click(
      screen.getByRole("button", { name: "Crear solicitud" }),
    );
    await screen.findByText("Red interrumpida");
    expect(api.create).toHaveBeenCalledOnce();
    expect(screen.getByLabelText(/Número de parte FPA/)).toHaveValue(
      "FPA-RETRY",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Crear solicitud" }),
    );
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(api.create.mock.calls[0][1]).toBeTruthy();
    expect(api.create.mock.calls[0][1]).toBe(api.create.mock.calls[1][1]);
  });

  it.each(["bom", "fpa"])(
    "el permiso de consulta de %s no habilita escrituras",
    async (module) => {
      const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
        let value: unknown;
        if (url.endsWith("/api/mi-perfil"))
          value = {
            perfil: {
              username: "qa-readonly",
              nombre_completo: "Consulta QA",
              rol: "operador",
            },
          };
        else if (url.endsWith("/obtener_permisos_usuario_actual"))
          value = {
            usuario: "qa-readonly",
            rol: "operador",
            permisos: {
              LISTA_INFORMACIONBASICA: {
                "Control de produccion": ["Control de BOM", "Control de FPA"],
              },
            },
          };
        else if (url.endsWith("/listar_modelos_bom")) value = [];
        else if (url.includes("/api/control-fpa/requests?"))
          value = { data: [], meta: { total: 0 } };
        else throw new Error(`Solicitud inesperada: ${url}`);
        return new Response(JSON.stringify(value), {
          headers: { "Content-Type": "application/json" },
        });
      });
      vi.stubGlobal("fetch", fetcher);
      render(
        <MemoryRouter initialEntries={[`/informacion-basica/${module}`]}>
          <AppProviders>
            <App />
          </AppProviders>
        </MemoryRouter>,
      );
      await waitFor(() =>
        expect(
          fetcher.mock.calls.filter(([url]) =>
            url.endsWith("/obtener_permisos_usuario_actual"),
          ),
        ).toHaveLength(1),
      );
      expect(
        screen.queryByRole("button", { name: "Crear ECO" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Nueva solicitud" }),
      ).not.toBeInTheDocument();
      expect(
        fetcher.mock.calls.filter(
          ([url, init]) =>
            ["POST", "PATCH", "DELETE"].includes(init?.method || "") &&
            !url.endsWith("/verificar_permiso_dropdown"),
        ),
      ).toHaveLength(0);
    },
  );
});
