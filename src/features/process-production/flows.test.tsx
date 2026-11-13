import { Activity } from "react";
import { AssyProposals } from "./AssyProposals";
import type { Api } from "./types";
import { extraDecoders } from "./contracts";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import * as adapter from "./api";
import { defaults } from "./model";
import type { Row } from "./types";
afterEach(() => vi.restoreAllMocks());
function mount(path: string) {
  localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
  const fetcher = vi.fn(() => {
    throw new Error("La demo no usa HTTP");
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
describe("Flujos de Control de proceso", () => {
  it.each(["ASSY", "IMT", "SMT"] as const)(
    "consulta el estado de %s sin permitir iniciar, pausar o terminar desde el plan",
    async (kind) => {
      const base = adapter.createApi("demo"),
        action = vi.fn().mockResolvedValue({ message: "Plan actualizado." });
      const lot = `PLAN-CONSULTA-${kind}`;
      const plans: Row[] = [
        {
          lot_no: lot,
          working_date: defaults().start,
          part_no: "EBR23966228",
          line: kind === "ASSY" ? "M1" : kind === "IMT" ? "P1" : "SA",
          group_no: 1,
          sequence: 1,
          plan_count: 100,
          uph: 1000,
          status: "EN PROGRESO",
        },
      ];
      vi.spyOn(adapter, "createApi").mockReturnValue({
        ...base,
        plans: vi.fn().mockResolvedValue(plans),
        action,
      });
      mount(`/proceso/produccion-${kind.toLowerCase()}`);
      const table = await screen.findByRole("table", {
        name: `Planes ${kind}`,
      });
      expect(within(table).getByText("EN PROGRESO")).toBeInTheDocument();
      expect(
        within(table).queryByRole("button", {
          name: /^(Estado |Iniciar|Pausar|Terminar)/i,
        }),
      ).not.toBeInTheDocument();
      expect(action).not.toHaveBeenCalled();
      await userEvent.click(
        screen.getByRole("button", { name: `Editar ${lot}` }),
      );
      const form = screen.getByRole("dialog");
      if (kind !== "ASSY")
        expect(
          within(form).queryByRole("button", { name: "Recargar sub-assy" }),
        ).toBeNull();
      expect(within(form).queryByLabelText(/^Estado/)).not.toBeInTheDocument();
      expect(
        within(form).queryByLabelText(/Motivo de pausa|Motivo de término/),
      ).not.toBeInTheDocument();
      const quantity = within(form).getByLabelText(/^Cantidad del plan/);
      await userEvent.clear(quantity);
      await userEvent.type(quantity, "125");
      await userEvent.click(
        within(form).getByRole("button", { name: "Guardar plan" }),
      );
      await waitFor(() => expect(action).toHaveBeenCalledOnce());
      const [actualKind, operation, payload] = action.mock.calls[0];
      expect(actualKind).toBe(kind);
      expect(operation).toBe("update");
      expect(payload).toMatchObject({ lot_no: lot, plan_count: 125 });
      expect(payload).not.toHaveProperty("status");
      expect(payload).not.toHaveProperty("pause_reason");
      expect(payload).not.toHaveProperty("end_reason");
    },
  );
  it("asigna el grupo SCAN al plan elegido sin extenderlo de forma implícita", async () => {
    const base = adapter.createApi("demo"),
      extra = vi.fn(base.extra);
    vi.spyOn(adapter, "createApi").mockReturnValue({
      ...base,
      extra: async (name, data, signal) =>
        extraDecoders[name](
          await (signal ? extra(name, data, signal) : extra(name, data)),
        ),
    });
    mount("/proceso/produccion-assy");
    await screen.findByRole("table", { name: "Planes ASSY" });
    await userEvent.click(
      screen.getByRole("button", { name: "Lotes SCAN sin asignar" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Asignar a plan" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Asignar SCAN · EBR23966228",
    });
    expect(within(dialog).getByRole("checkbox")).not.toBeChecked();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirmar" }),
    );
    await screen.findByText("Grupo SCAN asignado.");
    expect(extra).toHaveBeenCalledWith(
      "assign-scan",
      expect.objectContaining({
        linea: "M1",
        nparte: "EBR23966228",
        date_from: defaults().start,
        date_to: defaults().end,
        target_lot_no: "ASSY-DEMO-001",
        allow_extend: false,
      }),
    );
  });
  it("conserva el resumen del servidor en el contraste de producción, OQC y almacén", async () => {
    const base = adapter.createApi("demo"),
      report = vi.fn<typeof base.report>().mockResolvedValue({
        rows: [
          {
            fecha: defaults().start,
            part_number: "0001/01-A",
            produced_quantity: 7,
            oqc_quantity: 5,
            warehouse_quantity: 4,
          },
        ],
        summary: {
          produced_quantity: 888,
          oqc_quantity: 777,
          warehouse_quantity: 666,
          pending_oqc: 111,
          pending_warehouse: 111,
        },
      });
    vi.spyOn(adapter, "createApi").mockReturnValue({ ...base, report });
    mount("/proceso/salida-lineas");
    await screen.findByRole("table", { name: "Salida de líneas" });
    await screen.findByText("888");
    await screen.findByText("777");
    await screen.findByText("666");
    await userEvent.type(screen.getByLabelText("Número de parte"), "0001/01-A");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await waitFor(() =>
      expect(report).toHaveBeenLastCalledWith(
        "outputs",
        expect.objectContaining({ part_number: "0001/01-A" }),
        {},
        expect.any(AbortSignal),
      ),
    );
  });
  it("crea BOTTOM/TOP con QR cero, cancela sin borrar y permite reactivar", async () => {
    const base = adapter.createApi("demo"),
      action = vi.fn(base.action);
    vi.spyOn(adapter, "createApi").mockReturnValue({ ...base, action });
    const fetcher = mount("/proceso/produccion-smt");
    await screen.findByRole("table", { name: "Planes SMT" });
    expect(screen.getByLabelText("Filas por página")).toHaveValue("500");
    await userEvent.click(screen.getByRole("button", { name: "Nuevo plan" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText(/^Número de parte/),
      "EBR23966228",
    );
    await userEvent.clear(within(dialog).getByLabelText(/^Cantidad del plan/));
    await userEvent.type(
      within(dialog).getByLabelText(/^Cantidad del plan/),
      "1000",
    );
    for (const name of ["QR requeridos", "Array"]) {
      await userEvent.clear(within(dialog).getByLabelText(name));
      await userEvent.type(within(dialog).getByLabelText(name), "0");
    }
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Lado"),
      "BOTTOM",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar plan" }),
    );
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith(
        "SMT",
        "create",
        expect.objectContaining({
          plan_count: 1000,
          qr_required_count: 0,
          array_size: 0,
          lado: "BOTTOM",
        }),
      ),
    );
    const result = (await action.mock.results[0].value) as Row,
      top = String(result.lot_top);
    await screen.findByRole("button", { name: `Cancelar ${top}` });
    await userEvent.click(
      screen.getByRole("button", { name: `Cancelar ${top}` }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    await screen.findByRole("button", { name: `Reactivar ${top}` });
    expect(action).toHaveBeenLastCalledWith("SMT", "update", {
      lot_no: top,
      status: "CANCELADO",
    });
    expect(screen.getByText(top)).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  }, 20000);
  it("reordena ASSY sin escribir hasta confirmar y guarda secuencias/horarios", async () => {
    const base = adapter.createApi("demo"),
      action = vi.fn(base.action);
    vi.spyOn(adapter, "createApi").mockReturnValue({ ...base, action });
    mount("/proceso/produccion-assy");
    await screen.findByRole("table", { name: "Planes ASSY" });
    await userEvent.click(
      screen.getByRole("button", { name: "Bajar ASSY-DEMO-002" }),
    );
    await screen.findByText(/Orden sin guardar/);
    expect(action).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Editar ASSY-DEMO-004" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Guardar orden" })[0],
    );
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith(
        "ASSY",
        "order",
        expect.objectContaining({
          sequences: expect.arrayContaining([
            expect.objectContaining({
              lot_no: "ASSY-DEMO-004",
              group_no: 1,
              sequence: 1,
              planned_start: `${defaults().start} 07:30:00`,
            }),
          ]),
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText(/Orden sin guardar/)).not.toBeInTheDocument(),
    );
  });
  it("reprograma pendientes IMT con la fecha seleccionada y conserva el original", async () => {
    const base = adapter.createApi("demo"),
      action = vi.fn(base.action);
    vi.spyOn(adapter, "createApi").mockReturnValue({ ...base, action });
    mount("/proceso/produccion-imt");
    await screen.findByRole("table", { name: "Planes IMT" });
    await userEvent.click(screen.getByRole("button", { name: "Reprogramar" }));
    await userEvent.click(
      await screen.findByLabelText("Reprogramar IMT-DEMO-001"),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reprogramar (1)" }),
    );
    const date = defaults().end;
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar reprogramación" }),
    );
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith("IMT", "reschedule", {
        lot_nos: ["IMT-DEMO-001"],
        new_working_date: date,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const row = screen
      .getByRole("cell", { name: "IMT-DEMO-001" })
      .closest("tr")!;
    expect(within(row).getByText("TERMINADO")).toBeInTheDocument();
  });
  it("importa WOs con IDs originales y conserva los errores parciales", async () => {
    const base = adapter.createApi("demo"),
      extra = vi
        .fn<typeof base.extra>()
        .mockImplementation(async (name, data, signal) => {
          const result = await base.extra(name, data, signal);
          return name === "import-wos"
            ? {
                ...(result as Row),
                errors: ["WO adicional ya importada: revisar"],
              }
            : result;
        });
    vi.spyOn(adapter, "createApi").mockReturnValue({
      ...base,
      extra: async (name, data, signal) =>
        extraDecoders[name](
          await (signal ? extra(name, data, signal) : extra(name, data)),
        ),
    });
    mount("/proceso/produccion-assy");
    await screen.findByRole("table", { name: "Planes ASSY" });
    await userEvent.click(screen.getByRole("button", { name: "Importar WOs" }));
    await userEvent.click(
      await screen.findByLabelText("Importar WO-DEMO-ASSY-01"),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Importar seleccionadas (1)" }),
    );
    await userEvent.click(
      within(
        screen.getByRole("dialog", { name: "Importar WO seleccionadas" }),
      ).getByRole("button", { name: "Confirmar" }),
    );
    await screen.findByText("WO adicional ya importada: revisar");
    expect(extra).toHaveBeenCalledWith("import-wos", {
      wo_ids: [1],
      import_date: defaults().end,
    });
  });
  it("compara propuestas antes de aplicar y no inserta lotes nuevos automáticamente", async () => {
    const base = adapter.createApi("demo"),
      extra = vi.fn(base.extra);
    vi.spyOn(adapter, "createApi").mockReturnValue({
      ...base,
      extra: async (name, data, signal) =>
        extraDecoders[name](
          await (signal ? extra(name, data, signal) : extra(name, data)),
        ),
    });
    mount("/proceso/produccion-assy");
    await screen.findByRole("table", { name: "Planes ASSY" });
    await userEvent.click(screen.getByRole("button", { name: "Plan IA" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Ver cambios" }),
    );
    await screen.findByRole("table", { name: "Cambios de propuesta ASSY" });
    expect(extra.mock.calls.some(([name]) => name === "apply-diff")).toBe(
      false,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar cambios (1)" }),
    );
    await userEvent.click(
      within(
        screen.getByRole("dialog", { name: "Aplicar cambios de propuesta" }),
      ).getByRole("button", { name: "Confirmar" }),
    );
    await waitFor(() =>
      expect(extra).toHaveBeenCalledWith("apply-diff", {
        proposal_id: "PROP-DEMO-ASSY",
        cambios: [
          expect.objectContaining({ lot_no: "ASSY-DEMO-001", cantidad: 800 }),
        ],
      }),
    );
    expect(extra.mock.calls.some(([name]) => name === "import-proposal")).toBe(
      false,
    );
  });
  it("presenta salida N/A de SMT/IMT y usa filtros remotos antes de paginar el historial", async () => {
    const base = adapter.createApi("demo"),
      report = vi.fn(base.report);
    vi.spyOn(adapter, "createApi").mockReturnValue({ ...base, report });
    mount("/proceso/historial-operacion");
    const table = await screen.findByRole("table", {
      name: "Operación por proceso",
    });
    await within(table).findAllByText("N/A");
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar NÚMERO DE PARTE" }),
    );
    const popup = screen.getByRole("dialog", {
      name: "Filtrar NÚMERO DE PARTE",
    });
    await userEvent.type(within(popup).getByRole("searchbox"), "EBR23966228");
    await userEvent.click(
      within(popup).getByRole("button", { name: "Aplicar" }),
    );
    await waitFor(() =>
      expect(report).toHaveBeenLastCalledWith(
        "operations",
        expect.any(Object),
        { part_no: "EBR23966228" },
        expect.any(AbortSignal),
      ),
    );
  });

  it("aborta la comparación de una propuesta al cerrar su herramienta", async () => {
    const base = adapter.createApi("demo");
    let finish!: (value: unknown) => void;
    let requestSignal: AbortSignal | undefined;
    const pending = new Promise<unknown>((resolve) => {
      finish = resolve;
    });
    const extra = vi.fn<
      (...args: Parameters<Api["extra"]>) => Promise<unknown>
    >(async (name, data, signal) => {
      if (name === "diff") {
        requestSignal = signal;
        return pending;
      }
      return base.extra(name, data, signal);
    });
    vi.spyOn(adapter, "createApi").mockReturnValue({
      ...base,
      extra: async (name, data, signal) =>
        extraDecoders[name](await extra(name, data, signal)),
    });
    mount("/proceso/produccion-assy");
    await screen.findByRole("table", { name: "Planes ASSY" });
    await userEvent.click(screen.getByRole("button", { name: "Plan IA" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Ver cambios" }),
    );
    expect(requestSignal?.aborted).toBe(false);
    await userEvent.click(
      within(
        screen.getByRole("dialog", { name: "Propuestas IA · ASSY" }),
      ).getByRole("button", { name: "Cerrar" }),
    );
    expect(requestSignal?.aborted).toBe(true);
    await act(async () => finish({ cambios: [], nuevos: [], sobran: [] }));
    expect(
      screen.queryByRole("table", { name: "Cambios de propuesta ASSY" }),
    ).not.toBeInTheDocument();
  });

  it("permite comparar de nuevo después de suspender y reactivar una pestaña", async () => {
    localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
    const base = adapter.createApi("demo");
    let finish!: (value: unknown) => void;
    let signal: AbortSignal | undefined;
    const pending = new Promise<unknown>((resolve) => {
      finish = resolve;
    });
    const extra = vi.fn<
      (...args: Parameters<Api["extra"]>) => Promise<unknown>
    >(async (name, data, requestSignal) => {
      if (name === "diff") {
        signal = requestSignal;
        return pending;
      }
      return base.extra(name, data, requestSignal);
    });
    vi.spyOn(adapter, "createApi").mockReturnValue({
      ...base,
      extra: async (name, data, requestSignal) =>
        extraDecoders[name](await extra(name, data, requestSignal)),
    });
    const view = (mode: "visible" | "hidden") => (
      <MemoryRouter>
        <AppProviders>
          <Activity mode={mode}>
            <AssyProposals
              initial={defaults()}
              onClose={vi.fn()}
              onDone={vi.fn()}
            />
          </Activity>
        </AppProviders>
      </MemoryRouter>
    );
    const rendered = render(view("visible"));
    await userEvent.click(
      await screen.findByRole("button", { name: "Ver cambios" }),
    );
    rendered.rerender(view("hidden"));
    expect(signal?.aborted).toBe(true);
    await act(async () => finish({ cambios: [], nuevos: [], sobran: [] }));
    rendered.rerender(view("visible"));
    expect(
      await screen.findByRole("button", { name: "Ver cambios" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("table", { name: "Cambios de propuesta ASSY" }),
    ).not.toBeInTheDocument();
  });
});
