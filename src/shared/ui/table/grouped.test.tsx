import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";
it("mantiene grupos completos y celdas combinadas al recorrer una tabla con ventanas", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  const rows = Array.from({ length: 500 }, (_, index) =>
    ["P", "S", "I"].map((kind) => ({ part: `PART-${index}`, kind })),
  ).flat();
  render(
    <DataTable
      label="Grupos P/S/I"
      rows={rows}
      rowKey={(row) => `${row.part}-${row.kind}`}
      columns={[
        {
          id: "part",
          header: "PARTE",
          cell: (row) => row.part,
          cellSpan: (row) => ({ rowSpan: row.kind === "P" ? 3 : 0 }),
        },
        { id: "kind", header: "TIPO", cell: (row) => row.kind },
      ]}
      virtualRows={{ rowHeight: 26, groupSize: 3 }}
    />,
  );
  const table = screen.getByRole("table"),
    wrap = table.parentElement!;
  expect(table).toHaveAttribute("aria-rowcount", "1501");
  expect(screen.getByRole("cell", { name: "PART-0" })).toHaveAttribute(
    "rowspan",
    "3",
  );
  expect(
    table.querySelectorAll("tbody tr:not([aria-hidden])").length,
  ).toBeLessThan(1500);
  wrap.scrollTop = 39000;
  fireEvent.scroll(wrap);
  await screen.findByRole("cell", { name: "PART-499" });
  expect(screen.getByRole("cell", { name: "PART-499" })).toHaveAttribute(
    "rowspan",
    "3",
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("cell", { name: "PART-0" }),
    ).not.toBeInTheDocument(),
  );
  expect(table.querySelectorAll("tbody tr:not([aria-hidden])").length % 3).toBe(
    0,
  );
});
it("permite combinar columnas sin crear celdas cubiertas adicionales", () => {
  render(
    <DataTable
      label="Combinadas"
      rows={[{ id: 1 }]}
      rowKey={(row) => row.id}
      columns={[
        {
          id: "title",
          header: "A",
          cell: () => "Título",
          cellSpan: () => ({ colSpan: 2 }),
        },
        {
          id: "covered",
          header: "B",
          cell: () => "Oculta",
          cellSpan: () => ({ colSpan: 0 }),
        },
      ]}
    />,
  );
  expect(screen.getByRole("cell", { name: "Título" })).toHaveAttribute(
    "colspan",
    "2",
  );
  expect(
    screen.queryByRole("cell", { name: "Oculta" }),
  ).not.toBeInTheDocument();
});
