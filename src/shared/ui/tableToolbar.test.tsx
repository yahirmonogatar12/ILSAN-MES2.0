import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { FilterBar } from "./FilterBar";
import { Card } from "./Layout";
import { TableToolbar } from "./TableToolbar";

const defaults = { q: "" };
const fields = [
  { key: "q" as const, label: "Buscar material", type: "search" as const },
];
describe("barra compartida de filtros y acciones de tabla", () => {
  it("mantiene actualizar, exportar y alta fuera del formulario de consulta", async () => {
    const submit = vi.fn(),
      refresh = vi.fn(),
      exportFile = vi.fn(),
      create = vi.fn();
    render(
      <FilterBar
        fields={fields}
        values={defaults}
        defaults={defaults}
        onChange={() => {}}
        onReset={() => {}}
        onSubmit={submit}
        actions={
          <>
            <Button onClick={refresh}>Actualizar</Button>
            <Button onClick={exportFile}>Exportar Excel</Button>
            <Button onClick={create}>Nuevo material</Button>
          </>
        }
      />,
    );
    const form = screen.getByRole("form", { name: "Filtros de búsqueda" });
    const group = screen.getByRole("group", { name: "Acciones de la tabla" });
    expect(form.parentElement?.parentElement).toBe(group.parentElement);
    for (const name of ["Actualizar", "Exportar Excel", "Nuevo material"]) {
      const button = within(group).getByRole("button", { name });
      expect(button.closest("form")).toBeNull();
      await userEvent.click(button);
    }
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(exportFile).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.submit(form);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("mantiene las acciones junto al botón de filtros en pantallas compactas", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const submit = vi.fn(),
      exportFile = vi.fn();
    render(
      <FilterBar
        fields={fields}
        values={defaults}
        defaults={defaults}
        onChange={() => {}}
        onReset={() => {}}
        onSubmit={submit}
        actions={<Button onClick={exportFile}>Exportar Excel</Button>}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Exportar Excel" }),
    );
    expect(exportFile).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const dialog = screen.getByRole("dialog", { name: "Filtros" });
    expect(
      screen.getByRole("button", { name: "Exportar Excel" }).closest("dialog"),
    ).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Consultar" }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("muestra solo las acciones cuando una tabla no necesita filtros", () => {
    render(
      <FilterBar
        fields={[]}
        values={{}}
        defaults={{}}
        onChange={() => {}}
        onReset={() => {}}
        onSubmit={() => {}}
        actions={<Button>Actualizar</Button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Actualizar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Consultar" }),
    ).not.toBeInTheDocument();
  });
  it("conserva el nombre accesible del listado sin un encabezado visible", () => {
    render(
      <Card fill label="Materiales registrados">
        <p>Contenido de la tabla</p>
      </Card>,
    );
    expect(
      screen.getByRole("region", { name: "Materiales registrados" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Materiales registrados"),
    ).not.toBeInTheDocument();
  });
  it("admite filtros propios sin anidar sus acciones en el formulario", async () => {
    const submit = vi.fn(),
      exportFile = vi.fn();
    render(
      <TableToolbar
        actions={<Button onClick={exportFile}>Exportar Excel</Button>}
      >
        <form
          aria-label="Importar códigos"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Button type="submit">Consultar archivo</Button>
        </form>
      </TableToolbar>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Exportar Excel" }),
    );
    expect(exportFile).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });
});
