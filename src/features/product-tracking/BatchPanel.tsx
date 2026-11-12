import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  EmptyState,
  ExportButton,
  TextField,
  TableToolbar,
} from "@/shared/ui";
import { batchColumns, type BatchRow } from "./columns";
import { stageNames, validateFile } from "./model";
import { useTracking } from "./useTracking";

export function BatchPanel({ active }: { active: boolean }) {
  const { api, scope } = useTracking();
  const [file, setFile] = useState<File | null>(null);
  const [applied, setApplied] = useState<{ file: File; id: string } | null>(
    null,
  );
  const [inputKey, setInputKey] = useState(0);
  const [issue, setIssue] = useState("");
  const compact = useMediaQuery("(max-width: 620px)");
  const [editingFile, setEditingFile] = useState(false);
  const collapsed = compact && !!applied && !editingFile;
  const query = useQuery({
    queryKey: ["product-tracking", scope, "batch", applied?.id],
    queryFn: ({ signal }) => api.batch(applied!.file, signal),
    enabled: active && !!applied,
    retry: false,
  });
  const columns = useMemo(
    () => batchColumns(query.data?.etapas || stageNames),
    [query.data?.etapas],
  );
  const rows = useMemo<BatchRow[]>(
    () =>
      query.data?.items.map((piece, index) => ({
        piece,
        sequence: index + 1,
        stages: Object.fromEntries(
          piece.etapas.map((stage) => [stage.etapa, stage]),
        ),
      })) || [],
    [query.data],
  );
  const exportForm = useForm({
    initialValues: {},
    validate: () => [validateFile(file)].filter(Boolean),
    onSubmit: () => api.exportBatch(file!),
  });
  return (
    <div className="product-tracking-panel">
      <TableToolbar
        actions={
          <ExportButton
            size="sm"
            loading={exportForm.pending}
            disabled={!file || query.isFetching}
            onClick={() => void exportForm.submit()}
          />
        }
      >
        {collapsed && (
          <div className="product-tracking-file-summary">
            <span title={file?.name}>{file?.name}</span>
            <Button size="sm" onClick={() => setEditingFile(true)}>
              Cambiar archivo
            </Button>
          </div>
        )}
        <form
          className="product-tracking-upload"
          hidden={collapsed}
          onSubmit={(event) => {
            event.preventDefault();
            const error = validateFile(file);
            setIssue(error);
            if (!error && file) {
              setApplied({ file, id: crypto.randomUUID() });
              setEditingFile(false);
            }
          }}
        >
          <TextField
            key={inputKey}
            label="Archivo Excel con los códigos"
            type="file"
            accept=".xlsx,.xlsm"
            hint="Se leen todas las celdas y hojas. Máximo 5000 códigos y 10 MB."
            disabled={exportForm.pending}
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setApplied(null);
              setIssue("");
            }}
          />
          <Button
            variant="primary"
            type="submit"
            disabled={query.isFetching || exportForm.pending}
          >
            Consultar
          </Button>
          <Button
            disabled={exportForm.pending}
            onClick={() => {
              setFile(null);
              setApplied(null);
              setInputKey((key) => key + 1);
              setIssue("");
            }}
          >
            Limpiar
          </Button>
        </form>
      </TableToolbar>
      <>
        <Card fill label="Tracking por lote">
          {(issue || exportForm.error || exportForm.errors[0]) && (
            <Alert className="product-tracking-message" tone="danger">
              {issue || exportForm.error?.message || exportForm.errors[0]}
            </Alert>
          )}
          {applied && query.data && (
            <div className="product-tracking-counts">
              {query.data.total} códigos · {query.data.encontrados} con
              historial · {query.data.no_encontrados} sin historial
            </div>
          )}
          <DataGrid
            label="Tracking por lote"
            rows={applied ? rows : []}
            columns={columns}
            rowKey={(row) => row.sequence}
            minWidth={
              950 + (query.data?.etapas.length || stageNames.length) * 150
            }
            layout="fixed"
            virtualRows={{ rowHeight: 32 }}
            className="product-tracking-table product-tracking-batch"
            resetKey={applied?.id}
            loading={!!applied && query.isPending}
            fetching={query.isFetching}
            error={query.error}
            onRetry={() => void query.refetch()}
            emptyState={
              <EmptyState
                title="Selecciona un archivo"
                message="Consulta un Excel con QR y barcodes para revisar sus etapas."
              />
            }
          />
        </Card>
      </>
    </div>
  );
}
