import {
  act,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTable } from "./DataTable";
import { Pagination } from "./Pagination";
import { sortRows, useClientTable } from "./useClientTable";
import type { TableColumn } from "./types";

interface Customer {
  id: number;
  nombre: string;
  cantidad: number;
}
const customers: Customer[] = [
  { id: 1, nombre: "Cliente 10", cantidad: 100 },
  { id: 2, nombre: "Cliente 2", cantidad: 2 },
  { id: 3, nombre: "Cliente 1", cantidad: 10 },
];
const columns: TableColumn<Customer>[] = [
  {
    id: "nombre",
    header: "Nombre",
    cell: (row) => row.nombre,
    sortValue: (row) => row.nombre,
  },
  {
    id: "cantidad",
    header: "Cantidad",
    cell: (row) => row.cantidad,
    sortValue: (row) => row.cantidad,
  },
];
function Example() {
  const table = useClientTable(customers, columns, { initialPageSize: 2 });
  return (
    <>
      <DataTable
        label="Clientes"
        rows={table.rows}
        columns={columns}
        rowKey={(row) => row.id}
        sorting={table.sorting}
        onSortChange={table.setSort}
      />
      <Pagination
        {...table}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        itemLabel="clientes"
      />
    </>
  );
}
describe("tabla compartida con modelos ajenos a Materiales", () => {
  it("muestra 500 registros por defecto y pagina sin saltar la fila 501", () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({
      id: index + 1,
      nombre: `Cliente ${index + 1}`,
      cantidad: index,
    }));
    const { result } = renderHook(() => useClientTable(rows, columns));
    expect(result.current.pageSize).toBe(500);
    expect(result.current.rows).toHaveLength(500);
    expect(result.current.rows.at(-1)?.id).toBe(500);
    act(() => result.current.setPage(2));
    expect(result.current.rows.map((row) => row.id)).toEqual([501]);
    act(() => result.current.setPageSize(25));
    expect(result.current.page).toBe(1);
    expect(result.current.rows).toHaveLength(25);
  });
  it("ordena números como números, cambia de página y vuelve al inicio al ordenar", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Cantidad" }));
    let rows = within(
      screen.getByRole("table", { name: "Clientes" }),
    ).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Cliente 2");
    expect(rows[2]).toHaveTextContent("Cliente 1");
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    expect(screen.getByText("Cliente 10")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cantidad" }));
    rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Cliente 10");
    expect(
      screen.getByRole("columnheader", { name: /Cantidad/ }),
    ).toHaveAttribute("aria-sort", "descending");
  });
  it("la paginación vacía no tiene anterior ni siguiente y admite tamaño personalizado", () => {
    render(
      <Pagination
        page={7}
        pageSize={15}
        total={0}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Página siguiente" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Filas por página")).toHaveValue("15");
    expect(screen.getByRole("option", { name: "500" })).toBeInTheDocument();
  });
  it("un mismo componente presenta otro modelo sin propiedades de clientes/materiales", () => {
    interface Machine {
      codigo: string;
      encendida: boolean;
    }
    const machineColumns: TableColumn<Machine>[] = [
      { id: "codigo", header: "Máquina", cell: (row) => row.codigo },
      {
        id: "estado",
        header: "Estado",
        cell: (row) => (row.encendida ? "Encendida" : "Apagada"),
      },
    ];
    render(
      <DataTable
        label="Máquinas"
        rows={[{ codigo: "SMT-01", encendida: true }]}
        columns={machineColumns}
        rowKey={(row) => row.codigo}
      />,
    );
    expect(screen.getByRole("table", { name: "Máquinas" })).toHaveTextContent(
      "SMT-01",
    );
    expect(screen.getByText("Encendida")).toBeInTheDocument();
  });
  it("el estado de carga/error no se confunde con un catálogo vacío", () => {
    const { rerender } = render(
      <DataTable
        label="Clientes"
        rows={[]}
        columns={columns}
        rowKey={(row) => row.id}
        loading
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Sin registros")).not.toBeInTheDocument();
    rerender(
      <DataTable
        label="Clientes"
        rows={[]}
        columns={columns}
        rowKey={(row) => row.id}
        error={new Error("Sin conexión")}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión");
    expect(screen.queryByRole("status")).toBeNull();
    rerender(
      <DataTable
        label="Clientes"
        rows={customers}
        columns={columns}
        rowKey={(row) => row.id}
      />,
    );
    expect(screen.getByRole("table", { name: "Clientes" })).toHaveTextContent(
      "Cliente 10",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("el ordenamiento respeta la entrada y compara fechas y nulos", () => {
    const original = [...customers];
    expect(
      sortRows(customers, columns, {
        columnId: "nombre",
        direction: "asc",
      }).map((row) => row.nombre),
    ).toEqual(["Cliente 1", "Cliente 2", "Cliente 10"]);
    expect(customers).toEqual(original);
    const dates = [
      { id: 1, fecha: new Date("2026-01-02") },
      { id: 2, fecha: null },
      { id: 3, fecha: new Date("2026-01-01") },
    ];
    expect(
      sortRows(
        dates,
        [
          {
            id: "fecha",
            header: "Fecha",
            cell: () => null,
            sortValue: (row) => row.fecha,
          },
        ],
        { columnId: "fecha", direction: "asc" },
      ).map((row) => row.id),
    ).toEqual([3, 1, 2]);
  });
});
