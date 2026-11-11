import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataGrid } from "./DataGrid";
import { DataTable } from "./DataTable";
import type { TableGrouping } from "./types";

type Item = { id: number; section: string; amount: number };
const rows: Item[] = [
  { id: 1, section: "A", amount: 3 },
  { id: 2, section: "B", amount: 2 },
  { id: 3, section: "A", amount: 1 },
  { id: 4, section: "B", amount: 4 },
  { id: 5, section: "A", amount: 5 },
];
const columns = [
  {
    id: "amount",
    header: "Cantidad",
    cell: (row: Item) => row.amount,
    sortValue: (row: Item) => row.amount,
  },
];
const grouping: TableGrouping<Item> = {
  key: (row) => row.section,
  order: ["B", "A", "C"],
  showEmpty: true,
  header: ({ key, rows: items }) =>
    `${key}: ${items.length} registros, total ${items.reduce((sum, row) => sum + row.amount, 0)}`,
};
describe("Secciones de la tabla compartida", () => {
  it("agrupa antes de paginar, ordena dentro de cada sección y filtra sus totales sin contar encabezados", async () => {
    render(
      <DataGrid
        label="Secciones"
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        grouping={grouping}
        initialPageSize={2}
        initialSort={{ columnId: "amount", direction: "desc" }}
      />,
    );
    expect(screen.getByText("B: 2 registros, total 6")).toBeInTheDocument();
    expect(screen.getByText("C: 0 registros, total 0")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table"))
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
        .filter(Boolean),
    ).toEqual(["4", "2"]);
    expect(screen.getByText("de 3")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    expect(
      screen.queryByText("B: 2 registros, total 6"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("A: 3 registros, total 9")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table"))
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
        .filter(Boolean),
    ).toEqual(["5", "3"]);
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar Cantidad" }),
    );
    const filter = screen.getByRole("dialog");
    await userEvent.type(within(filter).getByRole("searchbox"), "5");
    await userEvent.click(
      within(filter).getByRole("button", { name: "Aplicar" }),
    );
    expect(screen.getByText("A: 1 registros, total 5")).toBeInTheDocument();
    expect(
      screen.queryByText("C: 0 registros, total 0"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("de 1")).toBeInTheDocument();
  });
  it("conserva índices y eventos de registros y permite destinos vacíos sin una tabla adicional", () => {
    const onDrop = vi.fn(),
      rowProps = vi.fn(() => ({ draggable: true }));
    render(
      <DataTable
        label="Destinos"
        rows={rows.slice(0, 2)}
        columns={columns}
        rowKey={(row) => row.id}
        rowProps={rowProps}
        grouping={{
          ...grouping,
          dropTarget: ({ key }) => ({
            content: `Soltar en ${key}`,
            rowProps: { onDrop },
          }),
        }}
      />,
    );
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(rowProps).toHaveBeenCalledWith(rows[1], 1);
    expect(rowProps).toHaveBeenCalledWith(rows[0], 0);
    fireEvent.drop(
      screen.getByRole("cell", { name: "Soltar en C" }).closest("tr")!,
    );
    expect(onDrop).toHaveBeenCalledOnce();
  });
});
