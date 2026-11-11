import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditableCell, useCellEditor } from "./EditableCell";

function Cells({
  visible = true,
  value = 1000,
  save,
}: {
  visible?: boolean;
  value?: number;
  save: (value: string) => Promise<string | void>;
}) {
  const editor = useCellEditor();
  return (
    <>
      {visible && (
        <EditableCell
          editor={editor}
          cellId="A"
          value={value}
          label="Cantidad A"
          onSave={save}
          formatValue={(v) => Number(v).toLocaleString("es-MX")}
        />
      )}
      <EditableCell
        editor={editor}
        cellId="B"
        value={0}
        label="Cantidad B"
        onSave={save}
      />
    </>
  );
}
describe("Edición de celdas compartida", () => {
  it("Enter guarda una vez, Tab sigue a la próxima celda y un valor externo antiguo no revierte el guardado", async () => {
    let finish!: (value: string) => void;
    const save = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<Cells save={save} />);
    const cell = screen.getByRole("textbox", { name: "Cantidad A" });
    expect(cell).toHaveValue("1,000");
    await userEvent.click(cell);
    expect(cell).toHaveValue("1000");
    await userEvent.clear(cell);
    await userEvent.type(cell, "250{Enter}{Enter}");
    expect(save).toHaveBeenCalledExactlyOnceWith("250");
    expect(cell).toHaveAttribute("readonly");
    await userEvent.tab();
    expect(screen.getByRole("textbox", { name: "Cantidad B" })).toHaveFocus();
    expect(save).toHaveBeenCalledTimes(1);
    finish("250");
    await waitFor(() => expect(cell).not.toHaveAttribute("readonly"));
    expect(cell).toHaveValue("250");
    view.rerender(<Cells save={save} value={250} />);
    expect(cell).toHaveValue("250");
  });
  it("Tab guarda al salir; Escape restaura y no envía la captura cancelada", async () => {
    const save = vi.fn(async (value: string) => value);
    render(<Cells save={save} />);
    const cell = screen.getByRole("textbox", { name: "Cantidad A" });
    await userEvent.click(cell);
    await userEvent.clear(cell);
    await userEvent.type(cell, "25{Escape}");
    expect(cell).toHaveValue("1000");
    await userEvent.tab();
    expect(save).not.toHaveBeenCalled();
    await userEvent.click(cell);
    await userEvent.clear(cell);
    await userEvent.type(cell, "0");
    await userEvent.tab();
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith("0"));
  });
  it("conserva captura y error al desmontarse la fila virtual y permite reintentar", async () => {
    const save = vi
      .fn<(value: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("El servidor rechazó la cantidad."))
      .mockResolvedValueOnce("200");
    const view = render(<Cells save={save} />);
    let cell = screen.getByRole("textbox", { name: "Cantidad A" });
    await userEvent.click(cell);
    await userEvent.clear(cell);
    await userEvent.type(cell, "200{Enter}");
    await screen.findByRole("alert");
    expect(cell).toHaveAttribute("aria-invalid", "true");
    await userEvent.tab();
    expect(save).toHaveBeenCalledTimes(1);
    view.rerender(<Cells save={save} visible={false} />);
    view.rerender(<Cells save={save} />);
    cell = screen.getByRole("textbox", { name: "Cantidad A" });
    expect(cell).toHaveValue("200");
    expect(cell).toHaveAttribute("aria-invalid", "true");
    await userEvent.click(cell);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(cell).not.toHaveAttribute("aria-invalid"));
    expect(save).toHaveBeenCalledTimes(2);
  });
  it("retiene una captura sin guardar al virtualizar y no ejecuta escrituras al desmontarse", async () => {
    const save = vi.fn(async (value: string) => value);
    const view = render(<Cells save={save} />);
    const cell = screen.getByRole("textbox", { name: "Cantidad A" });
    await userEvent.click(cell);
    await userEvent.clear(cell);
    await userEvent.type(cell, "123");
    view.rerender(<Cells save={save} visible={false} />);
    expect(save).not.toHaveBeenCalled();
    view.rerender(<Cells save={save} />);
    expect(screen.getByRole("textbox", { name: "Cantidad A" })).toHaveValue(
      "123",
    );
    expect(save).not.toHaveBeenCalled();
  });
  it("conserva el bloqueo de una escritura al virtualizar y no vuelve a enviar al remontar", async () => {
    let finish!: (value: string) => void;
    const save = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<Cells save={save} />);
    await userEvent.click(screen.getByLabelText("Cantidad A"));
    await userEvent.clear(screen.getByLabelText("Cantidad A"));
    await userEvent.type(screen.getByLabelText("Cantidad A"), "200{Enter}");
    view.rerender(<Cells save={save} visible={false} />);
    view.rerender(<Cells save={save} />);
    const cell = screen.getByLabelText("Cantidad A");
    expect(cell).toHaveAttribute("readonly");
    expect(cell).toHaveValue("200");
    await userEvent.click(cell);
    await userEvent.keyboard("{Enter}");
    expect(save).toHaveBeenCalledTimes(1);
    finish("200");
    await waitFor(() => expect(cell).not.toHaveAttribute("readonly"));
    expect(cell).toHaveValue("200");
  });
  it("una actualización externa conserva el borrador y Escape restaura el último valor recibido", async () => {
    const save = vi.fn(async (value: string) => value);
    const view = render(<Cells save={save} />);
    await userEvent.click(screen.getByLabelText("Cantidad A"));
    await userEvent.clear(screen.getByLabelText("Cantidad A"));
    await userEvent.type(screen.getByLabelText("Cantidad A"), "200");
    view.rerender(<Cells save={save} value={300} />);
    expect(screen.getByLabelText("Cantidad A")).toHaveValue("200");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByLabelText("Cantidad A")).toHaveValue("300");
    expect(save).not.toHaveBeenCalled();
  });
});
