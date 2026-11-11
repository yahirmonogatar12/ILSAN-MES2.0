import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  ConfirmDialog,
  FilterBar,
  FormActions,
  Modal,
  SelectField,
  TextField,
  TextareaField,
  type FilterField,
} from "./index";
import { useForm } from "../hooks/useForm";

describe("controles compartidos", () => {
  it("conserva valores de cadena para filtros numéricos y checkbox", async () => {
    const defaults = { minimum: "", include: "0" };
    function Filters() {
      const [values, setValues] = useState(defaults);
      return (
        <FilterBar
          fields={[
            {
              key: "minimum",
              label: "Duración mínima",
              type: "number",
              min: 0,
              step: "any",
            },
            {
              key: "include",
              label: "Incluir detecciones cortas",
              type: "checkbox",
            },
          ]}
          values={values}
          defaults={defaults}
          onChange={(patch) =>
            setValues((previous) => ({ ...previous, ...patch }))
          }
          onSubmit={() => undefined}
          onReset={() => setValues(defaults)}
        />
      );
    }
    render(<Filters />);
    const minimum = screen.getByRole("spinbutton", { name: "Duración mínima" });
    expect(minimum).toHaveAttribute("min", "0");
    expect(minimum).toHaveAttribute("step", "any");
    await userEvent.type(minimum, "0.4");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Incluir detecciones cortas" }),
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(
      screen.getByRole("button", {
        name: "Quitar filtro Incluir detecciones cortas",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toHaveAccessibleName(
      "Incluir detecciones cortas",
    );
    await userEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(minimum).toHaveValue(null);
  });
  it("un botón auxiliar no envía el formulario y bloquea la acción durante la carga", async () => {
    const submit = vi.fn(),
      action = vi.fn();
    const { rerender } = render(
      <form onSubmit={submit}>
        <Button onClick={action}>Auxiliar</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Auxiliar" }));
    expect(action).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    rerender(
      <Button loading onClick={action}>
        Auxiliar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Auxiliar" }));
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("campos de dos formularios tienen IDs únicos y errores asociados", () => {
    render(
      <>
        <TextField label="Nombre" hint="Ayuda" />
        <TextField label="Nombre" error="Requerido" />
        <SelectField
          label="Estado"
          options={[{ value: "a", label: "Activo" }]}
        />
        <TextareaField label="Notas" />
      </>,
    );
    const fields = screen.getAllByLabelText("Nombre");
    expect(fields[0].id).not.toBe(fields[1].id);
    expect(fields[0]).toHaveAccessibleDescription("Ayuda");
    expect(fields[1]).toHaveAccessibleDescription("Requerido");
    expect(fields[1]).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Estado")).toBeInTheDocument();
    expect(screen.getByLabelText("Notas")).toBeInTheDocument();
  });
  it("un diálogo no se cierra con Escape mientras procesa y restaura el foco", async () => {
    const close = vi.fn();
    const { rerender, unmount } = render(<Button>Origen</Button>);
    const origin = screen.getByRole("button", { name: "Origen" });
    origin.focus();
    rerender(
      <>
        <Button>Origen</Button>
        <Modal title="Operación" busy onClose={close}>
          <TextField label="Código" initialFocus />
        </Modal>
      </>,
    );
    expect(screen.getByLabelText("Código")).toHaveFocus();
    fireEvent(
      screen.getByRole("dialog", { name: "Operación" }),
      new Event("cancel", { cancelable: true }),
    );
    expect(close).not.toHaveBeenCalled();
    rerender(
      <>
        <Button>Origen</Button>
        <Modal title="Operación" onClose={close}>
          Lista
        </Modal>
      </>,
    );
    fireEvent(
      screen.getByRole("dialog", { name: "Operación" }),
      new Event("cancel", { cancelable: true }),
    );
    expect(close).toHaveBeenCalledOnce();
    unmount();
  });
  it("ConfirmDialog reutiliza confirmación, error y bloqueo de envío", async () => {
    const confirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        title="Eliminar registro"
        onConfirm={confirm}
        onClose={() => {}}
      >
        Revisa los datos.
      </ConfirmDialog>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(confirm).toHaveBeenCalledOnce();
    rerender(
      <ConfirmDialog
        title="Eliminar registro"
        pending
        error={new Error("Conflicto")}
        onConfirm={confirm}
        onClose={() => {}}
      >
        Revisa los datos.
      </ConfirmDialog>,
    );
    expect(screen.getByText("Conflicto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
  });
  it("FilterBar admite filtros de otro dominio y restablece sus valores", async () => {
    const submit = vi.fn();
    const defaults = { nombre: "", estado: "" };
    const fields: FilterField<typeof defaults>[] = [
      { key: "nombre", label: "Cliente", type: "search" },
      {
        key: "estado",
        label: "Estado",
        type: "select",
        options: [
          { value: "", label: "Todos" },
          { value: "activo", label: "Activo" },
        ],
      },
    ];
    function Example() {
      const [values, setValues] = useState(defaults);
      return (
        <FilterBar
          fields={fields}
          values={values}
          defaults={defaults}
          onChange={(patch) =>
            setValues((previous) => ({ ...previous, ...patch }))
          }
          onReset={() => setValues(defaults)}
          onSubmit={submit}
        />
      );
    }
    render(<Example />);
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Cliente" }),
      "Acme",
    );
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "activo");
    expect(screen.getByText("Filtros activos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    expect(submit).toHaveBeenCalledOnce();
    await userEvent.click(
      screen.getByRole("button", { name: "Limpiar todos" }),
    );
    expect(screen.getByRole("searchbox", { name: "Cliente" })).toHaveValue("");
    expect(screen.getByLabelText("Estado")).toHaveValue("");
  });
  it("en una ventana muy baja permite consultar y limpiar filtros desde el diálogo compacto", async () => {
    const media = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    const submit = vi.fn();
    function Example() {
      const defaults = { cliente: "" };
      const [values, setValues] = useState(defaults);
      return (
        <FilterBar
          fields={[{ key: "cliente", label: "Cliente", type: "search" }]}
          values={values}
          defaults={defaults}
          onChange={(patch) =>
            setValues((previous) => ({ ...previous, ...patch }))
          }
          onSubmit={submit}
          onReset={() => setValues(defaults)}
        />
      );
    }
    try {
      render(<Example />);
      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
      const dialog = screen.getByRole("dialog", { name: "Filtros" });
      await userEvent.type(
        within(dialog).getByRole("searchbox", { name: "Cliente" }),
        "Acme",
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Consultar" }),
      );
      expect(submit).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Filtros (1)" })).toHaveFocus();
      await userEvent.click(
        screen.getByRole("button", { name: "Filtros (1)" }),
      );
      expect(screen.getByRole("searchbox", { name: "Cliente" })).toHaveValue(
        "Acme",
      );
      await userEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cerrar ventana",
        }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Limpiar filtros" }),
      );
      expect(
        screen.getByRole("button", { name: "Filtros" }),
      ).toBeInTheDocument();
    } finally {
      media.mockRestore();
    }
  });
  it("useForm conserva valores durante el envío y evita dos escrituras simultáneas", async () => {
    let finish: (() => void) | undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    function Example() {
      const form = useForm({
        initialValues: { nombre: "Inicial" },
        validate: (values) => (values.nombre ? [] : ["Requerido"]),
        onSubmit: save,
      });
      return (
        <form aria-label="Ejemplo" onSubmit={form.handleSubmit}>
          <TextField
            label="Nombre"
            value={form.values.nombre}
            onChange={(event) => form.setField("nombre", event.target.value)}
          />
          <FormActions pending={form.pending} onCancel={() => {}} />
        </form>
      );
    }
    render(<Example />);
    const form = screen.getByRole("form", { name: "Ejemplo" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Inicial");
    await act(async () => finish?.());
  });
  it("useForm muestra el error del servidor sin perder lo capturado", async () => {
    function Example() {
      const form = useForm({
        initialValues: { nombre: "Capturado" },
        validate: () => [],
        onSubmit: async () => {
          throw new Error("Conflicto de registro");
        },
      });
      return (
        <form aria-label="Ejemplo" onSubmit={form.handleSubmit}>
          <TextField label="Nombre" value={form.values.nombre} readOnly />
          {form.error && <p role="alert">{form.error.message}</p>}
          <FormActions pending={form.pending} onCancel={() => {}} />
        </form>
      );
    }
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Conflicto de registro",
    );
    expect(screen.getByLabelText("Nombre")).toHaveValue("Capturado");
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });
  it("varios modales no comparten identificadores de título", () => {
    render(
      <>
        <Modal title="Uno" onClose={() => {}}>
          A
        </Modal>
        <Modal title="Dos" onClose={() => {}}>
          B
        </Modal>
      </>,
    );
    const first = screen.getByRole("dialog", { name: "Uno" }),
      second = screen.getByRole("dialog", { name: "Dos" });
    expect(first.getAttribute("aria-labelledby")).not.toBe(
      second.getAttribute("aria-labelledby"),
    );
    expect(within(second).getByText("B")).toBeInTheDocument();
  });
});
