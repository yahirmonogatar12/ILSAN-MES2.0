import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { saveDownload } from "@/core/http";
import { useForm } from "@/shared/hooks/useForm";
import {
  Button,
  Card,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  FilePreview,
  FormMessages,
  Modal,
  Page,
  type TableColumn,
} from "@/shared/ui";
import {
  ExportAction,
  MutationDialog,
  SearchBar,
  Stats,
} from "./components";
import {
  useFilters,
  useListing,
  useWarehouse,
  type Warehouse,
} from "./hooks";
import { columnsFor, type Field } from "./warehouseModel";
import { DualLists } from "./DualLists";
import { integer, number, returnRows, rowKey, text } from "./model";
import type { Attachment, Row } from "./types";

const columnsForReturn = (exit: boolean) =>
  columnsFor([
    ["fecha", "FECHA", 90],
    ["hora", "HORA", 72],
    ["folio", "FOLIO", 145],
    ["part_number", "NO. PARTE", 130],
    [
      exit ? "loss_quantity" : "return_quantity",
      exit ? "CANT. SALIDA" : "CANT. ENTRADA",
      100,
      true,
    ],
    ["product_model", "MODELO", 120],
    ["reason", "TIPO", 110],
    ["registered_by", "USUARIO", 90],
  ]);
const entryColumns = columnsForReturn(false),
  exitColumns = columnsForReturn(true);
const capture: Field[] = [
  {
    key: "movement",
    label: "Tipo de movimiento",
    options: [
      { value: "entry", label: "Entrada de retorno" },
      { value: "exit", label: "Salida de retorno" },
    ],
  },
  {
    key: "reason",
    label: "Tipo",
    options: [
      { value: "Exceso", label: "Exceso" },
      { value: "OS&D", label: "OS&D" },
    ],
  },
  { key: "part", label: "No. parte", required: true },
  {
    key: "quantity",
    label: "Cantidad",
    required: true,
    type: "number",
    min: 1,
    step: 1,
  },
];
function keyOf(row: Row) {
  return text(row.id ?? row.folio) + ":" + text(row.part_number);
}

