import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  Modal,
  Page,
  TableRowActions,
  TextField,
  type TableColumn,
} from "@/shared/ui";
import {
  ExportAction,
  ListingCard,
  MutationDialog,
  SearchBar,
  Stats,
} from "./components";
import { useListing, useWarehouse, type Warehouse } from "./hooks";
import { columnsFor, deleteFields } from "./warehouseModel";
import { integer, movementKey, rowKey, text } from "./model";
import type { Row } from "./types";

const base = columnsFor([
  ["fecha", "FECHA", 103],
  ["hora", "HORA", 85],
  ["movement_label", "TIPO", 92],
  ["folio", "FOLIO", 142],
  ["part_number", "NO. PARTE", 125],
  ["display_quantity", "CANTIDAD", 91, true],
  ["product_model", "MODELO", 110],
  ["customer", "CLIENTE", 90],
  ["zone_code", "ZONA", 98],
  ["location_value", "UBICACIÓN / DESTINO", 131],
  ["departure_code", "DEPARTURE", 123],
]);
const auditColumns = columnsFor([
  ["fecha", "FECHA", 100],
  ["hora", "HORA", 80],
  ["action_label", "ACCIÓN", 115],
  ["movement_label", "TIPO", 95],
  ["folio", "FOLIO", 110],
  ["part_number", "NO. PARTE", 125],
  ["changed_fields", "CAMPOS", 110],
  ["previous_values", "ANTES", 170],
  ["new_values", "DESPUÉS", 170],
  ["adjusted_by", "USUARIO", 110],
  ["notes", "MOTIVO", 160],
]);
const editFields = [
  { column: "fecha", key: "fecha", label: "Fecha", type: "date" },
  { column: "hora", key: "hora", label: "Hora", type: "time" },
  {
    column: "display_quantity",
    key: "cantidad",
    label: "Cantidad",
    type: "number",
  },
  { column: "zone_code", key: "zona", label: "Zona", type: "text" },
  {
    column: "location_value",
    key: "ubicacion_destino",
    label: "Ubicación / Destino",
    type: "text",
  },
  {
    column: "departure_code",
    key: "departure",
    label: "Departure",
    type: "text",
  },
] as const;
type Edit = { row: Row; values: Record<string, string> };
const diffColumns = columnsFor([
  ["label", "CAMPO", 160],
  ["before", "ANTES", 210],
  ["after", "DESPUÉS", 210],
]);
function editableFields(row: Row) {
  return editFields.filter(
    (field) => field.key !== "departure" || row.movement_type === "exit",
  );
}
function capture(row: Row): Edit {
  return {
    row,
    values: Object.fromEntries(
      editableFields(row).map((field) => [field.key, text(row[field.column])]),
    ),
  };
}

