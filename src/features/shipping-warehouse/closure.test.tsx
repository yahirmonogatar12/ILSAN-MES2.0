import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/app/queryClient";
import { createWarehouseApi } from "./api";
import { InventoryClosure } from "./InventoryClosure";
import type { Warehouse } from "./hooks";
const metadata = {
  closureDate: "2026-12-12",
  closureUser: "Usuario QA",
  closureMonthLabel: "Noviembre 2026",
};
const rows = [
  {
    part_number: "QA-001",
    product_model: "Modelo A",
    system_quantity: 0,
    csv_current_qty: null,
    difference_quantity: null,
    applied_initial_quantity: null,
    status: "pendiente",
  },
  {
    part_number: "QA-002",
    product_model: "Modelo B",
    system_quantity: 10,
    csv_current_qty: null,
    difference_quantity: null,
    applied_initial_quantity: null,
    status: "pendiente",
  },
];
const history = [
  {
    id: 45,
    status: "draft",
    closure_label: "CIERRE-45",
    closure_month: "2026-11",
    closed_at: "2026-12-12",
    created_by: "Usuario QA",
    accuracy_pct: 50,
  },
  {
    id: 44,
    status: "confirmed",
    closure_label: "CIERRE-44",
    closure_month: "2026-10",
    closed_at: "2026-11-01",
    confirmed_by: "Supervisor",
    accuracy_pct: 100,
  },
];
const compared = rows.map((row) => ({
  ...row,
  csv_current_qty: 0,
  difference_quantity: -Number(row.system_quantity),
  applied_initial_quantity: 0,
  status: row.system_quantity ? "diferencia" : "igual",
}));
function setup() {
  const baseline = {
    rows,
    metadata,
    summary: { totalRows: 2, accuracyPct: 0 },
    history,
  };
  const valid = {
    valid: true,
    batchId: 46,
    batchCode: "CIERRE-46",
    rows: compared,
    metadata,
    summary: { totalRows: 2, accuracyPct: 50 },
    history,
    errors: [],
    closureImpact: {},
  };
  const api = {
    ...createWarehouseApi("live"),
    closureBootstrap: vi.fn().mockResolvedValue(baseline),
    closurePreview: vi.fn().mockResolvedValue(valid),
    closureBatch: vi.fn().mockResolvedValue({
      success: true,
      message: "Cierre confirmado.",
      history: [
        {
          ...history[0],
          id: 46,
          closure_label: "CIERRE-46",
          status: "confirmed",
        },
      ],
    }),
    closureDetail: vi.fn().mockImplementation(async (id: number) => ({
      rows: compared,
      metadata: {},
      summary: { accuracyPct: 50 },
      batch: history.find((row) => row.id === id)!,
    })),
    closureTemplate: vi.fn().mockResolvedValue(undefined),
    closureExport: vi.fn().mockResolvedValue(undefined),
  };
  const warehouse: Warehouse = {
    api,
    key: (...parts) => ["shipping-warehouse", "live:qa", ...parts],
    profile: null,
    saved: vi.fn(),
  };
  const close = vi.fn();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <InventoryClosure warehouse={warehouse} close={close} />
    </QueryClientProvider>,
  );
  return { api, warehouse, close };
}
async function upload(name = "conteo.csv") {
  await userEvent.upload(
    screen.getByLabelText("CSV de inventario físico"),
    new File(["part_number,current_qty\nQA-001,0\nQA-002,0"], name, {
      type: "text/csv",
    }),
  );
}
describe("original shipping inventory closure workflow", () => {
  it("renders metadata, accuracy, preview and history together without a modal", async () => {
    setup();
    await screen.findByDisplayValue("Noviembre 2026");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByLabelText("Fecha")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Usuario")).toHaveValue("Usuario QA");
    expect(screen.getByRole("img", { name: "Accuracy 0%" })).toBeVisible();
    expect(
      screen.getByRole("table", { name: "Comparación de inventario" }),
    ).toBeVisible();
    expect(
      screen.getByRole("table", { name: "Historial de cierres" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeDisabled();
    expect(
      screen.getAllByRole("combobox", { name: "Filas por página" }),
    ).toHaveLength(2);
    for (const select of screen.getAllByRole("combobox", {
      name: "Filas por página",
    }))
      expect(select).toHaveValue("500");
  });
  it("validates a CSV, keeps the comparison after confirmation and refreshes history", async () => {
    const { api, warehouse } = setup();
    await screen.findByDisplayValue("Noviembre 2026");
    await upload();
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole("img", { name: "Accuracy 50%" })).toBeVisible();
    await userEvent.dblClick(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeDisabled(),
    );
    expect(api.closureBatch).toHaveBeenCalledExactlyOnceWith("confirm", 46);
    expect(warehouse.saved).toHaveBeenCalledOnce();
    expect(screen.getByRole("img", { name: "Accuracy 50%" })).toBeVisible();
    expect(
      screen.getByRole("table", { name: "Comparación de inventario" }),
    ).toHaveTextContent("diferencia");
    expect(
      screen.getByRole("table", { name: "Historial de cierres" }),
    ).toHaveTextContent("CIERRE-46");
  });
  it("rejects an invalid preview and disables a validated draft when its file changes", async () => {
    const { api } = setup();
    await screen.findByDisplayValue("Noviembre 2026");
    await upload();
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeEnabled(),
    );
    await upload("nuevo.csv");
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeDisabled();
    api.closurePreview.mockResolvedValueOnce({
      valid: false,
      batchId: null,
      batchCode: "",
      rows,
      metadata,
      summary: {},
      history,
      errors: ["Falta QA-002 en el CSV."],
      closureImpact: {},
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    await screen.findByText("Falta QA-002 en el CSV.");
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeDisabled();
    expect(api.closureBatch).not.toHaveBeenCalled();
  });
  it("cancels the exact draft before resetting the file and baseline", async () => {
    const { api } = setup();
    await screen.findByDisplayValue("Noviembre 2026");
    await upload();
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reiniciar carga" }),
    );
    await waitFor(() => expect(api.closureBootstrap).toHaveBeenCalledTimes(2));
    expect(api.closureBatch).toHaveBeenCalledExactlyOnceWith("cancel", 46);
    expect(screen.getByLabelText("CSV de inventario físico")).toHaveValue("");
    expect(screen.getByRole("img", { name: "Accuracy 0%" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeDisabled();
  });
  it("retakes drafts and views confirmed closures in the same preview", async () => {
    const { api } = setup();
    await screen.findByDisplayValue("Noviembre 2026");
    const table = screen.getByRole("table", { name: "Historial de cierres" });
    await userEvent.click(
      within(table).getByRole("button", { name: "Retomar" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeEnabled(),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Usuario")).toHaveValue("Usuario QA");
    await userEvent.click(within(table).getByRole("button", { name: "Ver" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Mes del cierre")).toHaveValue("2026-10"),
    );
    expect(screen.getByLabelText("Usuario")).toHaveValue("Supervisor");
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeDisabled();
    const excel = within(table).getAllByRole("button", { name: "Excel" });
    expect(excel[0]).toBeDisabled();
    await userEvent.click(excel[1]);
    expect(api.closureExport).toHaveBeenCalledExactlyOnceWith(44);
  });
  it("does not cancel an already cancelled draft when the baseline reload fails", async () => {
    const { api } = setup();
    await screen.findByDisplayValue("Noviembre 2026");
    await upload();
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeEnabled(),
    );
    api.closureBootstrap.mockRejectedValueOnce(
      new Error("Baseline no disponible"),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reiniciar carga" }),
    );
    await screen.findAllByText("Baseline no disponible");
    expect(api.closureBatch).toHaveBeenCalledExactlyOnceWith("cancel", 46);
    expect(screen.getByLabelText("CSV de inventario físico")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Reiniciar carga" }),
    );
    await waitFor(() => expect(api.closureBootstrap).toHaveBeenCalledTimes(3));
    expect(api.closureBatch).toHaveBeenCalledOnce();
    expect(screen.getByRole("img", { name: "Accuracy 0%" })).toBeVisible();
  });
  it("keeps the previous draft cancellable after a failed preview request", async () => {
    const { api } = setup();
    await screen.findByDisplayValue("Noviembre 2026");
    await upload();
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeEnabled(),
    );
    await upload("nuevo.csv");
    api.closurePreview.mockRejectedValueOnce(
      new Error("Archivo no disponible"),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    await screen.findAllByText("Archivo no disponible");
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Reiniciar carga" }),
    );
    await waitFor(() =>
      expect(api.closureBatch).toHaveBeenCalledExactlyOnceWith("cancel", 46),
    );
  });
  it("keeps the draft recoverable when cancellation fails and prevents duplicate confirmation", async () => {
    const { api } = setup();
    await screen.findByDisplayValue("Noviembre 2026");
    await upload();
    await userEvent.click(
      screen.getByRole("button", { name: "Validar preview" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeEnabled(),
    );
    api.closureBatch.mockRejectedValueOnce(
      new Error("Cancelación no disponible"),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reiniciar carga" }),
    );
    await screen.findAllByText("Cancelación no disponible");
    expect(screen.getByRole("img", { name: "Accuracy 50%" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    ).toBeEnabled();
    let complete!: (value: object) => void;
    api.closureBatch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    await userEvent.dblClick(
      screen.getByRole("button", { name: "Confirmar cierre" }),
    );
    expect(api.closureBatch).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "Regresar a inventario" }),
    ).toBeDisabled();
    await act(async () => complete({ success: true }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar cierre" }),
      ).toBeDisabled(),
    );
  });
  it("validates the file before sending a request", async () => {
    const { api } = setup();
    await screen.findByDisplayValue("Noviembre 2026");
    fireEvent.click(screen.getByRole("button", { name: "Validar preview" }));
    await screen.findByText("Debes seleccionar un archivo CSV para validar.");
    expect(api.closurePreview).not.toHaveBeenCalled();
  });
});
