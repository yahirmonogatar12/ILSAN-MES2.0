import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  FilterBar,
  IconButton,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { columnsFor } from "./warehouseModel";
import { rowKey, text } from "./model";
import type { Warehouse } from "./hooks";
import type { InventoryAuditFilters, Row } from "./types";
import { useInventoryAudit } from "./useInventoryAudit";
import "./inventory-audit.css";

const filterFields: readonly FilterField<InventoryAuditFilters>[] = [
  {
    key: "folio",
    label: "Folio",
    type: "search",
    placeholder: "Buscar folio de auditoría",
  },
  { key: "fecha_desde", label: "Fecha desde", type: "date" },
  { key: "fecha_hasta", label: "Fecha hasta", type: "date" },
];

const historyBaseColumns = columnsFor([
  ["audit_folio", "FOLIO", 150],
  ["started_at", "INICIO", 145],
  ["closed_at", "CIERRE", 145],
  ["closed_by", "USUARIO", 120],
  ["total_boxes", "CAJAS", 75, true],
  ["total_parts", "NO. PARTES", 95, true],
  ["total_quantity", "PIEZAS", 90, true],
]);
const partColumnsBase = columnsFor([
  ["part_number", "NO. PARTE", 150],
  ["total_boxes", "CAJAS", 85, true],
  ["total_quantity", "PIEZAS", 95, true],
]);
const boxColumns = columnsFor([
  ["box_code", "BOX ID", 180],
  ["quantity", "CANTIDAD", 90, true],
  ["scanned_at", "ESCANEADO", 145],
]);

function statusLabel(value: unknown) {
  const status = text(value);
  if (status === "open") return "Abierta";
  if (status === "closed") return "Cerrada";
  if (status === "cancelled") return "Cancelada";
  return status || "—";
}

function statusClass(value: unknown) {
  const status = text(value);
  return status === "closed"
    ? "positive"
    : status === "open"
      ? "warning"
      : "neutral";
}

export function InventoryAudit({
  warehouse,
  close,
}: {
  warehouse: Warehouse;
  close: () => void;
}) {
  const state = useInventoryAudit(warehouse);
  const [selectedPart, setSelectedPart] = useState("");
  const historyRows = state.history.data?.rows ?? [];
  const detail = state.detail.data;
  const parts = detail?.parts ?? [];
  const boxes = selectedPart
    ? (detail?.boxes ?? []).filter(
        (row) => text(row.part_number) === selectedPart,
      )
    : [];

  const historyColumns: TableColumn<Row>[] = [
    ...historyBaseColumns.map((column) =>
      column.id === "closed_by"
        ? {
            ...column,
            cell: (row: Row) =>
              text(row.closed_by) || text(row.started_by) || "—",
          }
        : column,
    ),
    {
      id: "status",
      header: "ESTADO",
      width: "10%",
      cell: (row) => (
        <span
          className={`shipping-warehouse-audit-status shipping-warehouse-audit-status-${statusClass(row.status)}`}
        >
          {statusLabel(row.status)}
        </span>
      ),
      textValue: (row) => statusLabel(row.status),
      sortValue: (row) => statusLabel(row.status),
    },
    {
      id: "detail",
      header: "DETALLE",
      width: "9%",
      filterable: false,
      cell: (row) => (
        <Button
          size="sm"
          onClick={() => {
            setSelectedPart("");
            state.select(row);
          }}
        >
          Ver
        </Button>
      ),
    },
  ];
  const partColumns: TableColumn<Row>[] = partColumnsBase.map((column) =>
    column.id === "part_number"
      ? {
          ...column,
          cell: (row: Row) => (
            <Button
              size="sm"
              variant="plain"
              className="shipping-warehouse-link"
              aria-pressed={selectedPart === text(row.part_number)}
              onClick={() => setSelectedPart(text(row.part_number))}
            >
              {text(row.part_number) || "—"}
            </Button>
          ),
        }
      : column,
  );

  return (
    <div
      className="shipping-warehouse-audit"
      aria-label="Auditoría de inventario"
      role="region"
    >
      <Card
        title="Auditorías de inventario físico"
        className="shipping-warehouse-audit-filters"
        icon={
          <IconButton
            label="Regresar a inventario"
            icon={<ArrowLeft size={18} />}
            onClick={close}
          />
        }
      >
        <FilterBar
          title="Filtros de auditoría"
          fields={filterFields}
          values={state.draft}
          defaults={state.defaults}
          onChange={state.change}
          onSubmit={state.submit}
          onReset={state.reset}
          pending={state.history.isFetching}
        />
        {state.error && <Alert tone="warning">{state.error}</Alert>}
      </Card>

      <Card
        fill
        title="Historial de auditorías"
        badge={`${historyRows.length} ${historyRows.length === 1 ? "auditoría" : "auditorías"}`}
        className="shipping-warehouse-audit-history"
      >
        <DataGrid
          label="Historial de auditorías físicas"
          rows={historyRows}
          columns={historyColumns}
          rowKey={rowKey}
          minWidth={1120}
          layout="fixed"
          loading={state.history.isPending}
          error={state.history.error}
          onRetry={() => void state.history.refetch()}
          fetching={state.history.isFetching}
          resetKey={JSON.stringify(state.applied)}
          rowProps={(row) => ({
            "aria-selected": Number(row.id) === state.selected,
            className:
              Number(row.id) === state.selected
                ? "shipping-warehouse-audit-row-selected"
                : undefined,
          })}
        />
      </Card>

      <div className="shipping-warehouse-audit-detail-grid">
        <Card
          fill
          title="Números de parte escaneados"
          badge={`${parts.length} ${parts.length === 1 ? "parte" : "partes"}`}
          className="shipping-warehouse-audit-parts"
        >
          <DataGrid
            label="Números de parte escaneados"
            rows={parts}
            columns={partColumns}
            rowKey={rowKey}
            minWidth={560}
            layout="fixed"
            paginate={false}
            loading={state.detail.isPending}
            error={state.detail.error}
            onRetry={() => void state.detail.refetch()}
            emptyState={
              <Alert tone="info">
                {state.selected === null
                  ? "Selecciona una auditoría."
                  : "La auditoría no tiene cajas registradas."}
              </Alert>
            }
            rowProps={(row) => ({
              "aria-selected": selectedPart === text(row.part_number),
              className:
                selectedPart === text(row.part_number)
                  ? "shipping-warehouse-audit-row-selected"
                  : undefined,
            })}
          />
        </Card>
        <Card
          fill
          title="Box ID registrados"
          badge={`${boxes.length} ${boxes.length === 1 ? "caja" : "cajas"}`}
          className="shipping-warehouse-audit-boxes"
        >
          <DataGrid
            label="Box ID registrados"
            rows={boxes}
            columns={boxColumns}
            rowKey={rowKey}
            minWidth={500}
            layout="fixed"
            paginate={false}
            loading={state.detail.isPending}
            emptyState={
              <Alert tone="info">
                {selectedPart
                  ? "No hay cajas para este número de parte."
                  : "Selecciona un número de parte."}
              </Alert>
            }
          />
        </Card>
      </div>
    </div>
  );
}
