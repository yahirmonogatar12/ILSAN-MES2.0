import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";

describe("Valores en filtros de consultas paginadas", () => {
  it("muestra valores únicos, conserva cero y aplica la elección mediante el contrato remoto", async () => {
    const change = vi.fn();
    render(
      <DataTable
        label="Consulta"
        rows={[
          { id: 1, value: "M1" },
          { id: 2, value: "M1" },
          { id: 3, value: "0" },
          { id: 4, value: "" },
        ]}
        columns={[
          {
            id: "value",
            header: "Línea",
            cell: (row) => <span>{row.value || "—"}</span>,
            textValue: (row) => row.value,
          },
        ]}
        rowKey={(row) => row.id}
        onColumnSearchChange={change}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar Línea" }),
    );
    const popup = screen.getByRole("dialog", { name: "Filtrar Línea" });
    const values = within(popup).getByRole("group", {
      name: "Valores de Línea",
    });
    expect(within(values).getAllByRole("button")).toHaveLength(2);
    expect(
      within(values).queryByRole("button", { name: "—" }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(values).getByRole("button", { name: "0" }));
    expect(within(popup).getByRole("searchbox")).toHaveValue("0");
    expect(change).not.toHaveBeenCalled();
    await userEvent.click(
      within(popup).getByRole("button", { name: "Aplicar" }),
    );
    expect(change).toHaveBeenCalledExactlyOnceWith("value", "0");
  });

  it("usa las opciones suministradas por la API y conserva la búsqueda libre fuera de la página", async () => {
    const change = vi.fn();
    render(
      <DataTable
        label="Consulta"
        rows={[{ id: 1, line: "M1" }]}
        columns={[{ id: "line", header: "Línea", cell: (row) => row.line }]}
        rowKey={(row) => row.id}
        filterOptions={{ line: ["M1", "M2", "M2"] }}
        onColumnSearchChange={change}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar Línea" }),
    );
    const popup = screen.getByRole("dialog", { name: "Filtrar Línea" });
    expect(
      within(popup).getByRole("button", { name: "M2" }),
    ).toBeInTheDocument();
    fireEvent.change(within(popup).getByRole("searchbox"), {
      target: { value: "OTRA/01-A" },
    });
    expect(
      within(popup).getByText("Sin coincidencias en los valores cargados."),
    ).toBeInTheDocument();
    await userEvent.click(
      within(popup).getByRole("button", { name: "Aplicar" }),
    );
    expect(change).toHaveBeenCalledExactlyOnceWith("line", "OTRA/01-A");
  });

  it("traduce una duración visible al criterio en segundos que acepta el servidor", async () => {
    const change = vi.fn();
    render(
      <DataTable
        label="Paros"
        rows={[{ id: 1, duration: "36.4s", seconds: 36.4 }]}
        columns={[
          {
            id: "duration",
            header: "Duración",
            cell: (row) => row.duration,
            searchValue: (row) => String(row.seconds),
            searchLabel: "Mínimo en segundos",
          },
        ]}
        rowKey={(row) => row.id}
        onColumnSearchChange={change}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar Duración" }),
    );
    const popup = screen.getByRole("dialog", { name: "Filtrar Duración" });
    expect(within(popup).getByText("Mínimo en segundos")).toBeInTheDocument();
    await userEvent.click(within(popup).getByRole("button", { name: "36.4s" }));
    await userEvent.click(
      within(popup).getByRole("button", { name: "Aplicar" }),
    );
    expect(change).toHaveBeenCalledExactlyOnceWith("duration", "36.4");
  });

  it("ofrece valores de las filas virtualizadas que todavía no se montaron", async () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({
      id: index,
      code: "PARTE-" + index,
    }));
    render(
      <DataTable
        label="Consulta"
        rows={rows}
        virtualRows={{ rowHeight: 32 }}
        columns={[{ id: "code", header: "Parte", cell: (row) => row.code }]}
        rowKey={(row) => row.id}
        onColumnSearchChange={() => undefined}
      />,
    );
    expect(
      screen.queryByRole("cell", { name: "PARTE-499" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar Parte" }),
    );
    const popup = screen.getByRole("dialog", { name: "Filtrar Parte" });
    fireEvent.change(within(popup).getByRole("searchbox"), {
      target: { value: "PARTE-499" },
    });
    expect(
      within(popup).getByRole("button", { name: "PARTE-499" }),
    ).toBeInTheDocument();
  });

  it("permite quitar un criterio aunque la consulta haya devuelto cero filas", async () => {
    const change = vi.fn();
    render(
      <DataTable
        label="Consulta"
        rows={[] as { id: number; value: string }[]}
        columns={[{ id: "value", header: "Valor", cell: (row) => row.value }]}
        rowKey={(row) => row.id}
        columnSearches={{ value: "ausente" }}
        onColumnSearchChange={change}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Filtrar Valor" }),
    );
    const popup = screen.getByRole("dialog", { name: "Filtrar Valor" });
    expect(
      within(popup).getByText("Sin valores cargados."),
    ).toBeInTheDocument();
    await userEvent.click(
      within(popup).getByRole("button", { name: "Quitar filtro" }),
    );
    expect(change).toHaveBeenCalledExactlyOnceWith("value", "");
  });
});
