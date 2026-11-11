import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/core/auth/usePermission";
import { useAuth } from "@/core/auth/AuthProvider";
import { useForm } from "@/shared/hooks/useForm";
import {
  Button,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  TextField,
  type TableColumn,
} from "@/shared/ui";
import { columnsFor, Stats, type Warehouse } from "./components";
import { number, receiptLines, recordId, rowKey, text } from "./model";
import type { Row } from "./types";

const permission = {
  pagina: "LISTA_DE_MATERIALES",
  seccion: "Control de material",
  boton: "Invoice Embarques",
};
const invoiceColumns = columnsFor([
  ["numero_invoice", "INVOICE", 160],
  ["fecha_carga", "FECHA DE CARGA", 145],
  ["estado", "ESTADO", 110],
  ["parts", "PARTES", 80, true],
  ["quantity", "PIEZAS", 100, true],
  ["receipt", "RECEPCIÓN", 115],
]);
const partColumns = columnsFor([
  ["part_number", "NO. PARTE", 190],
  ["quantity", "PACKING", 115, true],
]);
const confirmedColumns = columnsFor([
  ["part_number", "NO. PARTE", 190],
  ["quantity", "PACKING", 115, true],
  ["cantidad_confirmada", "RECIBIDO", 115, true],
  ["folio_entrada", "FOLIO DE ENTRADA", 190],
]);
function received(row: Row) {
  return row.entrada_confirmada === true || row.entrada_confirmada === 1;
}

export function InvoiceReceipt({
  warehouse,
  close,
}: {
  warehouse: Warehouse;
  close: () => void;
}) {
  const query = useQuery({
    queryKey: warehouse.key("invoice-receipts"),
    queryFn: ({ signal }) => warehouse.api.invoices(signal),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const groups = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const row of query.data?.rows ?? []) {
      const id = text(row.invoice_id);
      const items = groups.get(id);
      if (items) items.push(row);
      else groups.set(id, [row]);
    }
    return groups;
  }, [query.data]);
  const list = useMemo(
    () =>
      [...groups].map(([id, items]) => ({
        ...items[0],
        invoice_id: id,
        parts: items.length,
        quantity: items.reduce((sum, row) => sum + number(row.quantity), 0),
        receipt: items.some(received) ? "Confirmada" : "Pendiente",
      })),
    [groups],
  );
  const columns = useMemo(
    () =>
      invoiceColumns.map((column) =>
        column.id === "numero_invoice"
          ? {
              ...column,
              cell: (row: Row) => (
                <Button
                  variant="plain"
                  className="shipping-warehouse-link"
                  onClick={() => setSelected(text(row.invoice_id))}
                >
                  {text(row.numero_invoice)}
                </Button>
              ),
            }
          : column,
      ),
    [],
  );
  const items = selected ? groups.get(selected) : null;
  if (selected && items?.length)
    return (
      <ReceiptDetail
        key={selected}
        warehouse={warehouse}
        invoiceId={recordId(selected)}
        rows={items}
        back={() => setSelected(null)}
        close={close}
      />
    );
  return (
    <Modal
      title="Entrada Invoice Embarques"
      size="xl"
      className="shipping-warehouse-dialog"
      onClose={close}
    >
      <DialogBody>
        <Stats
          items={[
            ["Invoices", query.data?.summary.total_invoices ?? list.length],
            ["Partes", query.data?.summary.total_parts],
            ["Piezas", query.data?.summary.total_quantity],
          ]}
        />
        <DataGrid
          label="Invoices de embarques"
          rows={list}
          columns={columns}
          rowKey={(row) => text(row.invoice_id)}
          minWidth={780}
          layout="fixed"
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </DialogBody>
      <DialogFooter>
        <Button onClick={close}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}

