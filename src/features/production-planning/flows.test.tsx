import { actionDecoders } from "./contracts";
import { actionPayloads } from "./requests";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import { modules } from "@/app/registry";
import { ApiError } from "@/core/http";
import * as adapter from "./api";
import { ImportDialog } from "./ImportDialog";
import { ProposalDialog } from "./ProposalDialog";
import { PivotPage } from "./PivotPage";
import { week } from "./model";
import type { Row } from "./types";

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
function isolated(node: React.ReactNode) {
  localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
  render(
    <MemoryRouter>
      <AppProviders>{node}</AppProviders>
    </MemoryRouter>,
  );
}
function offline() {
  const fetcher = vi.fn(() => {
    throw new Error("La demo no usa HTTP");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

describe("Planificación de producción", () => {
  it("exige línea para una captura positiva y permite eliminarla con cero sin línea", async () => {
    offline();
    const base = adapter.createPlanningApi("demo"),
      date = week().date_from;
    const action = vi
      .fn<typeof base.action>()
      .mockResolvedValue({ success: true });
    vi.spyOn(adapter, "createPlanningApi").mockReturnValue({
      ...base,
      action: async (name, data) =>
        actionDecoders[name](await action(name, data)),
      pivot: vi.fn().mockResolvedValue({
        dates: [date],
        rows: [
          {
            part_no: "QA-SCHEDULE",
            qty: { [date]: 0 },
            sched: { [date]: 10 },
            proj: { [date]: 10 },
            inv: null,
          },
        ],
        total_parts: 1,
        page: 1,
        page_size: 500,
      }),
    });
    isolated(<PivotPage projection />);
    const edit = await screen.findByRole("textbox", {
      name: `Editar schedule QA-SCHEDULE ${date}`,
    });
    await waitFor(() => expect(edit).toBeEnabled());
    await userEvent.click(edit);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.clear(edit);
    await userEvent.type(edit, "11{Enter}");
    await screen.findAllByText(
      /Selecciona una línea de schedule para una cantidad positiva/,
    );
    expect(action).not.toHaveBeenCalled();
    await userEvent.clear(edit);
    await userEvent.type(edit, "0{Enter}");
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith("schedule", {
        part_no: "QA-SCHEDULE",
        sched_date: date,
        sched_qty: 0,
        linea: "",
        turno: "DIA",
      }),
    );
    await userEvent.type(screen.getByLabelText("Línea de schedule"), "M2");
    await userEvent.selectOptions(
      screen.getByLabelText("Turno de schedule"),
      "NOCHE",
    );
    await userEvent.click(edit);
    await userEvent.clear(edit);
    await userEvent.type(edit, "1,000{Enter}");
    await waitFor(() =>
      expect(action).toHaveBeenLastCalledWith("schedule", {
        part_no: "QA-SCHEDULE",
        sched_date: date,
        sched_qty: 1000,
        linea: "M2",
        turno: "NOCHE",
      }),
    );
    await waitFor(() => expect(edit).not.toHaveAttribute("readonly"));
    await userEvent.clear(edit);
    await userEvent.keyboard("{Tab}");
    await waitFor(() =>
      expect(action).toHaveBeenLastCalledWith("schedule", {
        part_no: "QA-SCHEDULE",
        sched_date: date,
        sched_qty: null,
        linea: "M2",
        turno: "NOCHE",
      }),
    );
    const inventory = screen.getByRole("textbox", {
      name: "Editar LGEMM QA-SCHEDULE",
    });
    await userEvent.click(inventory);
    await userEvent.clear(inventory);
    await userEvent.type(inventory, "-5{Enter}");
    await waitFor(() =>
      expect(action).toHaveBeenLastCalledWith("inventory-field", {
        part_no: "QA-SCHEDULE",
        field: "lgemm",
        value: -5,
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each([
    ["/produccion/embarques", "Control de embarque"],
    ["/produccion/part-planning", "Part Planning LG"],
    ["/produccion/proyeccion", "Proyeccion"],
    ["/produccion/plan-proyectado", "Plan Proyectado"],
    ["/produccion/crear-plan", "Crear Plan de produccion"],
  ])(
    "oculta y bloquea %s antes de consultar sus datos",
    async (path, title) => {
      const fetcher = vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              url.endsWith("/api/mi-perfil")
                ? {
                    perfil: {
                      username: "qa-planning",
                      nombre_completo: "QA",
                      rol: "operador",
                    },
                  }
                : { usuario: "qa-planning", rol: "operador", permisos: {} },
            ),
            { headers: { "Content-Type": "application/json" } },
          ),
      );
      vi.stubGlobal("fetch", fetcher);
      mount(path, false);
      await screen.findByText("Acceso restringido");
      expect(modules.find((m) => m.path === path)?.permission).toEqual({
        pagina: "LISTA_CONTROLDEPRODUCCION",
        seccion: "Control de plan de produccion",
        boton: title,
      });
      expect(
        screen.queryByRole("link", { name: title }),
      ).not.toBeInTheDocument();
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "/backend/api/mi-perfil",
        "/backend/obtener_permisos_usuario_actual",
      ]);
    },
  );

  it("no ofrece crear WO desde embarques sin el permiso de Crear Plan", async () => {
    const fetcher = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/api/mi-perfil")
              ? {
                  perfil: {
                    username: "qa-planning",
                    nombre_completo: "QA",
                    rol: "operador",
                  },
                }
              : url.endsWith("/obtener_permisos_usuario_actual")
                ? {
                    usuario: "qa-planning",
                    rol: "operador",
                    permisos: {
                      LISTA_CONTROLDEPRODUCCION: {
                        "Control de plan de produccion": [
                          "Control de embarque",
                        ],
                      },
                    },
                  }
                : {
                    success: true,
                    data: [
                      {
                        codigo_po: "PO-SOLO-LECTURA",
                        fecha_registro: week().date_from,
                        modelo: "EBR-01-A",
                      },
                    ],
                  },
          ),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    mount("/produccion/embarques", false);
    await screen.findByText("PO-SOLO-LECTURA");
    expect(
      screen.queryByRole("button", { name: "Crear WO" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Crear Plan de produccion" }),
    ).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(([url]) => url.includes("/work_orders")),
    ).toBe(false);
  });

  it("crea y edita una WO, luego la importa al plan y retira las acciones de una WO planificada", async () => {
    const fetcher = offline();
    mount("/produccion/crear-plan");
    await screen.findByRole("table", { name: "Work Orders" });
    expect(
      screen.getByRole("combobox", { name: "Filas por página" }),
    ).toHaveValue("500");
    await userEvent.click(screen.getByRole("button", { name: "Registrar WO" }));
    let dialog = screen.getByRole("dialog", { name: "Registrar Work Order" });
    await userEvent.type(within(dialog).getByLabelText("Modelo"), "QA-WO-01-A");
    await userEvent.type(
      within(dialog).getByLabelText("Cantidad planeada"),
      "300",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar" }),
    );
    const row = (await screen.findByText("QA-WO-01-A")).closest("tr")!;
    const checkbox = within(row).getByRole("checkbox");
    const code = checkbox
      .getAttribute("aria-label")!
      .replace("Seleccionar ", "");
    await userEvent.click(
      within(row).getByRole("button", { name: `Editar ${code}` }),
    );
    dialog = screen.getByRole("dialog", { name: `Editar WO · ${code}` });
    await userEvent.clear(within(dialog).getByLabelText("Cantidad planeada"));
    await userEvent.type(
      within(dialog).getByLabelText("Cantidad planeada"),
      "400",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const edited = screen.getByText("QA-WO-01-A").closest("tr")!;
    expect(within(edited).getByText("400")).toBeInTheDocument();
    await userEvent.click(within(edited).getByRole("checkbox"));
    await userEvent.click(
      screen.getByRole("button", { name: "Crear plan (1)" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar creación de plan",
      }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByText("QA-WO-01-A").closest("tr")!).getByRole(
          "checkbox",
        ),
      ).toBeDisabled(),
    );
    expect(
      screen.queryByRole("button", { name: `Editar ${code}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Eliminar ${code}` }),
    ).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  }, 20000);

  it("analiza LG antes de confirmar, congela archivo/año/opciones y evita doble envío", async () => {
    offline();
    const base = adapter.createPlanningApi("demo");
    let finish!: (result: Row) => void;
    const upload = vi
      .fn<typeof base.upload>()
      .mockResolvedValueOnce({
        file_sha256: "sha-qa",
        summary: { parts_count: 1 },
        sample_rows: [
          { part_no: "QA-01-A", plan_date: "2026-11-06", plan_qty: 0 },
        ],
        warnings: [],
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    vi.spyOn(adapter, "createPlanningApi").mockReturnValue({ ...base, upload });
    const done = vi.fn();
    isolated(<ImportDialog kind="lg" onDone={done} onClose={vi.fn()} />);
    const file = new File(["fixture"], "LG-original.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await userEvent.upload(screen.getByLabelText("Archivo Excel"), file);
    await userEvent.type(screen.getByLabelText("Año del plan"), "2026");
    await userEvent.selectOptions(
      screen.getByLabelText("Modo de importación"),
      "only_new",
    );
    await userEvent.click(screen.getByLabelText("Incluir cantidades en cero"));
    await userEvent.click(
      screen.getByRole("button", { name: "Analizar archivo" }),
    );
    await screen.findByText("QA-01-A");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", {
      name: "Confirmar importación",
    });
    await userEvent.dblClick(confirm);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[1]).toEqual([
      "confirm-lg",
      {
        file,
        plan_year: "2026",
        import_mode: "only_new",
        include_zero: "0",
        file_sha256: "sha-qa",
      },
    ]);
    expect(confirm).toBeDisabled();
    finish({ success: true, inserted: 1 });
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
  });

  it("revisa una propuesta y bloquea reenvíos si el servidor informa un snapshot vencido", async () => {
    offline();
    const base = adapter.createPlanningApi("demo");
    const action = vi
      .fn<typeof base.action>()
      .mockImplementation((name, data) =>
        name === "apply-proposal"
          ? Promise.reject(
              new ApiError("El schedule cambió; vuelve a generar.", 409),
            )
          : base.action(name, actionPayloads[name](data)),
      );
    vi.spyOn(adapter, "createPlanningApi").mockReturnValue({
      ...base,
      action: async (name, data) =>
        actionDecoders[name](await action(name, data)),
    });
    isolated(
      <ProposalDialog filters={week()} onClose={vi.fn()} onDone={vi.fn()} />,
    );
    expect(action).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Calcular propuesta" }),
    );
    await screen.findByRole("button", { name: "Aplicar propuesta (1)" });
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar propuesta (1)" }),
    );
    let confirm = screen.getByRole("button", { name: "Confirmar aplicación" });
    await userEvent.click(confirm);
    await screen.findByText("El schedule cambió; vuelve a generar.");
    expect(
      action.mock.calls.filter(([name]) => name === "apply-proposal"),
    ).toHaveLength(1);
    confirm = screen.getByRole("button", { name: "Confirmar aplicación" });
    await userEvent.click(confirm);
    await screen.findByText(
      "Genera una propuesta nueva antes de aplicar o rechazar.",
    );
    expect(
      action.mock.calls.filter(([name]) => name === "apply-proposal"),
    ).toHaveLength(1);
    const payload = action.mock.calls.find(
      ([name]) => name === "apply-proposal",
    )![1];
    expect(payload).toMatchObject({
      version: 1,
      items: [
        expect.objectContaining({ included: true, qty: 500, turno: "DIA" }),
      ],
    });
  });
});
