import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  DialogBody,
  DialogFooter,
  Modal,
  Page,
  TableRowActions,
  type TableColumn,
} from "@/shared/ui";
import {
  columnsFor,
  deleteFields,
  ListingCard,
  MutationDialog,
  Stats,
  useListing,
  useWarehouse,
  type Field,
} from "./components";
import { integer, recordId, text } from "./model";
import type { Row } from "./types";
const base = columnsFor([
  ["part_number", "NO. PARTE", 135],
  ["product_model", "MODELO", 130],
  ["product_status", "ESTATUS", 90],
  ["description", "DESCRIPCIÓN", 190],
  ["standard_pack", "STD PACK", 90, true],
  ["customer", "CLIENTE", 85],
  ["zone_code", "ZONA", 85],
  ["current_quantity", "CANTIDAD ACTUAL", 130, true],
]);
const fields: Field[] = [
  { key: "partNumber", label: "No. parte", required: true },
  { key: "productModel", label: "Modelo" },
  {
    key: "productStatus",
    label: "Estatus",
    options: [
      { value: "activo", label: "Activo" },
      { value: "inactivo", label: "Inactivo" },
    ],
  },
  {
    key: "standardPack",
    label: "Std pack",
    required: true,
    type: "number",
    step: 1,
    min: 1,
  },
  { key: "customer", label: "Cliente" },
  { key: "zoneCode", label: "Zona" },
  { key: "description", label: "Descripción", type: "textarea" },
  { key: "notes", label: "Motivo del cambio", type: "textarea" },
];
type Dialog = { type: "save"; row?: Row } | { type: "delete"; row: Row };
function blocked(row: Row) {
  if (row.delete_mode === "blocked_stock")
    return "La parte tiene inventario disponible.";
  if (row.delete_mode === "blocked_movements")
    return "La parte tiene movimientos en el periodo actual.";
  return "";
}
export default function CatalogPage() {
  const warehouse = useWarehouse();
  const state = useListing(warehouse, "catalog");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const columns = useMemo<TableColumn<Row>[]>(
    () => [
      ...base.map((column) => ({
        ...column,
        width: parseFloat(String(column.width)) * 0.9 + "%",
      })),
      {
        id: "actions",
        header: "ACCIÓN",
        width: "10%",
        filterable: false,
        cell: (row) => (
          <TableRowActions
            actions={[
              {
                id: "edit",
                label: `Editar ${text(row.part_number)}`,
                icon: <Pencil size={14} />,
                onClick: () => setDialog({ type: "save", row }),
              },
              {
                id: "delete",
                label: `Eliminar ${text(row.part_number)}`,
                icon: <Trash2 size={14} />,
                tone: "danger",
                onClick: () => setDialog({ type: "delete", row }),
              },
            ]}
          />
        ),
      },
    ],
    [],
  );
  const row = dialog?.row;
  const restriction = dialog?.type === "delete" ? blocked(dialog.row) : "";
  return (
    <Page className="shipping-warehouse-page" banner={<DemoBanner />}>
      <ListingCard
        warehouse={warehouse}
        state={state}
        kind="catalog"
        title="Catálogo números de parte embarques"
        columns={columns}
        width={1030}
        actions={[
          {
            id: "new",
            label: "Nuevo número de parte",
            onClick: () => setDialog({ type: "save" }),
          },
        ]}
      />
      {dialog?.type === "save" && (
        <MutationDialog
          title={
            row ? `Editar ${text(row.part_number)}` : "Nuevo número de parte"
          }
          close={close}
          fields={fields.map((field) =>
            field.key === "notes" ? { ...field, required: !!row } : field,
          )}
          initial={{
            partNumber: row?.part_number ?? "",
            productModel: row?.product_model ?? "",
            productStatus: row?.product_status || "activo",
            standardPack: row?.standard_pack ?? 1,
            customer: row?.customer || "LG",
            zoneCode: row?.zone_code || "pending",
            description: row?.description ?? "",
            notes: "",
          }}
          validate={(draft) =>
            integer(draft.standardPack) === null
              ? ["Std pack debe ser un entero mayor a cero."]
              : []
          }
          run={async (draft) => {
            const payload = Object.fromEntries(
              Object.entries(draft).map(([key, value]) => [
                key,
                text(value).trim(),
              ]),
            );
            warehouse.saved(
              await warehouse.api.saveCatalog(
                payload,
                row ? recordId(row.catalog_id) : undefined,
              ),
            );
          }}
        />
      )}
      {dialog?.type === "delete" &&
        (restriction ? (
          <Modal
            title={`Baja de ${text(dialog.row.part_number)}`}
            onClose={close}
          >
            <DialogBody>
              <Alert tone="warning">{restriction}</Alert>
            </DialogBody>
            <DialogFooter>
              <Button onClick={close}>Cerrar</Button>
            </DialogFooter>
          </Modal>
        ) : (
          <MutationDialog
            title={`Eliminar ${text(dialog.row.part_number)}`}
            fields={deleteFields}
            initial={{ password: "", notes: "" }}
            close={close}
            label="Confirmar eliminación"
            danger
            run={async (draft) => {
              warehouse.saved(
                await warehouse.api.deleteCatalog(
                  recordId(dialog.row.catalog_id),
                  text(draft.password),
                  text(draft.notes).trim(),
                ),
              );
            }}
          >
            <Stats items={[["Cantidad actual", dialog.row.current_quantity]]} />
            <p>
              El servidor determina la baja según el inventario y el historial
              de la parte.
            </p>
          </MutationDialog>
        ))}
    </Page>
  );
}
