import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  Modal,
  Page,
  type TableColumn,
} from "@/shared/ui";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { AdjustmentDialog } from "./AdjustmentDialog";
import { InvoiceReceipt } from "./InvoiceReceipt";
import {
  columnsFor,
  ExportAction,
  ListingCard,
  MutationDialog,
  Stats,
  useListing,
  useWarehouse,
  type Warehouse,
} from "./components";
import { integer, number, recordId, rowKey, text } from "./model";
import type { Row } from "./types";

const entryColumns = columnsFor([
  ["fecha", "FECHA", 100],
  ["hora", "HORA", 75],
  ["folio", "FOLIO", 175],
  ["part_number", "NO. PARTE", 145],
  ["cantidad", "CANTIDAD", 95, true],
  ["product_model", "MODELO", 135],
  ["customer", "CLIENTE", 80],
  ["zone_code", "ZONA", 76],
  ["location_code", "UBICACIÓN", 90],
  ["registered_by", "USUARIO", 112],
]);
const exitColumns = columnsFor([
  ["fecha", "FECHA", 100],
  ["hora", "HORA", 75],
  ["folio", "FOLIO", 150],
  ["part_number", "NO. PARTE", 135],
  ["cantidad", "CANTIDAD", 90, true],
  ["departure_code", "DEPARTURE", 160],
  ["product_model", "MODELO", 130],
  ["customer", "CLIENTE", 80],
  ["destination_area", "DESTINO", 92],
  ["reason", "MOTIVO", 100],
  ["registered_by", "USUARIO", 105],
]);
const boxColumns = columnsFor([
  ["box_id", "BOX ID", 240],
  ["part_number", "NO. PARTE", 155],
  ["quantity", "CANTIDAD", 95, true],
  ["fecha", "FECHA", 115],
  ["hora", "HORA", 85],
]);

function BoxDetail({
  warehouse,
  kind,
  folio,
  close,
}: {
  warehouse: Warehouse;
  kind: "entries" | "exits";
  folio: string;
  close: () => void;
}) {
  const query = useQuery({
    queryKey: warehouse.key("boxes", kind, folio),
    queryFn: ({ signal }) => warehouse.api.boxes(kind, folio, signal),
  });
  return (
    <Modal
      title={`Cajas del folio ${folio}`}
      size="xl"
      className="shipping-warehouse-dialog"
      onClose={close}
    >
      <DialogBody>
        {query.data && (
          <Stats
            items={[
              ["Cajas", query.data.summary.total_boxes],
              ["Piezas", query.data.summary.total_quantity],
            ]}
          />
        )}
        <DataGrid
          label="Cajas del movimiento"
          rows={query.data?.rows ?? []}
          columns={boxColumns}
          rowKey={rowKey}
          minWidth={660}
          layout="fixed"
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </DialogBody>
      <DialogFooter>
        <ExportAction
          run={() => warehouse.api.exportBoxes(kind, folio)}
          disabled={!query.data?.rows.length}
        />
        <Button onClick={close}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
type Dialog =
  | { type: "adjustment" | "invoice" }
  | { type: "boxes"; folio: string }
  | { type: "departure"; row: Row };

export function HistoryPage({ kind }: { kind: "entries" | "exits" }) {
  const warehouse = useWarehouse();
  const state = useListing(warehouse, kind);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const entry = kind === "entries";
  const columns = useMemo<TableColumn<Row>[]>(
    () =>
      (entry ? entryColumns : exitColumns).map((column) => {
        if (column.id === "folio")
          return {
            ...column,
            cell: (row) =>
              text(row.folio) ? (
                <Button
                  size="sm"
                  variant="plain"
                  className="shipping-warehouse-link"
                  title="Ver cajas del folio"
                  onClick={() =>
                    setDialog({ type: "boxes", folio: text(row.folio) })
                  }
                >
                  {text(row.folio)}
                </Button>
              ) : (
                "—"
              ),
          };
        if (column.id === "departure_code")
          return {
            ...column,
            cell: (row) =>
              text(row.departure_code) || (
                <Button
                  size="sm"
                  onClick={() => setDialog({ type: "departure", row })}
                >
                  Asignar departure
                </Button>
              ),
          };
        return column;
      }),
    [entry],
  );
  return (
    <Page className="shipping-warehouse-page" banner={<DemoBanner />}>
      <ListingCard
        warehouse={warehouse}
        state={state}
        kind={kind}
        title={
          entry ? "Entradas almacén embarques" : "Salidas almacén embarques"
        }
        columns={columns}
        width={entry ? 960 : 1120}
        actions={[
          {
            id: "adjust",
            label: entry ? "Registrar entrada" : "Registrar salida",
            onClick: () => setDialog({ type: "adjustment" }),
          },
          ...(entry
            ? [
                {
                  id: "invoice",
                  label: "Entrada Invoice",
                  onClick: () => setDialog({ type: "invoice" }),
                },
              ]
            : []),
        ]}
        summary={(rows) => (
          <Stats
            items={[
              ["Movimientos", rows.length],
              [
                "Piezas",
                rows.reduce((sum, row) => sum + number(row.cantidad), 0),
              ],
            ]}
          />
        )}
      />
      {dialog?.type === "boxes" && (
        <BoxDetail
          warehouse={warehouse}
          kind={kind}
          folio={dialog.folio}
          close={close}
        />
      )}
      {dialog?.type === "adjustment" && (
        <AdjustmentDialog warehouse={warehouse} kind={kind} close={close} />
      )}
      {dialog?.type === "invoice" && (
        <InvoiceReceipt warehouse={warehouse} close={close} />
      )}
      {dialog?.type === "departure" && (
        <MutationDialog
          title={`Asignar departure · ${text(dialog.row.folio)}`}
          close={close}
          fields={[
            { key: "code", label: "Departure", required: true, maxLength: 120 },
            {
              key: "quantity",
              label: "Cantidad a asignar",
              type: "number",
              min: 1,
              step: 1,
              required: true,
            },
          ]}
          initial={{ code: "", quantity: dialog.row.cantidad }}
          label="Asignar"
          validate={(draft) => {
            const qty = integer(draft.quantity);
            return qty === null || qty > number(dialog.row.cantidad)
              ? ["La cantidad debe ser mayor a cero y no superar la salida."]
              : [];
          }}
          run={async (draft) => {
            const result = await warehouse.api.assignDeparture(
              recordId(dialog.row.id),
              text(draft.code).trim(),
              integer(draft.quantity)!,
            );
            warehouse.saved(
              result.splitCreated && result.splitFolio
                ? {
                    message: `Departure asignado. Resto en ${text(result.splitFolio)}.`,
                  }
                : result,
              "Departure asignado.",
            );
          }}
        >
          <Stats
            items={[
              ["No. parte", dialog.row.part_number],
              ["Cantidad disponible", dialog.row.cantidad],
            ]}
          />
          <p>
            Si asignas una cantidad menor, el servidor conserva el resto en otro
            folio.
          </p>
        </MutationDialog>
      )}
    </Page>
  );
}
