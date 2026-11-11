import {
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
import * as adapter from "./api";
import { defaults } from "./model";
import { moveToGroup } from "./timeline";
import type { Row } from "./types";
afterEach(() => vi.restoreAllMocks());
function mount(path: string) {
  localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("La demo no usa HTTP");
    }),
  );
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}
describe("Presentación original de los planes", () => {
  it("divide ASSY con total productivo y estado, admite grupos vacíos y guarda el arrastre solo al confirmar", async () => {
    const base = adapter.createApi("demo"),
      date = defaults().start;
    const plans: Row[] = [
      {
        lot_no: "LOTE-A",
        working_date: date,
        line: "M1",
        group_no: 1,
        sequence: 1,
        plan_count: 6000,
        uph: 1000,
        status: "PLAN",
      },
      {
        lot_no: "LOTE-B",
        working_date: date,
        line: "M2",
        group_no: 1,
        sequence: 2,
        plan_count: 4000,
        uph: 1000,
        status: "PLAN",
      },
      {
        lot_no: "LOTE-C",
        working_date: date,
        line: "M1",
        group_no: 2,
        sequence: 1,
        plan_count: 9999,
        uph: 1000,
        status: "CANCELADO",
      },
    ];
    const action = vi.fn(base.action);
    vi.spyOn(adapter, "createApi").mockReturnValue({
      ...base,
      plans: vi.fn().mockResolvedValue(plans),
      action,
    });
    mount("/proceso/produccion-assy");
    const table = await screen.findByRole("table", { name: "Planes ASSY" });
    const group1 = within(table).getByRole("row", { name: "GRUPO 1" });
    expect(within(group1).getByText("Total: 10.0h")).toBeInTheDocument();
    expect(within(group1).getByText("TIEMPO EXTRA")).toBeInTheDocument();
    expect(
      within(within(table).getByRole("row", { name: "GRUPO 2" })).getByText(
        "Total: 0.0h",
      ),
    ).toBeInTheDocument();
    const destination = within(table).getByRole("row", {
      name: "Asignar planes a GRUPO 3",
    });
    fireEvent.drop(destination, { dataTransfer: { getData: () => "LOTE-A" } });
    await screen.findByText(/Orden sin guardar/);
    expect(action).not.toHaveBeenCalled();
    expect(
      within(within(table).getByRole("row", { name: "GRUPO 3" })).getByText(
        "Total: 6.0h",
      ),
    ).toBeInTheDocument();
    expect(within(group1).getByText("Total: 4.0h")).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "LOTE-A" })).toHaveLength(1);
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
              lot_no: "LOTE-A",
              group_no: 3,
              sequence: 1,
            }),
            expect.objectContaining({
              lot_no: "LOTE-B",
              group_no: 1,
              sequence: 1,
            }),
          ]),
        }),
      ),
    );
    expect(() => moveToGroup(plans, "LOTE-A", 3, "2099-01-01")).toThrow(
      "misma fecha",
    );
    expect(plans[0].group_no).toBe(1);
  });
  it.each(["IMT", "SMT"] as const)(
    "divide %s por línea y conserva los totales sin crear zonas de grupos ASSY",
    async (kind) => {
      mount(`/proceso/produccion-${kind.toLowerCase()}`);
      const table = await screen.findByRole("table", {
        name: `Planes ${kind}`,
      });
      const title = kind === "IMT" ? "PANA A" : "SMT A";
      const band = within(table).getByRole("row", { name: title });
      expect(
        within(band).getByText(/6 planes · Plan: 6,000/),
      ).toBeInTheDocument();
      expect(
        within(table).queryByText(/Arrastra planes aquí/),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Filas por página")).toHaveValue("500");
    },
  );
});
