import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { AppProviders } from "@/app/providers";
import * as adapter from "./api";
import { defaults } from "./model";
import type { Plan } from "./types";

afterEach(() => vi.restoreAllMocks());
function mount(subAssy: string | null = null) {
  const plan: Plan = {
    lot_no: "ASSY-01/A+02&B",
    working_date: defaults().start,
    part_no: "ACQ-0001",
    sub_assy: subAssy,
    model_code: "Modelo inicial",
    project: "Proyecto inicial",
    line: "M1",
    group_no: 1,
    sequence: 1,
    plan_count: 100,
    ct: 10,
    uph: 1000,
    status: "PLAN",
  };
  const base = adapter.createApi("demo");
  const plans = vi.fn<typeof base.plans>().mockResolvedValue([plan]);
  const action = vi
    .fn<typeof base.action>()
    .mockResolvedValue({ success: true });
  vi.spyOn(adapter, "createApi").mockReturnValue({
    ...base,
    plans,
    action,
    revisions: vi.fn().mockResolvedValue([]),
  });
  localStorage.setItem("mes-v2:mode", JSON.stringify("demo"));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("La demo no usa HTTP");
    }),
  );
  const rendered = render(
    <MemoryRouter initialEntries={["/proceso/produccion-assy"]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
  return { ...rendered, plan, plans, action };
}
async function edit() {
  await userEvent.click(
    await screen.findByRole("button", { name: "Editar ASSY-01/A+02&B" }),
  );
  return within(
    screen.getByRole("dialog", { name: "Editar plan ASSY · ASSY-01/A+02&B" }),
  );
}

describe("ASSY sub-assy reload from RAW", () => {
  it.each([null, "PCB-ANTERIOR"])(
    "reloads %s without replacing edits or sending a write",
    async (previous) => {
      const { plan, plans, action } = mount(previous);
      const modal = await edit();
      const quantity = modal.getByLabelText(/^Cantidad del plan/);
      const model = modal.getByLabelText("Modelo");
      await userEvent.clear(quantity);
      await userEvent.type(quantity, "125");
      await userEvent.clear(model);
      await userEvent.type(model, "Mi modelo capturado");
      plans.mockResolvedValue([
        {
          ...plan,
          sub_assy: "PCB/0001+A&B",
          plan_count: 999,
          model_code: "Otro modelo RAW",
        },
      ]);
      await userEvent.click(
        modal.getByRole("button", { name: "Recargar sub-assy" }),
      );
      await waitFor(() =>
        expect(modal.getByLabelText("Sub-assy / PCB")).toHaveValue(
          "PCB/0001+A&B",
        ),
      );
      expect(modal.getByLabelText("Sub-assy / PCB")).toHaveAttribute(
        "readonly",
      );
      expect(quantity).toHaveValue(125);
      expect(model).toHaveValue("Mi modelo capturado");
      expect(plans).toHaveBeenCalledTimes(2);
      expect(plans.mock.calls[1]).toEqual([
        "ASSY",
        expect.objectContaining({
          start: plan.working_date,
          end: plan.working_date,
        }),
        expect.any(AbortSignal),
      ]);
      expect(action).not.toHaveBeenCalled();
      await userEvent.click(
        modal.getByRole("button", { name: "Guardar plan" }),
      );
      await waitFor(() => expect(action).toHaveBeenCalledOnce());
      expect(action.mock.calls[0]).toEqual([
        "ASSY",
        "update",
        expect.objectContaining({
          lot_no: plan.lot_no,
          plan_count: 125,
          model_code: "Mi modelo capturado",
        }),
      ]);
      expect(action.mock.calls[0][2]).not.toHaveProperty("sub_assy");
    },
  );
  it("updates the table after closing without requiring a plan save", async () => {
    const { plan, plans, action } = mount();
    const modal = await edit();
    plans.mockResolvedValue([{ ...plan, sub_assy: "PCB-NUEVA" }]);
    await userEvent.click(
      modal.getByRole("button", { name: "Recargar sub-assy" }),
    );
    await modal.findByText("Sub-assy actualizado desde RAW.");
    await userEvent.click(modal.getByRole("button", { name: "Cancelar" }));
    expect(
      within(screen.getByRole("table", { name: "Planes ASSY" })).getByText(
        "PCB-NUEVA",
      ),
    ).toBeVisible();
    expect(action).not.toHaveBeenCalled();
  });
  it("clears a removed PCB and reports when RAW still has no sub-assy", async () => {
    const { plan, plans } = mount("PCB-ELIMINADA");
    const modal = await edit();
    plans.mockResolvedValue([{ ...plan, sub_assy: null }]);
    await userEvent.click(
      modal.getByRole("button", { name: "Recargar sub-assy" }),
    );
    await modal.findByText(
      "RAW todavía no tiene un sub-assy / PCB configurado para esta parte.",
    );
    expect(modal.getByLabelText("Sub-assy / PCB")).toHaveValue("");
  });
  it("preserves the previous PCB after a failure and allows an explicit retry", async () => {
    const { plan, plans } = mount("PCB-ANTERIOR");
    const modal = await edit();
    plans.mockRejectedValueOnce(new Error("RAW no disponible"));
    await userEvent.click(
      modal.getByRole("button", { name: "Recargar sub-assy" }),
    );
    await modal.findByText("RAW no disponible");
    expect(modal.getByLabelText("Sub-assy / PCB")).toHaveValue("PCB-ANTERIOR");
    plans.mockResolvedValue([{ ...plan, sub_assy: "PCB-RECUPERADA" }]);
    await userEvent.click(
      modal.getByRole("button", { name: "Recargar sub-assy" }),
    );
    await waitFor(() =>
      expect(modal.getByLabelText("Sub-assy / PCB")).toHaveValue(
        "PCB-RECUPERADA",
      ),
    );
    expect(modal.queryByText("RAW no disponible")).toBeNull();
  });
  it("matches the selected lot and reports when that plan has disappeared", async () => {
    const { plan, plans } = mount("PCB-ANTERIOR");
    const modal = await edit();
    plans.mockResolvedValue([
      { ...plan, lot_no: "OTRO-LOTE", sub_assy: "PCB-OTRA" },
    ]);
    await userEvent.click(
      modal.getByRole("button", { name: "Recargar sub-assy" }),
    );
    await modal.findByText(
      "El plan ya no está disponible. Actualiza la tabla para consultarlo.",
    );
    expect(modal.getByLabelText("Sub-assy / PCB")).toHaveValue("PCB-ANTERIOR");
  });
  it("blocks duplicate reads, edits, save and close during reload and aborts on unmount", async () => {
    const { plans, action, unmount, plan } = mount();
    const modal = await edit();
    let finish!: (value: Plan[]) => void;
    plans.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await userEvent.dblClick(
      modal.getByRole("button", { name: "Recargar sub-assy" }),
    );
    expect(plans).toHaveBeenCalledTimes(2);
    expect(modal.getByRole("button", { name: "Guardar plan" })).toBeDisabled();
    expect(modal.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(modal.getByLabelText(/^Cantidad del plan/)).toBeDisabled();
    const signal = plans.mock.calls[1][2];
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => finish([{ ...plan, sub_assy: "PCB-TARDIA" }]));
    expect(action).not.toHaveBeenCalled();
  });
});
