import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EcoDifferences } from "./EcoDifferences";
import { singleEcoModel } from "./model";
import type { Diff, EcoDetail } from "./types";

const empty: Diff = {
  added: [],
  modified: [],
  removed: [],
  modified_admin: [],
  counts: { added: 0, modified: 0, removed: 0, modified_admin: 0 },
};
const eco: EcoDetail = {
  id: 1,
  eco_no: "ECO-1",
  part_no: "MODELO-A",
  bom_revision: "01",
  status: "DRAFT",
  origen: "MES",
  effective_at: "2026-11-05",
  items: [],
};

describe("presentación de diferencias ECO", () => {
  it("muestra campo legible, valores antes/después y cero sin alterar modelos explícitos", () => {
    render(
      <EcoDifferences
        model="MODELO-A"
        diff={{
          ...empty,
          modified: [
            {
              part_no: "MODELO-B",
              item_no: "PARTE-1",
              bom_level: "01",
              field_changed: "qty",
              old_value: 0,
              new_value: 5,
            },
            {
              item_no: "PARTE-2",
              field_changed: "toString",
              old_value: "original",
              new_value: "propuesto",
            },
          ],
          counts: { ...empty.counts, modified: 2 },
        }}
      />,
    );
    const table = screen.getByRole("table", { name: "Modificados del ECO" });
    const cells = within(
      within(table).getByRole("row", { name: /PARTE-1/ }),
    ).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "MODELO-B",
      "01",
      "PARTE-1",
      "Cantidad",
      "0",
      "5",
    ]);
    expect(
      within(table).getByRole("row", { name: /PARTE-2/ }),
    ).toHaveTextContent("MODELO-A");
    expect(within(table).getByText("toString")).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: /ANTES/ }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: /DESPUÉS/ }),
    ).toBeInTheDocument();
  });
  it("conserva ubicación, maker y proveedor de un añadido y separa la eliminación", async () => {
    render(
      <EcoDifferences
        model="MODELO-A"
        diff={{
          ...empty,
          added: [
            {
              item_no: "NUEVA",
              eco_item_name: "Nombre",
              eco_qty: 0,
              eco_unit: "EA",
              eco_location_text: "R1,R2",
              eco_maker: "MAKER-A",
              eco_supplier: "PROVEEDOR-A",
            },
          ],
          removed: [{ item_no: "ANTERIOR", eco_qty: 2 }],
          warning: { message: "Revisa el alcance" },
          counts: { ...empty.counts, added: 1, removed: 1 },
        }}
      />,
    );
    const added = screen.getByRole("table", { name: "Añadidos del ECO" });
    expect(added).toHaveTextContent("R1,R2");
    expect(added).toHaveTextContent("MAKER-A");
    expect(added).toHaveTextContent("PROVEEDOR-A");
    expect(within(added).getByRole("row", { name: /NUEVA/ })).toHaveTextContent(
      "MODELO-A",
    );
    await userEvent.click(screen.getByRole("tab", { name: "Eliminados (1)" }));
    expect(
      screen.getByRole("table", { name: "Eliminados del ECO" }),
    ).toHaveTextContent("ANTERIOR");
    expect(screen.getByText(/Revisa el alcance/)).toBeInTheDocument();
  });
  it("infiere el modelo solo cuando el alcance es inequívoco", () => {
    expect(singleEcoModel(eco)).toBe("MODELO-A");
    expect(singleEcoModel({ ...eco, scope: [{ part_no: "MODELO-A" }] })).toBe(
      "MODELO-A",
    );
    expect(singleEcoModel({ ...eco, scope_count: 2 })).toBeUndefined();
    expect(
      singleEcoModel({
        ...eco,
        scope: [{ part_no: "MODELO-A" }, { part_no: "MODELO-B" }],
      }),
    ).toBeUndefined();
    expect(
      singleEcoModel({ ...eco, scope_parts: "MODELO-A,MODELO-B" }),
    ).toBeUndefined();
    expect(singleEcoModel({ ...eco, part_no: "" })).toBeUndefined();
  });
});
