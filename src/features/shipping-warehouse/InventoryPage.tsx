import { useState } from "react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { Page } from "@/shared/ui";
import { ListingCard, Stats } from "./components";
import { useListing, useWarehouse } from "./hooks";
import { columnsFor } from "./warehouseModel";
import { InventoryClosure } from "./InventoryClosure";
import { number } from "./model";
const columns = columnsFor([
  ["part_number", "NO. PARTE", 150],
  ["product_model", "MODELO", 150],
  ["customer", "CLIENTE", 100],
  ["initial_quantity", "INV. INICIAL", 100, true],
  ["entries_qty", "ENTRADAS", 95, true],
  ["exits_qty", "SALIDAS", 95, true],
  ["return_entries_qty", "ENTRADAS RETORNO", 120, true],
  ["return_exits_qty", "SALIDAS RETORNO", 120, true],
  ["current_quantity", "CANTIDAD TOTAL", 125, true],
]);
export default function InventoryPage() {
  const warehouse = useWarehouse();
  const state = useListing(warehouse, "inventory");
  const [closure, setClosure] = useState(false);
  const summary = state.query.data?.summary;
  return (
    <Page className="shipping-warehouse-page" banner={<DemoBanner />}>
      <div
        className="shipping-warehouse-panel shipping-warehouse-inventory-panel"
        hidden={closure}
        inert={closure}
      >
        <ListingCard
          warehouse={warehouse}
          state={state}
          kind="inventory"
          title="Inventario general embarques"
          columns={columns}
          width={1000}
          actions={[
            {
              id: "closure",
              label: "Cierre de inventario",
              onClick: () => setClosure(true),
            },
          ]}
          summary={(rows) => (
            <Stats
              items={[
                ["Partes", rows.length],
                [
                  "Piezas",
                  rows.reduce(
                    (sum, row) => sum + number(row.current_quantity),
                    0,
                  ),
                ],
                ...(summary?.latest_period_start
                  ? [
                      [
                        "Inicio del periodo",
                        summary.latest_period_start,
                      ] as const,
                    ]
                  : []),
              ]}
            />
          )}
        />
      </div>
      {closure && (
        <InventoryClosure
          warehouse={warehouse}
          close={() => setClosure(false)}
        />
      )}
    </Page>
  );
}
