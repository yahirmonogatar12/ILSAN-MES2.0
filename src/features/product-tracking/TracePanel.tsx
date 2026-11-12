import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  DialogBody,
  DialogFooter,
  EmptyState,
  ExportButton,
  FilterBar,
  Modal,
} from "@/shared/ui";
import { defaultFilters, traceViews } from "./config";
import { historyColumns, traceColumns } from "./columns";
import { numeric, text, validateTrace } from "./model";
import { useTracking } from "./useTracking";
import type { Filters, TraceRow, TraceView } from "./types";

export function TracePanel({
  view,
  active,
}: {
  view: TraceView;
  active: boolean;
}) {
  const { api, scope } = useTracking();
  const spec = traceViews[view];
  const defaults = useMemo(() => defaultFilters(view), [view]);
  const [draft, setDraft] = useState<Filters>(() => ({ ...defaults }));
  const [applied, setApplied] = useState<Filters>(() => ({ ...defaults }));
  const [queried, setQueried] = useState(view === "materiales");
  const [issue, setIssue] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const dateInitialized = useRef(false);
  const query = useQuery({
    queryKey: ["product-tracking", scope, "trace", view, applied],
    queryFn: ({ signal }) => api.trace(view, applied, signal),
    enabled: active && queried,
  });
  useEffect(() => {
    const serverDate = query.data?.fecha_hoy;
    if (view !== "materiales" || dateInitialized.current || !serverDate) return;
    dateInitialized.current = true;
    if (
      draft.fecha_inicio === defaults.fecha_inicio &&
      applied.fecha_inicio === defaults.fecha_inicio &&
      serverDate !== applied.fecha_inicio
    ) {
      setDraft((previous) => ({ ...previous, fecha_inicio: serverDate }));
      setApplied((previous) => ({ ...previous, fecha_inicio: serverDate }));
    }
  }, [
    view,
    query.data,
    draft.fecha_inicio,
    applied.fecha_inicio,
    defaults.fecha_inicio,
  ]);
  const first =
    view === "por_pcb" && queried
      ? query.data?.items.find((item) => numeric(item.input_main_id) > 0)
      : undefined;
  const history = useQuery({
    queryKey: [
      "product-tracking",
      scope,
      "history",
      first?.input_main_id,
      first?.proceso,
    ],
    queryFn: ({ signal }) =>
      api.history(numeric(first!.input_main_id), text(first!.proceso), signal),
    enabled: active && !!first,
  });
  const exportForm = useForm({
    initialValues: {},
    validate: () => [validateTrace(view, applied)].filter(Boolean),
    onSubmit: () => api.exportTrace(view, applied),
  });
  const reset = () => {
    dateInitialized.current = true;
    const empty = Object.fromEntries(
      spec.fields.map((field) => [field.key, ""]),
    );
    setDraft(empty);
    setApplied(empty);
    setIssue("");
    setHistoryOpen(false);
    setQueried(view === "materiales");
  };
  return (
    <div className="product-tracking-panel">
      <FilterBar
        actions={
          <>
            {first && (
              <Button size="sm" onClick={() => setHistoryOpen(true)}>
                Historial de verificaciones
                {history.data ? " (" + history.data.items.length + ")" : ""}
              </Button>
            )}
            <Button
              size="sm"
              disabled={!queried || query.isFetching}
              onClick={() => void query.refetch()}
            >
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              loading={exportForm.pending}
              disabled={!queried || !query.isSuccess || query.isFetching}
              onClick={() => void exportForm.submit()}
            />
          </>
        }
        fields={spec.fields}
        values={draft}
        defaults={defaults}
        pending={query.isFetching}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }) as Filters)
        }
        onReset={reset}
        onSubmit={() => {
          const error = validateTrace(view, draft);
          setIssue(error);
          if (error) return;
          const next = Object.fromEntries(
            Object.entries(draft).map(([key, value]) => [key, value.trim()]),
          );
          if (queried && JSON.stringify(next) === JSON.stringify(applied))
            void query.refetch();
          setApplied(next);
          setQueried(true);
        }}
      />
      <Card fill label={spec.title}>
        {(issue || exportForm.error || exportForm.errors[0]) && (
          <Alert tone="danger" className="product-tracking-message">
            {issue || exportForm.error?.message || exportForm.errors[0]}
          </Alert>
        )}
        {history.error && first && (
          <Alert tone="danger" className="product-tracking-message">
            No se pudo cargar el historial de verificaciones.{" "}
            {history.error.message}
          </Alert>
        )}
        {queried && query.data?.message && (
          <Alert className="product-tracking-message">
            {query.data.message}
          </Alert>
        )}
        {queried && (query.data?.items.length || 0) >= spec.limit && (
          <Alert className="product-tracking-message">
            La consulta muestra hasta {spec.limit.toLocaleString("es-MX")}{" "}
            registros. Aplica filtros para acotar los resultados.
          </Alert>
        )}
        <DataGrid
          label={spec.title}
          rows={queried ? query.data?.items || [] : []}
          columns={traceColumns[view]}
          rowKey={(row, index) =>
            text(row.input_main_id ?? row.pcb_serial ?? row.lot_no) +
            ":" +
            index
          }
          minWidth={spec.minWidth}
          layout="fixed"
          virtualRows={{ rowHeight: 32 }}
          className="product-tracking-table"
          resetKey={JSON.stringify(applied)}
          loading={queried && query.isPending}
          fetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          emptyState={
            <EmptyState
              title={
                queried
                  ? "Sin registros"
                  : view === "por_pcb"
                    ? "Escanea un PCB"
                    : "Ingresa un lote de proveedor o material"
              }
              message={
                queried
                  ? "Sin trazabilidad para los filtros consultados."
                  : "Completa el filtro y pulsa Consultar."
              }
            />
          }
        />
      </Card>
      {historyOpen && first && (
        <Modal
          title="Historial de verificaciones"
          subtitle={text(first.pcb_serial) + " · " + text(first.proceso)}
          size="xl"
          onClose={() => setHistoryOpen(false)}
          className="product-tracking-dialog"
        >
          <DialogBody>
            <Card fill>
              <DataGrid<TraceRow>
                label="Historial de verificaciones"
                rows={history.data?.items || []}
                columns={historyColumns}
                rowKey={(row, index) =>
                  text(row.fecha) + ":" + text(row.hora) + ":" + index
                }
                minWidth={980}
                layout="fixed"
                virtualRows={{ rowHeight: 32 }}
                className="product-tracking-table"
                loading={history.isPending}
                fetching={history.isFetching}
                error={history.error}
                onRetry={() => void history.refetch()}
              />
            </Card>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setHistoryOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </Modal>
      )}
    </div>
  );
}
