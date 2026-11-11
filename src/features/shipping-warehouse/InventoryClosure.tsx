import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  TabBar,
  TextField,
  tabIds,
  type TableColumn,
} from "@/shared/ui";
import { columnsFor, ExportAction, Stats, type Warehouse } from "./components";
import { recordId, rowKey, text } from "./model";
import type { BatchPreview, Listing, Row } from "./types";

const previewColumns = columnsFor([
  ["part_number", "NO. PARTE", 150],
  ["product_model", "MODELO", 140],
  ["system_quantity", "SISTEMA ACTUAL", 118, true],
  ["csv_current_qty", "CSV ACTUAL", 112, true],
  ["difference_quantity", "DIFERENCIA", 104, true],
  ["applied_initial_quantity", "INV. INICIAL", 108, true],
  ["status", "ESTADO", 110],
]);
const historyColumns = columnsFor([
  ["closure_label", "CIERRE", 150],
  ["closure_month", "MES", 100],
  ["date", "FECHA", 145],
  ["user", "USUARIO", 120],
  ["accuracy_pct", "PRECISIÓN %", 105, true],
  ["status", "ESTADO", 110],
]);
function ClosureStats({ data }: { data: Listing }) {
  return (
    <Stats
      items={[
        ["Fecha", data.metadata.closureDate],
        ["Usuario", data.metadata.closureUser],
        ["Mes", data.metadata.closureMonthLabel],
        ["Partes", data.summary.totalRows ?? data.rows.length],
        ["Diferencias", data.summary.differenceRows],
        [
          "Precisión",
          data.summary.accuracyPct == null
            ? "—"
            : text(data.summary.accuracyPct) + "%",
        ],
      ]}
    />
  );
}
function HistoryDetail({
  warehouse,
  batchId,
  close,
  resume,
}: {
  warehouse: Warehouse;
  batchId: number;
  close: () => void;
  resume: (preview: BatchPreview) => void;
}) {
  const query = useQuery({
    queryKey: warehouse.key("closure-detail", batchId),
    queryFn: ({ signal }) => warehouse.api.closureDetail(batchId, signal),
  });
  const data = query.data;
  return (
    <Modal
      title={`Cierre ${text(data?.batch.closure_label) || batchId}`}
      className="shipping-warehouse-dialog"
      size="xl"
      onClose={close}
    >
      <DialogBody>
        {data && <ClosureStats data={data} />}
        <DataGrid
          label="Detalle de cierre"
          rows={data?.rows ?? []}
          columns={previewColumns}
          rowKey={rowKey}
          minWidth={820}
          layout="fixed"
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </DialogBody>
      <DialogFooter>
        {data?.batch.status === "confirmed" && (
          <ExportAction run={() => warehouse.api.closureExport(batchId)} />
        )}
        {data?.batch.status === "draft" && (
          <Button
            variant="primary"
            onClick={() =>
              resume({
                ...data,
                valid: true,
                batchId: recordId(data.batch.id),
                batchCode: text(data.batch.closure_label),
                history: [],
                errors: [],
                closureImpact: {},
              })
            }
          >
            Retomar borrador
          </Button>
        )}
        <Button onClick={close}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}

export function InventoryClosure({
  warehouse,
  close,
}: {
  warehouse: Warehouse;
  close: () => void;
}) {
  const id = useId();
  const [tab, setTab] = useState("preview");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const bootstrap = useQuery({
    queryKey: warehouse.key("closure-bootstrap"),
    queryFn: ({ signal }) => warehouse.api.closureBootstrap(signal),
  });
  const data = preview ?? bootstrap.data;
  const batchId = preview?.batchId;
  const form = useForm({
    initialValues: { action: "preview" },
    validate: ({ action }) => {
      if (action === "preview")
        return file && /\.csv$/i.test(file.name)
          ? []
          : ["Selecciona un CSV de inventario físico."];
      return batchId ? [] : ["Selecciona una vista previa válida."];
    },
    onSubmit: async ({ action }) => {
      if (action === "preview" && file) {
        const result = await warehouse.api.closurePreview(file);
        setPreview(result);
        if (result.batchId) void bootstrap.refetch();
      } else if (batchId) {
        const confirmed = action === "confirm";
        const result = await warehouse.api.closureBatch(
          confirmed ? "confirm" : "cancel",
          batchId,
        );
        setPreview(null);
        setFile(null);
        setFileKey((previous) => previous + 1);
        setTab(confirmed ? "history" : "preview");
        warehouse.saved(
          result,
          confirmed ? "Cierre confirmado." : "Borrador descartado.",
        );
      }
    },
  });
  const history = (bootstrap.data?.history ?? []).map<Row>((row) => ({
    ...row,
    date: row.confirmed_at || row.closed_at,
    user: row.confirmed_by || row.created_by,
  }));
  const columns: TableColumn<Row>[] = [
    ...historyColumns.map((column) => ({
      ...column,
      width: parseFloat(String(column.width)) * 0.86 + "%",
    })),
    {
      id: "action",
      header: "ACCIÓN",
      width: "14%",
      filterable: false,
      cell: (row) => (
        <Button
          size="sm"
          disabled={form.pending}
          onClick={() => setSelected(recordId(row.id))}
        >
          {row.status === "draft" ? "Retomar" : "Ver"}
        </Button>
      ),
    },
  ];
  const ids = tabIds(id, tab);
  return (
    <>
      <Modal
        title="Cierre de inventario de embarques"
        size="xl"
        className="shipping-warehouse-dialog"
        busy={form.pending}
        closeOnBackdrop={false}
        onClose={close}
      >
        <DialogBody>
          <TabBar
            id={id}
            label="Cierre de inventario"
            items={[
              { id: "preview", label: "Vista previa" },
              { id: "history", label: "Historial" },
            ]}
            activeId={tab}
            onChange={(next) => {
              if (!form.pending) setTab(next);
            }}
          />
          <div
            className="shipping-warehouse-panel"
            id={ids.panel}
            role="tabpanel"
            aria-labelledby={ids.tab}
          >
            {tab === "history" ? (
              <DataGrid
                label="Historial de cierres"
                rows={history}
                columns={columns}
                rowKey={rowKey}
                minWidth={860}
                layout="fixed"
                loading={bootstrap.isPending}
                error={bootstrap.error}
                onRetry={() => void bootstrap.refetch()}
              />
            ) : (
              <>
                {data && <ClosureStats data={data} />}
                {!batchId && (
                  <TextField
                    key={fileKey}
                    type="file"
                    accept=".csv"
                    label="CSV de inventario físico"
                    disabled={form.pending}
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setPreview(null);
                    }}
                  />
                )}
                {batchId && (
                  <Alert tone="info">
                    Borrador {preview?.batchCode || batchId} listo para
                    confirmar.
                  </Alert>
                )}
                <FormMessages
                  errors={[...form.errors, ...(preview?.errors ?? [])]}
                  error={form.error}
                />
                <DataGrid
                  label="Comparación de inventario"
                  rows={data?.rows ?? []}
                  columns={previewColumns}
                  rowKey={rowKey}
                  minWidth={820}
                  layout="fixed"
                  loading={bootstrap.isPending && !preview}
                  error={preview ? null : bootstrap.error}
                  onRetry={() => void bootstrap.refetch()}
                />
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button disabled={form.pending} onClick={close}>
            Cerrar
          </Button>
          {tab === "preview" && (
            <>
              <ExportAction
                run={warehouse.api.closureTemplate}
                label="Descargar plantilla"
                disabled={form.pending}
              />
              {batchId ? (
                <>
                  <Button
                    disabled={form.pending}
                    onClick={() => void form.submit({ action: "cancel" })}
                  >
                    Descartar borrador
                  </Button>
                  <Button
                    variant="success"
                    loading={form.pending}
                    onClick={() => void form.submit({ action: "confirm" })}
                  >
                    Confirmar cierre
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  loading={form.pending}
                  onClick={() => void form.submit({ action: "preview" })}
                >
                  Validar CSV
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </Modal>
      {selected !== null && (
        <HistoryDetail
          warehouse={warehouse}
          batchId={selected}
          close={() => setSelected(null)}
          resume={(next) => {
            setPreview(next);
            setSelected(null);
            setTab("preview");
          }}
        />
      )}
    </>
  );
}
