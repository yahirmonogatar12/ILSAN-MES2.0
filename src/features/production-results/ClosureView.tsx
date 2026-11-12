import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  ExportButton,
  Loading,
  ErrorState,
  Modal,
  DialogBody,
  DialogFooter,
  TabBar,
  tabIds,
  TextField,
  type TableColumn,
} from "@/shared/ui";
import { columnsFor } from "./ResultsTable";
import { number, object, text } from "./model";
import { useResults } from "./useResults";
import { closureColumns } from "./views";
import type { Closure, Row } from "./types";

const windowed = { rowHeight: 32 };
export function ClosureView({ onClose }: { onClose: () => void }) {
  const context = useResults();
  const id = useId();
  const compact = useMediaQuery("(max-width: 620px) and (max-height: 800px)");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [tab, setTab] = useState("preview");
  const [payload, setPayload] = useState<Closure | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: context.key("closure"),
    queryFn: ({ signal }) => context.api.closure(signal),
    staleTime: 0,
  });
  const data = payload ?? query.data;
  const preview = useForm({
    initialValues: {},
    validate: () => (file ? [] : ["Selecciona el CSV de inventario físico."]),
    onSubmit: async () => {
      setPayload((previous) =>
        previous ? { ...previous, valid: false, batchId: null } : null,
      );
      const result = await context.api.previewClosure(file!);
      setPayload(result);
      if (result.valid) setCaptureOpen(false);
      setMessage(
        result.valid ? "Preview validado. Puedes confirmar el cierre." : "",
      );
    },
  });
  const confirm = useForm({
    initialValues: {},
    validate: () =>
      data?.valid && data.batchId ? [] : ["Valida el CSV antes de confirmar."],
    onSubmit: async () => {
      const result = await context.api.confirmClosure(data!.batchId!);
      setPayload({
        ...data!,
        valid: false,
        batchId: null,
        history: result.history,
      });
      setCaptureOpen(false);
      setMessage(result.message);
      await context.refresh();
    },
  });
  const detail = useForm({
    initialValues: { id: 0 },
    validate: ({ id }) =>
      id > 0 ? [] : ["El cierre no tiene un identificador válido."],
    onSubmit: async ({ id }) => {
      const result = await context.api.closureDetail(id);
      setPayload({ ...result, history: data?.history ?? [] });
      setTab("preview");
      setMessage(
        result.valid ? "Preview pendiente retomado." : "Cierre consultado.",
      );
      setFile(null);
      setFileKey((value) => value + 1);
    },
  });
  const download = useForm({
    initialValues: { id: 0 },
    validate: () => [],
    onSubmit: ({ id }) =>
      id ? context.api.exportClosure(id) : context.api.closureTemplate(),
  });
  const busy =
    preview.pending || confirm.pending || detail.pending || download.pending;
  const columns = useMemo(() => columnsFor(closureColumns), []);
  const historyColumns: TableColumn<Row>[] = [
    ...columnsFor([
      { key: "closure_label", title: "Cierre", width: 210 },
      { key: "closure_month", title: "Mes", width: 90 },
      { key: "date", title: "Fecha", width: 160 },
      { key: "user", title: "Usuario", width: 110 },
      { key: "accuracy", title: "Accuracy", width: 90 },
      { key: "status", title: "Estado", width: 95 },
    ]),
    {
      id: "actions",
      header: "Acciones",
      filterable: false,
      width: 170,
      cell: (row) => (
        <div className="production-results-actions">
          <Button
            size="sm"
            disabled={busy}
            aria-label={"Ver cierre " + text(row.id)}
            onClick={() => void detail.submit({ id: number(row.id) })}
          >
            Ver
          </Button>
          <ExportButton
            size="sm"
            disabled={busy || row.status !== "confirmed"}
            aria-label={"Exportar CSV del cierre " + text(row.id)}
            onClick={() => void download.submit({ id: number(row.id) })}
          >
            CSV
          </ExportButton>
        </div>
      ),
    },
  ];
  const history: Row[] = (data?.history ?? []).map((row) => ({
    ...row,
    date: row.confirmed_at || row.closed_at || row.created_at,
    user: row.confirmed_by || row.created_by,
    accuracy: row.summary
      ? number(object(row.summary).accuracyPct).toFixed(2) + "%"
      : "",
  }));
  const errors = [
    ...preview.errors,
    ...confirm.errors,
    preview.error?.message,
    confirm.error?.message,
    detail.error?.message,
    download.error?.message,
    ...(data?.errors ?? []),
  ].filter(Boolean);
  async function reset() {
    setPayload(null);
    setFile(null);
    setMessage("");
    setFileKey((value) => value + 1);
    await query.refetch();
  }
  const capture = data && (
    <div className="production-results-upload">
      <TextField
        key={fileKey}
        type="file"
        label="CSV de inventario físico"
        accept=".csv,text/csv"
        disabled={busy}
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setMessage("");
          setPayload({
            ...data,
            valid: false,
            batchId: null,
            errors: [],
          });
        }}
      />
      <div className="production-results-actions">
        <ExportButton
          size="sm"
          disabled={busy}
          onClick={() => void download.submit({ id: 0 })}
        >
          Plantilla CSV
        </ExportButton>
        <Button size="sm" disabled={busy} onClick={() => void reset()}>
          Restablecer cierre
        </Button>
        <Button
          size="sm"
          variant="primary"
          loading={preview.pending}
          disabled={busy || !file}
          onClick={() => void preview.submit()}
        >
          Validar preview
        </Button>
        <Button
          size="sm"
          variant="success"
          disabled={busy || !data.valid || !data.batchId}
          loading={confirm.pending}
          onClick={() => void confirm.submit()}
        >
          Confirmar cierre
        </Button>
      </div>
    </div>
  );
  return (
    <div className="production-results-closure">
      <div className="production-results-toolbar">
        <Button size="sm" disabled={busy} onClick={onClose}>
          Volver al inventario
        </Button>
        <span>
          {text(data?.metadata.closureLabel)}{" "}
          {text(data?.metadata.closureDateTime)} ·{" "}
          {text(data?.metadata.closureUser)}
        </span>
      </div>
      <TabBar
        id={id}
        label="Cierre de inventario exceso"
        activeId={tab}
        onChange={setTab}
        items={[
          { id: "preview", label: "Cierre y diferencias" },
          { id: "history", label: "Historial de cierres" },
        ]}
      />
      <div
        role="tabpanel"
        id={tabIds(id, tab).panel}
        aria-labelledby={tabIds(id, tab).tab}
        className="production-results-tab-panel"
      >
        {errors.length > 0 && <Alert tone="danger">{errors.join(" ")}</Alert>}
        {message && <Alert tone="info">{message}</Alert>}
        {query.isPending && <Loading text="Cargando cierre…" />}
        {query.error && !data && (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        )}
        {data &&
          (tab === "history" ? (
            <Card fill label="Historial de cierres">
              <DataGrid
                label="Historial de cierres de exceso"
                rows={history}
                columns={historyColumns}
                rowKey={(row) => text(row.id)}
                layout="fixed"
                minWidth={900}
                className="production-results-table"
              />
            </Card>
          ) : (
            <>
              {compact ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setCaptureOpen(true)}
                >
                  CSV y acciones de cierre
                </Button>
              ) : (
                capture
              )}
              <Card fill label="Comparación del cierre">
                <div
                  className="production-results-stats"
                  aria-label="Resumen del cierre"
                >
                  <span>
                    Sistema{" "}
                    <strong>
                      {number(data.summary.systemQuantity).toLocaleString(
                        "es-MX",
                      )}
                    </strong>
                  </span>
                  <span>
                    Físico{" "}
                    <strong>
                      {number(data.summary.physicalQuantity).toLocaleString(
                        "es-MX",
                      )}
                    </strong>
                  </span>
                  <span>
                    Diferencia absoluta{" "}
                    <strong>
                      {number(data.summary.absoluteDifference).toLocaleString(
                        "es-MX",
                      )}
                    </strong>
                  </span>
                  <span>
                    Accuracy{" "}
                    <strong>
                      {number(data.summary.accuracyPct).toFixed(2)}%
                    </strong>
                  </span>
                </div>
                <DataGrid
                  label="Comparación del cierre de exceso"
                  rows={data.rows}
                  columns={columns}
                  rowKey={(row) => text(row.part_number)}
                  layout="fixed"
                  minWidth={760}
                  className="production-results-table"
                  virtualRows={windowed}
                  resetKey={text(data.batchId) + fileKey}
                  rowProps={(row) => ({
                    className:
                      row.status === "diferencia"
                        ? "production-results-difference"
                        : undefined,
                  })}
                />
              </Card>
            </>
          ))}
      </div>
      {compact && captureOpen && (
        <Modal
          title="CSV y acciones de cierre"
          busy={busy}
          onClose={() => setCaptureOpen(false)}
        >
          <DialogBody>
            {errors.length > 0 && (
              <Alert tone="danger">{errors.join(" ")}</Alert>
            )}
            {capture}
          </DialogBody>
          <DialogFooter>
            <Button disabled={busy} onClick={() => setCaptureOpen(false)}>
              Volver a la tabla
            </Button>
          </DialogFooter>
        </Modal>
      )}
    </div>
  );
}