function ReturnPrint({
  warehouse,
  close,
}: {
  warehouse: Warehouse;
  close: () => void;
}) {
  const filters = useFilters("returns");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Row[]>([]);
  const [pdf, setPdf] = useState<Attachment | null>(null);
  const query = useQuery({
    queryKey: warehouse.key("print-returns", filters.applied),
    queryFn: ({ signal }) =>
      warehouse.api.list("returns", filters.applied, signal),
  });
  const rows = useMemo(
    () => returnRows(query.data?.rows ?? [], true),
    [query.data],
  );
  const form = useForm({
    initialValues: {},
    validate: () => (preview.length ? [] : ["Selecciona las salidas."]),
    onSubmit: async () => setPdf(await warehouse.api.returnPdf(preview)),
  });
  const columns: TableColumn<Row>[] = [
    {
      id: "selection",
      header: "INCLUIR",
      width: "9%",
      filterable: false,
      cell: (row) => (
        <CheckboxField
          aria-label={`Incluir ${text(row.folio)}`}
          checked={selected.has(keyOf(row))}
          onChange={(event) => {
            const checked = event.target.checked;
            setSelected((previous) => {
              const next = new Set(previous);
              if (checked) next.add(keyOf(row));
              else next.delete(keyOf(row));
              return next;
            });
          }}
        />
      ),
    },
    ...exitColumns.map((column) => ({
      ...column,
      width: parseFloat(String(column.width)) * 0.91 + "%",
    })),
  ];
  const chosen = rows.filter((row) => selected.has(keyOf(row)));
  return (
    <Modal
      title="Imprimir salidas de retorno"
      size="xl"
      className="shipping-warehouse-dialog"
      busy={form.pending}
      onClose={close}
    >
      <DialogBody>
        {pdf ? (
          <FilePreview blob={pdf.blob} name={pdf.name} />
        ) : (
          <>
            {!preview.length && (
              <SearchBar
                kind="returns"
                pending={query.isFetching}
                state={{
                  ...filters,
                  submit: (refresh) => {
                    setSelected(new Set());
                    filters.submit(refresh);
                  },
                  reset: () => {
                    setSelected(new Set());
                    filters.reset();
                  },
                }}
                refresh={() => void query.refetch()}
              />
            )}
            <Stats
              items={[
                ["Salidas seleccionadas", preview.length || chosen.length],
                [
                  "Piezas",
                  (preview.length ? preview : chosen).reduce(
                    (sum, row) => sum + number(row.loss_quantity),
                    0,
                  ),
                ],
              ]}
            />
            <FormMessages errors={form.errors} error={form.error} />
            <DataGrid
              label={
                preview.length
                  ? "Vista previa de impresión"
                  : "Seleccionar salidas de retorno"
              }
              rows={preview.length ? preview : rows}
              columns={preview.length ? exitColumns : columns}
              rowKey={keyOf}
              minWidth={860}
              layout="fixed"
              loading={query.isPending}
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button disabled={form.pending} onClick={close}>
          Cerrar
        </Button>
        {pdf ? (
          <Button
            variant="success"
            onClick={() => saveDownload(pdf.blob, pdf.name)}
          >
            Descargar PDF
          </Button>
        ) : preview.length ? (
          <>
            <Button disabled={form.pending} onClick={() => setPreview([])}>
              Volver a selección
            </Button>
            <Button
              variant="primary"
              loading={form.pending}
              onClick={() => void form.submit()}
            >
              Generar PDF
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={!rows.length || query.isFetching}
              onClick={() =>
                setSelected(
                  selected.size ? new Set() : new Set(rows.map(keyOf)),
                )
              }
            >
              {selected.size ? "Limpiar selección" : "Seleccionar salidas"}
            </Button>
            <Button
              variant="primary"
              disabled={!chosen.length || query.isFetching}
              onClick={() =>
                setPreview(
                  chosen
                    .map<Row>((row) => ({
                      ...row,
                      movement_quantity: number(row.loss_quantity),
                    }))
                    .sort(
                      (a, b) =>
                        text(a.fecha).localeCompare(text(b.fecha)) ||
                        text(a.hora).localeCompare(text(b.hora)),
                    ),
                )
              }
            >
              Vista previa
            </Button>
          </>
        )}
      </DialogFooter>
    </Modal>
  );
}

export default function ReturnsPage() {
  const warehouse = useWarehouse();
  const state = useListing(warehouse, "returns");
  const { query, filters } = state;
  const [dialog, setDialog] = useState<"capture" | "print" | null>(null);
  const entries = useMemo(
    () => returnRows(query.data?.rows ?? [], false),
    [query.data],
  );
  const exits = useMemo(
    () => returnRows(query.data?.rows ?? [], true),
    [query.data],
  );
  const close = () => setDialog(null);
  function list(exit: boolean) {
    const rows = exit ? exits : entries;
    const title = exit ? "Salidas de retorno" : "Entradas de retorno";
    return (
      <>
        <Card fill label={title}>
          <DataGrid
            label={title}
            rows={rows}
            columns={exit ? exitColumns : entryColumns}
            rowKey={rowKey}
            layout="fixed"
            minWidth={820}
            loading={query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
            resetKey={JSON.stringify(filters.applied)}
            summary={(items) => (
              <Stats
                items={[
                  ["Movimientos", items.length],
                  [
                    "Piezas",
                    items.reduce(
                      (sum, row) =>
                        sum +
                        number(exit ? row.loss_quantity : row.return_quantity),
                      0,
                    ),
                  ],
                ]}
              />
            )}
          />
        </Card>
      </>
    );
  }
  return (
    <Page className="shipping-warehouse-page" banner={<DemoBanner />}>
      <SearchBar
        actions={
          <>
            <Button
              size="sm"
              variant="success"
              onClick={() => setDialog("capture")}
            >
              Registrar retorno
            </Button>
            <Button size="sm" onClick={() => setDialog("print")}>
              Imprimir salidas
            </Button>
            <ExportAction
              label="Exportar entradas"
              run={() =>
                warehouse.api.exportList("returns", filters.applied, "entry")
              }
              disabled={query.isFetching || !entries.length}
            />
            <ExportAction
              label="Exportar salidas"
              run={() =>
                warehouse.api.exportList("returns", filters.applied, "exit")
              }
              disabled={query.isFetching || !exits.length}
            />
          </>
        }
        kind="returns"
        state={filters}
        pending={query.isFetching}
        refresh={() => void query.refetch()}
      />
      <DualLists
        label="Movimientos de retorno"
        left={{ label: "Entradas de retorno", content: list(false) }}
        right={{ label: "Salidas de retorno", content: list(true) }}
      />
      {dialog === "capture" && (
        <MutationDialog
          title="Registrar retorno"
          fields={capture}
          close={close}
          label="Registrar"
          initial={{
            movement: "entry",
            reason: "Exceso",
            part: "",
            quantity: "",
          }}
          validate={(draft) =>
            integer(draft.quantity) === null
              ? ["La cantidad debe ser un entero mayor a cero."]
              : []
          }
          run={async (draft) => {
            const exit = draft.movement === "exit",
              qty = integer(draft.quantity)!;
            const result = await warehouse.api.registerReturn({
              partNumber: text(draft.part).trim().toUpperCase(),
              returnQty: exit ? 0 : qty,
              lossQty: exit ? qty : 0,
              movementType: exit ? "exit" : "entry",
              reason: text(draft.reason) + (exit ? " / Salida retorno" : ""),
              location: "",
              remarks: "",
              registeredBy:
                warehouse.profile?.nombre_completo ||
                warehouse.profile?.username ||
                "Sistema",
            });
            warehouse.saved(
              result,
              exit
                ? "Salida de retorno registrada."
                : "Entrada de retorno registrada.",
            );
          }}
        />
      )}
      {dialog === "print" && (
        <ReturnPrint warehouse={warehouse} close={close} />
      )}
    </Page>
  );
}
