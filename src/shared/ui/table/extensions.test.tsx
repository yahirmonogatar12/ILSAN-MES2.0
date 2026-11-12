import { Activity } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataGrid } from "./DataGrid";
import { DataTable } from "./DataTable";
describe("Composición compartida de resúmenes y filas", () => {
  it("calcula el resumen sobre todas las filas filtradas antes de paginar", async () => {
    const rows = Array.from({ length: 101 }, (_, id) => ({
      id,
      status: id === 100 ? "DONE" : "WAIT",
    }));
    render(
      <DataGrid
        label="Consulta"
        rows={rows}
        columns={[
          { id: "status", header: "Estado", cell: (row) => row.status },
        ]}
        rowKey={(row) => row.id}
        initialPageSize={10}
        summary={(filtered) => <p>{filtered.length} filtradas</p>}
      />,
    );
    expect(screen.getByText("101 filtradas")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      11,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar Estado" }),
    );
    const popup = screen.getByRole("dialog", { name: "Filtrar Estado" });
    await userEvent.type(within(popup).getByRole("searchbox"), "DONE");
    await userEvent.click(
      within(popup).getByRole("button", { name: "Aplicar" }),
    );
    expect(screen.getByText("1 filtradas")).toBeInTheDocument();
  });
  it("entrega eventos y atributos de fila sin duplicar el renderizador de tablas", () => {
    const drag = vi.fn(),
      drop = vi.fn();
    render(
      <DataTable
        label="Orden"
        rows={[{ id: 1 }]}
        columns={[{ id: "id", header: "ID", cell: (row) => row.id }]}
        rowKey={(row) => row.id}
        rowProps={() => ({
          draggable: true,
          onDragStart: drag,
          onDrop: drop,
          className: "selected",
        })}
      />,
    );
    const row = screen.getByRole("cell", { name: "1" }).closest("tr")!;
    expect(row).toHaveAttribute("draggable", "true");
    expect(row).toHaveClass("selected");
    fireEvent.dragStart(row);
    fireEvent.drop(row);
    expect(drag).toHaveBeenCalledOnce();
    expect(drop).toHaveBeenCalledOnce();
  });
  it("starts the next virtual page at its first row and preserves horizontal position", async () => {
    render(
      <DataGrid
        label="Paginación"
        rows={Array.from({ length: 1001 }, (_, id) => ({ id: id + 1 }))}
        columns={[{ id: "id", header: "ID", cell: (row) => "ROW-" + row.id }]}
        rowKey={(row) => row.id}
        virtualRows={{ rowHeight: 20 }}
      />,
    );
    const wrap = screen.getByRole("table").parentElement!;
    wrap.scrollTop = 9950;
    wrap.scrollLeft = 240;
    fireEvent.scroll(wrap);
    await screen.findByRole("cell", { name: "ROW-500" });
    expect(screen.queryByRole("cell", { name: "ROW-1" })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    await screen.findByRole("cell", { name: "ROW-501" });
    expect(wrap.scrollTop).toBe(0);
    expect(wrap.scrollLeft).toBe(240);
  });
  it("keeps the current virtual scroll position when a workspace tab resumes", async () => {
    const grid = (
      <DataGrid
        label="Pestaña"
        rows={Array.from({ length: 500 }, (_, id) => ({ id }))}
        columns={[{ id: "id", header: "ID", cell: (row) => "ROW-" + row.id }]}
        rowKey={(row) => row.id}
        virtualRows={{ rowHeight: 20 }}
      />
    );
    const view = render(<Activity mode="visible">{grid}</Activity>);
    const wrap = screen.getByRole("table").parentElement!;
    wrap.scrollTop = 9950;
    fireEvent.scroll(wrap);
    await screen.findByRole("cell", { name: "ROW-499" });
    view.rerender(<Activity mode="hidden">{grid}</Activity>);
    view.rerender(<Activity mode="visible">{grid}</Activity>);
    await waitFor(() => expect(wrap.scrollTop).toBe(9950));
    expect(screen.getByRole("cell", { name: "ROW-499" })).toBeVisible();
  });
});