function ReceiptDetail({
  warehouse,
  invoiceId,
  rows,
  back,
  close,
}: {
  warehouse: Warehouse;
  invoiceId: number;
  rows: readonly Row[];
  back: () => void;
  close: () => void;
}) {
  const allowed = usePermission(permission);
  const client = useQueryClient();
  const { scope } = useAuth();
  const [complete, setComplete] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [resultRows, setResultRows] = useState<Row[] | null>(null);
  const data = resultRows ?? rows;
  const confirmed = !!resultRows || rows.some(received);
  const canConfirm = allowed.data === true && !confirmed;
  const form = useForm({
    initialValues: {},
    validate: () => {
      if (!canConfirm) return ["No se puede confirmar esta recepción."];
      try {
        receiptLines(rows, quantities, complete);
        return [];
      } catch (error) {
        return [
          error instanceof Error ? error.message : "Revisa las cantidades.",
        ];
      }
    },
    onSubmit: async () => {
      const lines = receiptLines(rows, quantities, complete);
      const result = await warehouse.api.confirmReceipt(invoiceId, lines);
      const entries = Array.isArray(result.entradas)
        ? result.entradas.filter(
            (entry): entry is Row => !!entry && typeof entry === "object",
          )
        : [];
      const byPart = new Map(
        entries.map((entry) => [text(entry.part_number), entry]),
      );
      setResultRows(
        rows.map((row, index) => ({
          ...row,
          entrada_confirmada: true,
          cantidad_confirmada:
            byPart.get(text(row.part_number))?.quantity ??
            lines[index].cantidad_confirmada,
          folio_entrada: byPart.get(text(row.part_number))?.folio,
        })),
      );
      warehouse.saved(result, "Recepción confirmada.");
      void client.invalidateQueries({
        queryKey: ["invoicing", scope, "invoices", "EMBARQUES"],
      });
    },
  });
  const editable: TableColumn<Row>[] = [
    ...partColumns.map((col) => ({
      ...col,
      width: col.id === "part_number" ? "36%" : "20%",
    })),
    {
      id: "complete",
      header: "COMPLETA",
      width: "18%",
      filterable: false,
      cell: (row) => {
        const part = text(row.part_number);
        return (
          <CheckboxField
            aria-label={`Completa ${part}`}
            checked={complete.has(part)}
            disabled={form.pending}
            onChange={(event) => {
              const checked = event.target.checked;
              setComplete((previous) => {
                const next = new Set(previous);
                if (checked) next.add(part);
                else next.delete(part);
                return next;
              });
            }}
          />
        );
      },
    },
    {
      id: "received",
      header: "CANTIDAD RECIBIDA",
      width: "26%",
      filterable: false,
      cell: (row) => {
        const part = text(row.part_number);
        return (
          <TextField
            aria-label={`Cantidad recibida ${part}`}
            type="number"
            min={0}
            step="any"
            value={
              complete.has(part) ? text(row.quantity) : (quantities[part] ?? "")
            }
            disabled={form.pending || complete.has(part)}
            onChange={(event) =>
              setQuantities((previous) => ({
                ...previous,
                [part]: event.target.value,
              }))
            }
          />
        );
      },
    },
  ];
  const total = data.reduce(
    (sum, row) =>
      sum +
      number(
        confirmed
          ? row.cantidad_confirmada
          : complete.has(text(row.part_number))
            ? row.quantity
            : quantities[text(row.part_number)],
      ),
    0,
  );
  return (
    <Modal
      title={`Recepción · ${text(rows[0].numero_invoice)}`}
      className="shipping-warehouse-dialog"
      size="xl"
      busy={form.pending}
      closeOnBackdrop={false}
      onClose={close}
    >
      <DialogBody>
        <Stats
          items={[
            ["Partes", rows.length],
            [
              "Packing",
              rows.reduce((sum, row) => sum + number(row.quantity), 0),
            ],
            ["Recibido", total],
          ]}
        />
        <FormMessages errors={form.errors} error={form.error} />
        <DataGrid
          label="Partes de la recepción"
          rows={data}
          columns={
            confirmed ? confirmedColumns : canConfirm ? editable : partColumns
          }
          rowKey={rowKey}
          minWidth={680}
          layout="fixed"
        />
      </DialogBody>
      <DialogFooter>
        <Button disabled={form.pending} onClick={back}>
          Volver a invoices
        </Button>
        <Button disabled={form.pending} onClick={close}>
          Cerrar
        </Button>
        {canConfirm && (
          <Button
            variant="success"
            loading={form.pending}
            onClick={() => void form.submit()}
          >
            Confirmar recepción
          </Button>
        )}
      </DialogFooter>
    </Modal>
  );
}
