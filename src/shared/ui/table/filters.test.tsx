import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataGrid } from "./DataGrid";
import { cellText, distinctValues, filterTableRows } from "./tableFilters";
import type { TableColumn } from "./types";

interface Record {
  id: number;
  area: string;
  quantity: number;
}
const records: Record[] = [
  { id: 1, area: "SMD", quantity: 2 },
  { id: 2, area: "IMD", quantity: 10 },
  { id: 3, area: "SMD", quantity: 20 },
  { id: 4, area: "", quantity: 10 },
];
const columns: TableColumn<Record>[] = [
  { id: "id", header: "ID", cell: (row) => row.id, sortValue: (row) => row.id },
  { id: "area", header: "Área", cell: (row) => row.area },
  {
    id: "quantity",
    header: "Cantidad",
    cell: (row) => row.quantity,
    sortValue: (row) => row.quantity,
  },
  { id: "actions", header: "Acciones", cell: () => null, filterable: false },
];
function mount() {
  return render(
    <DataGrid
      label="Registros"
      rows={records}
      columns={columns}
      rowKey={(row) => row.id}
      initialPageSize={2}
    />,
  );
}
async function openFilter(name: string) {
  await userEvent.click(
    screen.getByRole("button", { name: `Filtrar ${name}` }),
  );
  return screen.getByRole("dialog", { name: `Filtrar ${name}` });
}
describe("filtros de columna tipo Excel, conservando la tabla", () => {
  it("presenta valores únicos, ordena números y deja las celdas vacías al final", () => {
    expect(distinctValues(["10", " 2 ", "", "2", "100", " "])).toEqual([
      "2",
      "10",
      "100",
      "",
    ]);
  });
  it("combina valores de una columna con OR y columnas con AND, sin mutar datos", () => {
    const result = filterTableRows(records, columns, {
      area: ["SMD", "IMD"],
      quantity: ["10", "20"],
    });
    expect(result.map((row) => row.id)).toEqual([2, 3]);
    expect(
      filterTableRows(records, columns, { area: [""] }).map((row) => row.id),
    ).toEqual([4]);
    expect(
      filterTableRows(records, columns, { actions: ["imposible"] }),
    ).toEqual(records);
    expect(records).toHaveLength(4);
  });
  it("usa el texto definido por el módulo para componentes de celda propios", () => {
    const column: TableColumn<Record> = {
      id: "area",
      header: "Área",
      cell: () => <span>Decoración</span>,
      textValue: (row) => row.area,
    };
    expect(cellText(column, records[0])).toBe("SMD");
    expect(filterTableRows(records, [column], { area: ["IMD"] })).toEqual([
      records[1],
    ]);
  });
  it("filtra todo el listado antes de paginar y ofrece los valores de otras páginas", async () => {
    mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    const dialog = await openFilter("Área");
    expect(within(dialog).getByLabelText("IMD")).toBeChecked();
    expect(within(dialog).getByLabelText("(Vacías)")).toBeChecked();
    await userEvent.click(
      within(dialog).getByLabelText("Seleccionar todos los resultados"),
    );
    await userEvent.click(within(dialog).getByLabelText("SMD"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Aplicar" }),
    );
    const table = screen.getByRole("table", { name: "Registros" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("1SMD2");
    expect(rows[2]).toHaveTextContent("3SMD20");
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Filtrar Acciones" }),
    ).not.toBeInTheDocument();
  });
  it("buscar marca las coincidencias y aplicar conserva solo esos valores", async () => {
    mount();
    const dialog = await openFilter("Cantidad");
    await userEvent.type(within(dialog).getByRole("searchbox"), "10");
    expect(within(dialog).getByLabelText("10")).toBeChecked();
    expect(within(dialog).queryByLabelText("2")).not.toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Aplicar" }),
    );
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("2IMD10");
    expect(rows[2]).toHaveTextContent("410");
    expect(
      screen.getByLabelText("Filtros de columna activos"),
    ).toHaveTextContent("Cantidad: 10");
  });
  it("cancelar o Escape no aplica cambios, devuelve el foco y no permite aceptar sin valores", async () => {
    mount();
    let dialog = await openFilter("Área");
    await userEvent.click(
      within(dialog).getByLabelText("Seleccionar todos los resultados"),
    );
    expect(
      within(dialog).getByRole("button", { name: "Aplicar" }),
    ).toBeDisabled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    );
    expect(
      screen.queryByLabelText("Filtros de columna activos"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrar Área" })).toHaveFocus();
    dialog = await openFilter("Área");
    await userEvent.type(within(dialog).getByRole("searchbox"), "SMD");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Filtros de columna activos"),
    ).not.toBeInTheDocument();
  });
  it("permite quitar filtros después de una combinación sin coincidencias", async () => {
    mount();
    for (const [name, value] of [
      ["Área", "SMD"],
      ["Cantidad", "10"],
    ]) {
      const dialog = await openFilter(name);
      await userEvent.type(within(dialog).getByRole("searchbox"), value);
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Aplicar" }),
      );
    }
    expect(
      screen.getByText("Sin coincidencias en la tabla"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filtrar Área" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Quitar filtro de esta columna" }),
    );
    expect(
      screen.queryByText("Sin coincidencias en la tabla"),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Limpiar filtros de tabla" }),
    );
    expect(
      screen.queryByLabelText("Filtros de columna activos"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Página siguiente" }),
    ).toBeEnabled();
  });
  it("agrega resultados de una búsqueda a un filtro existente", async () => {
    mount();
    let dialog = await openFilter("Área");
    await userEvent.type(within(dialog).getByRole("searchbox"), "SMD");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Aplicar" }),
    );
    dialog = await openFilter("Área");
    await userEvent.type(within(dialog).getByRole("searchbox"), "IMD");
    await userEvent.click(
      within(dialog).getByLabelText("Agregar a la selección actual"),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Aplicar" }),
    );
    expect(
      screen.getByLabelText("Filtros de columna activos"),
    ).toHaveTextContent("Área: 2 valores");
    expect(
      screen.getByRole("button", { name: "Página siguiente" }),
    ).toBeEnabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    expect(
      within(screen.getByRole("table")).getAllByRole("row")[1],
    ).toHaveTextContent("3SMD20");
  });
  it("cerrar al pulsar fuera descarta la selección sin aplicar", async () => {
    mount();
    const dialog = await openFilter("Área");
    await userEvent.type(within(dialog).getByRole("searchbox"), "IMD");
    await userEvent.click(screen.getByRole("button", { name: /^ID$/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Filtros de columna activos"),
    ).not.toBeInTheDocument();
  });
});
