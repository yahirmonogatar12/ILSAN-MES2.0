import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Button,
  Card,
  DataGrid,
  FormMessages,
  IconButton,
  ProgressRing,
  TextField,
} from "@/shared/ui";
import { ExportAction } from "./components";
import type { Warehouse } from "./hooks";
import { number, rowKey, text } from "./model";
import { closureHistoryColumns, closurePreviewColumns } from "./closureColumns";
import { useInventoryClosure } from "./useInventoryClosure";
import "./closure.css";

export function InventoryClosure({
  warehouse,
  close,
}: {
  warehouse: Warehouse;
  close: () => void;
}) {
  const state = useInventoryClosure(warehouse);
  const data = state.data;
  const history = useMemo(
    () =>
      state.history.map((row) => ({
        ...row,
        date: row.confirmed_at || row.closed_at,
        user: row.confirmed_by || row.created_by,
      })),
    [state.history],
  );
  const columns = closureHistoryColumns(
    warehouse,
    state.busy,
    state.selectHistory,
  );
  return (
    <div
      className="shipping-warehouse-closure"
      aria-label="Cierre de inventario de embarques"
      role="region"
    >
      <Card
        title="Datos del cierre"
        className="shipping-warehouse-closure-metadata"
        icon={
          <IconButton
            label="Regresar a inventario"
            icon={<ArrowLeft size={18} />}
            disabled={state.busy}
            onClick={close}
          />
        }
        actions={
          <span
            className={
              "shipping-warehouse-closure-feedback" +
              (state.error || state.errors.length
                ? " shipping-warehouse-closure-feedback-error"
                : "")
            }
            role="status"
          >
            {state.error ? state.error.message : state.status}
          </span>
        }
      >
        <div className="shipping-warehouse-closure-controls">
          <TextField
            label="Fecha"
            readOnly
            value={text(data?.metadata.closureDate)}
          />
          <TextField
            label="Usuario"
            readOnly
            value={text(data?.metadata.closureUser)}
          />
          <TextField
            label="Mes del cierre"
            readOnly
            value={text(data?.metadata.closureMonthLabel)}
          />
          <TextField
            key={state.fileKey}
            type="file"
            accept=".csv,text/csv"
            label="CSV de inventario físico"
            disabled={state.busy || !state.bootstrap.data}
            onChange={(event) =>
              state.selectFile(event.target.files?.[0] ?? null)
            }
          />
          <ExportAction
            label="Descargar plantilla"
            run={warehouse.api.closureTemplate}
            disabled={state.busy}
          />
          <Button
            size="sm"
            disabled={state.busy}
            loading={state.pendingAction === "reset"}
            onClick={() => state.submit("reset")}
          >
            Reiniciar carga
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={state.pendingAction === "preview"}
            disabled={state.busy || !state.bootstrap.data}
            onClick={() => state.submit("preview")}
          >
            Validar preview
          </Button>
          <Button
            size="sm"
            variant="success"
            loading={state.pendingAction === "confirm"}
            disabled={!state.canConfirm}
            onClick={() => state.submit("confirm")}
          >
            Confirmar cierre
          </Button>
        </div>
        {(state.errors.length > 0 || state.error) && (
          <div className="shipping-warehouse-closure-errors">
            <FormMessages errors={state.errors} error={state.error} />
          </div>
        )}
      </Card>
      <div className="shipping-warehouse-closure-preview-layout">
        <Card
          title="Accuracy del cierre"
          className="shipping-warehouse-closure-accuracy"
        >
          <ProgressRing
            value={number(data?.summary.accuracyPct)}
            label="Accuracy"
          />
        </Card>
        <Card
          fill
          title="Preview del cierre"
          badge={
            (data?.rows.length ?? 0).toLocaleString("es-MX") + " registros"
          }
          className="shipping-warehouse-closure-preview"
        >
          <DataGrid
            label="Comparación de inventario"
            rows={data?.rows ?? []}
            columns={closurePreviewColumns}
            rowKey={rowKey}
            minWidth={760}
            layout="fixed"
            loading={state.bootstrap.isPending && !state.preview}
            error={state.preview ? null : state.bootstrap.error}
            onRetry={() => void state.bootstrap.refetch()}
            resetKey={state.preview?.batchCode || "baseline-" + state.fileKey}
            virtualRows={{ rowHeight: 38 }}
          />
        </Card>
      </div>
      <Card
        fill
        title="Historial de cierres"
        badge={history.length + " registros"}
        className="shipping-warehouse-closure-history"
      >
        <DataGrid
          label="Historial de cierres"
          rows={history}
          columns={columns}
          rowKey={rowKey}
          minWidth={900}
          layout="fixed"
          loading={state.bootstrap.isPending}
          error={state.bootstrap.error}
          onRetry={() => void state.bootstrap.refetch()}
        />
      </Card>
    </div>
  );
}
