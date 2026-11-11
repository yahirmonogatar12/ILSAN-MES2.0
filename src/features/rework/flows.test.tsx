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
import { RequestForm } from "./RequestForm";
import * as adapter from "./api";
import type { ProgrammingOption } from "./types";
afterEach(() => vi.restoreAllMocks());
function mount(node?: React.ReactNode) {
  localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
  const fetcher = vi.fn(() => {
    throw new Error("La demo no usa HTTP");
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <MemoryRouter initialEntries={["/produccion/retrabajo"]}>
      <AppProviders>{node ?? <App />}</AppProviders>
    </MemoryRouter>,
  );
  return fetcher;
}
async function parts() {
  await userEvent.type(screen.getByLabelText(/^NP origen/), "EBR11111111");
  await userEvent.type(screen.getByLabelText(/^NP destino/), "EBR22222222");
  await userEvent.type(screen.getByLabelText("SMD"), "2");
}
describe("Solicitud de retrabajo", () => {
  it("reintenta con la misma clave, bloquea doble envío y mantiene captura al pulsar el fondo", async () => {
    const base = adapter.createReworkApi("demo"),
      record = await base.detail(510),
      done = vi.fn(),
      close = vi.fn();
    let reject!: (error: Error) => void;
    const create = vi
      .fn<typeof base.create>()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, rejectPromise) => {
            reject = rejectPromise;
          }),
      )
      .mockResolvedValue(record);
    mount(
      <RequestForm
        api={{ ...base, create }}
        scope="demo:qa"
        onClose={close}
        onCreated={done}
      />,
    );
    await parts();
    const dialog = screen.getByRole("dialog");
    await userEvent.click(dialog);
    expect(close).not.toHaveBeenCalled();
    await userEvent.dblClick(
      screen.getByRole("button", { name: "Crear solicitud" }),
    );
    expect(create).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("Conexión perdida")));
    await screen.findByText("Conexión perdida");
    expect(screen.getByLabelText(/^NP destino/)).toHaveValue("EBR22222222");
    await userEvent.click(
      screen.getByRole("button", { name: "Crear solicitud" }),
    );
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][1]).toBe(create.mock.calls[1][1]);
    expect(create.mock.calls[1][0].origenes).toEqual([
      { origen: "SMD", cantidad: 2 },
    ]);
  });
  it("no conserva selecciones de un BOM anterior cuando cambia el NP destino", async () => {
    const base = adapter.createReworkApi("demo");
    let resolveOld!: (options: ProgrammingOption[]) => void;
    const programming = vi
      .fn<typeof base.programming>()
      .mockImplementation((part) =>
        part === "EBR22222222"
          ? new Promise((resolve) => {
              resolveOld = resolve;
            })
          : Promise.resolve([
              {
                ic_location: "IC9",
                micom_part_no: "NEW",
                programming_label: "PROG-NUEVA",
              },
            ]),
      );
    const create = vi.fn<typeof base.create>(),
      done = vi.fn();
    mount(
      <RequestForm
        api={{ ...base, programming, create }}
        scope="demo:qa"
        onClose={vi.fn()}
        onCreated={done}
      />,
    );
    await parts();
    await userEvent.click(
      screen.getByLabelText("Lleva programación (etiquetas MICOM)"),
    );
    await waitFor(() => expect(programming).toHaveBeenCalled());
    fireEvent.submit(
      screen.getByRole("button", { name: "Crear solicitud" }).closest("form")!,
    );
    await screen.findByText(
      "Consulta la programación vigente del NP destino antes de guardar.",
    );
    expect(create).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText(/^NP destino/));
    await userEvent.type(screen.getByLabelText(/^NP destino/), "EBR33333333");
    await screen.findByLabelText("Programación IC9");
    await act(async () =>
      resolveOld([
        {
          ic_location: "IC1",
          micom_part_no: "OLD",
          programming_label: "PROG-VIEJA",
        },
      ]),
    );
    expect(screen.queryByLabelText("Programación IC1")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Programación IC9")).toHaveValue("PROG-NUEVA");
  });
  it("crea con programación/componentes, consulta trazabilidad y conserva avisos de cancelación", async () => {
    const base = adapter.createReworkApi("demo"),
      create = vi.fn(base.create),
      cancel = vi.fn(async (id: number) => ({
        ...(await base.cancel(id)),
        avisos: ["FPA 999: revisar ajuste en MICOM"],
      }));
    vi.spyOn(adapter, "createReworkApi").mockReturnValue({
      ...base,
      create,
      cancel,
    });
    const fetcher = mount();
    await screen.findByRole("table", { name: "Solicitudes de retrabajo" });
    expect(screen.getByLabelText("Filas por página")).toHaveValue("500");
    await userEvent.click(
      screen.getByRole("button", { name: "Nueva solicitud" }),
    );
    await parts();
    await userEvent.type(screen.getByLabelText("Embarques"), "3");
    await userEvent.click(
      screen.getByLabelText("Lleva programación (etiquetas MICOM)"),
    );
    await screen.findByLabelText("Programación IC1");
    await userEvent.selectOptions(
      screen.getByLabelText("Programación IC1"),
      "SAA30091 702(53DE)",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Agregar componente" }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Tipo del componente 1"),
      "IMD",
    );
    await userEvent.type(
      screen.getByLabelText("UBICACIÓN del componente 1"),
      "C12",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Crear solicitud" }),
    );
    await screen.findByRole("table", {
      name: "Programación MICOM del retrabajo",
    });
    expect(create.mock.calls[0][0]).toMatchObject({
      origenes: [
        { origen: "EMBARQUES", cantidad: 3 },
        { origen: "SMD", cantidad: 2 },
      ],
      programaciones: [
        { ic_location: "IC1", programming_label: "SAA30091 702(53DE)" },
        { ic_location: "IC2", programming_label: "SAA30091 703(54DE)" },
      ],
      componentes: [
        { tipo: "IMD", ubicacion: "C12", np_anterior: "", np_nuevo: "" },
      ],
    });
    await userEvent.click(screen.getByRole("tab", { name: "Componentes (1)" }));
    await within(
      screen.getByRole("table", { name: "Componentes del retrabajo" }),
    ).findByText("C12");
    await userEvent.click(screen.getByRole("tab", { name: "Escaneos (0)" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Cancelar solicitud" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelación" }),
    );
    await screen.findByText("FPA 999: revisar ajuste en MICOM");
    expect(
      screen.queryByRole("button", { name: "Cancelar solicitud" }),
    ).not.toBeInTheDocument();
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
  }, 30000);
});