function Audit({
  warehouse,
  close,
}: {
  warehouse: Warehouse;
  close: () => void;
}) {
  const { query, filters } = useListing(warehouse, "audit");
  return (
    <Modal
      title="Historial de cambios de movimientos"
      size="xl"
      className="shipping-warehouse-dialog"
      onClose={close}
    >
      <DialogBody>
        <SearchBar
          kind="audit"
          state={filters}
          pending={query.isFetching}
          refresh={() => void query.refetch()}
        />
        <DataGrid
          label="Historial de modificaciones"
          rows={query.data?.rows ?? []}
          columns={auditColumns}
          rowKey={rowKey}
          minWidth={1320}
          layout="fixed"
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          resetKey={JSON.stringify(filters.applied)}
        />
      </DialogBody>
      <DialogFooter>
        <ExportAction
          run={() => warehouse.api.exportList("audit", filters.applied)}
          disabled={!query.data?.rows.length}
        />
        <Button onClick={close}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}

export default function MovementsPage() {
  const warehouse = useWarehouse();
  const state = useListing(warehouse, "movements");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [review, setReview] = useState<{
    row: Row;
    changes: Row;
    differences: Row[];
  } | null>(null);
  const [remove, setRemove] = useState<Row | null>(null);
  const [audit, setAudit] = useState(false);
  const [issue, setIssue] = useState("");
  function reviewEdit() {
    if (!edit) return;
    const differences: Row[] = [];
    const changes: Row = {};
    for (const field of editableFields(edit.row)) {
      const before = text(edit.row[field.column]).trim();
      const after = edit.values[field.key].trim();
      if (before === after) continue;
      if ((field.key === "fecha" || field.key === "hora") && !after) {
        setIssue(field.label + " es obligatoria.");
        return;
      }
      if (field.key === "cantidad" && integer(after, 0) === null) {
        setIssue("Captura una cantidad entera válida.");
        return;
      }
      changes[field.key] = field.key === "cantidad" ? integer(after, 0) : after;
      differences.push({ label: field.label, before, after });
    }
    if (!differences.length) {
      setIssue("No hay cambios por guardar.");
      return;
    }
    setIssue("");
    setReview({ row: edit.row, changes, differences });
  }
  function start(row: Row) {
    setEdit(capture(row));
    setIssue("");
  }
  function discard() {
    setEdit(null);
    setIssue("");
  }
  const columns: TableColumn<Row>[] = [
    ...base.map((column) => ({
      ...column,
      width: parseFloat(String(column.width)) * 0.89 + "%",
      cell: (row: Row) => {
        const field = editableFields(row).find(
          (item) => item.column === column.id,
        );
        if (!edit || !field || movementKey(row) !== movementKey(edit.row))
          return column.cell(row);
        return (
          <TextField
            aria-label={`${field.label} ${text(row.folio)}`}
            type={field.type}
            min={field.type === "number" ? 0 : undefined}
            step={
              field.type === "number" || field.type === "time" ? 1 : undefined
            }
            value={edit.values[field.key]}
            onChange={(event) => {
              const value = event.target.value;
              setEdit((previous) =>
                previous
                  ? {
                      ...previous,
                      values: { ...previous.values, [field.key]: value },
                    }
                  : previous,
              );
            }}
          />
        );
      },
    })),
    {
      id: "actions",
      header: "ACCIÓN",
      width: "11%",
      filterable: false,
      cell: (row) =>
        edit && movementKey(row) === movementKey(edit.row) ? (
          <div className="shipping-warehouse-inline">
            <Button size="sm" variant="success" onClick={reviewEdit}>
              Revisar
            </Button>
            <Button size="sm" onClick={discard}>
              Cancelar
            </Button>
          </div>
        ) : (
          <TableRowActions
            actions={[
              {
                id: "edit",
                label: `Editar ${text(row.folio)}`,
                icon: <Pencil size={14} />,
                disabled: !!edit,
                onClick: () => start(row),
              },
              {
                id: "delete",
                label: `Eliminar ${text(row.folio)}`,
                icon: <Trash2 size={14} />,
                tone: "danger",
                disabled: !!edit,
                onClick: () => setRemove(row),
              },
            ]}
          />
        ),
    },
  ];
  return (
    <Page
      className="shipping-warehouse-page shipping-warehouse-movements"
      banner={<DemoBanner />}
    >
      {issue && (
        <Alert tone="warning" className="table-notice">
          {issue}
        </Alert>
      )}
      <ListingCard
        warehouse={warehouse}
        state={state}
        kind="movements"
        title="Movimientos de embarques"
        columns={columns}
        width={1320}
        actions={[
          {
            id: "audit",
            label: "Historial de cambios",
            onClick: () => setAudit(true),
          },
          ...(edit
            ? [
                {
                  id: "discard",
                  label: `Descartar edición de ${text(edit.row.folio)}`,
                  onClick: discard,
                },
              ]
            : []),
        ]}
      />
      {audit && <Audit warehouse={warehouse} close={() => setAudit(false)} />}
      {review && (
        <MutationDialog
          title={`Confirmar cambios · ${text(review.row.folio)}`}
          close={() => setReview(null)}
          fields={[
            {
              key: "notes",
              label: "Motivo del ajuste",
              type: "textarea",
              required: true,
            },
          ]}
          initial={{ notes: "" }}
          label="Confirmar cambios"
          run={async (draft) => {
            warehouse.saved(
              await warehouse.api.adjustMovement(
                review.row,
                review.changes,
                text(draft.notes).trim(),
              ),
            );
            discard();
          }}
        >
          <DataGrid
            label="Antes y después"
            rows={review.differences}
            columns={diffColumns}
            rowKey={rowKey}
            paginate={false}
            minWidth={560}
            layout="fixed"
          />
        </MutationDialog>
      )}
      {remove && (
        <MutationDialog
          title={`Eliminar movimiento · ${text(remove.folio)}`}
          close={() => setRemove(null)}
          fields={deleteFields}
          initial={{ password: "", notes: "" }}
          danger
          label="Confirmar eliminación"
          run={async (draft) => {
            warehouse.saved(
              await warehouse.api.deleteMovement(
                remove,
                text(draft.password),
                text(draft.notes).trim(),
              ),
            );
          }}
        >
          <Stats
            items={[
              ["No. parte", remove.part_number],
              ["Cantidad", remove.display_quantity],
            ]}
          />
        </MutationDialog>
      )}
    </Page>
  );
}
