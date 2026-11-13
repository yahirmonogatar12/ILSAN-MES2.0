import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Button,
  Card,
  DataGrid,
  DialogBody,
  DialogFooter,
  IconButton,
  Modal,
  Page,
  type TableColumn,
} from "@/shared/ui";
import {
  ExportAction,
  SearchBar,
  Stats,
} from "./components";
import { useFilters, useWarehouse, type Warehouse } from "./hooks";
import { columnsFor } from "./warehouseModel";
import { DualLists } from "./DualLists";
import { rowKey, text } from "./model";
import type { Filters, Listing, QaKind, Row } from "./types";

const titles = {
  entrada: "Pendientes de entrada a almacén",
  liberacion: "Pendientes de liberación QA",
};
const base = columnsFor([
  ["part_number", "NO. PARTE", 145],
  ["product_model", "MODELO", 160],
  ["pending_boxes", "CAJAS", 85, true],
  ["pending_quantity", "PIEZAS", 90, true],
]);
const boxColumns = {
  entrada: columnsFor([
    ["box_code", "BOX ID", 220],
    ["quantity", "CANTIDAD", 105, true],
    ["oqc_folio", "FOLIO OQC", 130],
    ["released_at", "LIBERADO", 170],
  ]),
  liberacion: columnsFor([
    ["box_code", "BOX ID", 200],
    ["pending_quantity", "PENDIENTES", 100, true],
    ["lqc_quantity", "LQC", 85, true],
    ["oqc_quantity", "OQC", 85, true],
    ["last_lqc_scan", "ÚLTIMO LQC", 150],
    ["lineas", "LÍNEAS", 100],
    ["lotes", "LOTES", 145],
  ]),
};
type Selection = { kind: QaKind; part: string; filters: Filters };
function Boxes({
  warehouse,
  selection,
  close,
}: {
  warehouse: Warehouse;
  selection: Selection;
  close: () => void;
}) {
  const { kind, part, filters } = selection;
  const query = useQuery({
    queryKey: warehouse.key("qa-boxes", kind, part, filters),
    queryFn: ({ signal }) => warehouse.api.qaBoxes(kind, part, filters, signal),
  });
  return (
    <Modal
      title={`${titles[kind]} · ${part}`}
      size="xl"
      className="shipping-warehouse-dialog"
      onClose={close}
    >
      <DialogBody>
        {query.data && (
          <Stats
            items={[
              ["Cajas", query.data.summary.pending_boxes],
              ["Piezas", query.data.summary.pending_quantity],
            ]}
          />
        )}
        <DataGrid
          label="Cajas pendientes QA"
          rows={query.data?.rows ?? []}
          columns={boxColumns[kind]}
          rowKey={rowKey}
          layout="fixed"
          minWidth={kind === "entrada" ? 630 : 910}
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </DialogBody>
      <DialogFooter>
        <ExportAction
          run={() => warehouse.api.qaExport(kind, part, filters)}
          disabled={!query.data?.rows.length}
        />
        <Button onClick={close}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
function QaList({
  kind,
  listing,
  loading,
  error,
  retry,
  open,
  resetKey,
}: {
  kind: QaKind;
  listing?: Listing;
  loading: boolean;
  error: unknown;
  retry: () => void;
  open: (part: string) => void;
  resetKey: string;
}) {
  const columns = useMemo<TableColumn<Row>[]>(
    () => [
      ...base.map((column) => ({
        ...column,
        width: parseFloat(String(column.width)) * 0.88 + "%",
      })),
      {
        id: "detail",
        header: "DETALLE",
        width: "12%",
        filterable: false,
        cell: (row) => (
          <IconButton
            icon={<Eye size={15} />}
            label={`Ver cajas ${text(row.part_number)}`}
            onClick={() => open(text(row.part_number))}
          />
        ),
      },
    ],
    [open],
  );
  return (
    <Card fill label={titles[kind]}>
      {listing && (
        <Stats
          items={[
            ["Partes", listing.summary.pending_parts],
            ["Cajas", listing.summary.pending_boxes],
            ["Piezas", listing.summary.pending_quantity],
          ]}
        />
      )}
      <DataGrid
        label={titles[kind]}
        rows={listing?.rows ?? []}
        columns={columns}
        rowKey={rowKey}
        minWidth={550}
        layout="fixed"
        loading={loading}
        error={error}
        onRetry={retry}
        resetKey={resetKey}
      />
    </Card>
  );
}
export default function QaPage() {
  const warehouse = useWarehouse();
  const filters = useFilters("qa");
  const [selection, setSelection] = useState<Selection | null>(null);
  const query = useQuery({
    queryKey: warehouse.key("qa", filters.applied),
    queryFn: ({ signal }) => warehouse.api.qaSummary(filters.applied, signal),
  });
  function list(kind: QaKind) {
    return (
      <QaList
        kind={kind}
        listing={query.data?.[kind]}
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        resetKey={JSON.stringify(filters.applied)}
        open={(part) => setSelection({ kind, part, filters: filters.applied })}
      />
    );
  }
  return (
    <Page className="shipping-warehouse-page" banner={<DemoBanner />}>
      <SearchBar
        kind="qa"
        state={filters}
        pending={query.isFetching}
        refresh={() => void query.refetch()}
      />
      <DualLists
        label="Pendientes QA Embarques"
        left={{ label: "Entrada a almacén", content: list("entrada") }}
        right={{ label: "Liberación QA", content: list("liberacion") }}
      />
      {selection && (
        <Boxes
          warehouse={warehouse}
          selection={selection}
          close={() => setSelection(null)}
        />
      )}
    </Page>
  );
}
