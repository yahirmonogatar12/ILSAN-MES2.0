import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Trash2, Upload } from "lucide-react";
import {
  Alert,
  Button,
  ConfirmDialog,
  DataGrid,
  DialogBody,
  DialogFooter,
  ErrorState,
  FilePreview,
  Loading,
  Modal,
  TableRowActions,
  TextField,
  type TableColumn,
} from "@/shared/ui";
import type { BomApi, FileRecord } from "./types";

export function FileManager({
  id,
  status,
  api,
  scope,
  canCreate,
  onBusy,
}: {
  id: number;
  status: string;
  api: BomApi;
  scope: string;
  canCreate: boolean;
  onBusy?: (value: boolean) => void;
}) {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["bom", scope, "files", id],
    queryFn: ({ signal }) => api.files(id, signal),
  });
  const [selected, setSelected] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const [remove, setRemove] = useState<FileRecord | null>(null);
  const [preview, setPreview] = useState<FileRecord | null>(null);
  const [validation, setValidation] = useState("");
  const upload = useMutation({
    mutationFn: async () => {
      for (const file of selected) {
        await api.upload(id, file);
        setSelected((previous) => previous.filter((item) => item !== file));
      }
    },
    onSuccess: () => setInputKey((previous) => previous + 1),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["bom", scope, "files", id] });
    },
  });
  const deletion = useMutation({
    mutationFn: (file: FileRecord) => api.removeFile(id, file.id),
    onSuccess: () => {
      setRemove(null);
      void client.invalidateQueries({ queryKey: ["bom", scope, "files", id] });
    },
  });
  const download = useMutation({
    mutationFn: (file: FileRecord) => api.download(id, file),
  });
  const busy = upload.isPending || deletion.isPending;
  const downloadFile = download.mutate;
  const downloadPending = download.isPending;
  const resetDeletion = deletion.reset;
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);
  const columns = useMemo<TableColumn<FileRecord>[]>(
    () => [
      { id: "name", header: "ARCHIVO", cell: (row) => row.nombre_original },
      { id: "extension", header: "TIPO", cell: (row) => row.extension },
      {
        id: "user",
        header: "SUBIDO POR",
        cell: (row) => row.created_by || "—",
      },
      { id: "date", header: "FECHA", cell: (row) => row.created_at || "—" },
      {
        id: "actions",
        header: "ACCIONES",
        filterable: false,
        cell: (row) => (
          <TableRowActions
            actions={[
              {
                id: "view",
                label: `Ver ${row.nombre_original}`,
                icon: <Eye size={15} />,
                onClick: () => setPreview(row),
              },
              {
                id: "download",
                label: `Descargar ${row.nombre_original}`,
                icon: <Download size={15} />,
                disabled: downloadPending,
                onClick: () => downloadFile(row),
              },
              ...(canCreate && status !== "APPROVED"
                ? [
                    {
                      id: "delete",
                      label: `Borrar ${row.nombre_original}`,
                      icon: <Trash2 size={15} />,
                      tone: "danger" as const,
                      disabled: busy,
                      onClick: () => {
                        resetDeletion();
                        setRemove(row);
                      },
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [canCreate, status, busy, downloadFile, downloadPending, resetDeletion],
  );
  return (
    <section className="bom-files">
      <h3>Archivos</h3>
      {canCreate && (
        <fieldset className="form-fieldset" disabled={busy}>
          <div className="bom-upload">
            <TextField
              key={inputKey}
              label="Adjuntar HTML, PPT/PPTX o PDF"
              type="file"
              multiple
              accept=".html,.htm,.ppt,.pptx,.pdf"
              onChange={(event) => {
                const files = [...(event.target.files || [])];
                const invalid = files.find(
                  (file) =>
                    !/\.(html?|pptx?|pdf)$/i.test(file.name) ||
                    file.size > 50 * 1024 * 1024,
                );
                setValidation(
                  invalid
                    ? `${invalid.name}: formato no admitido o mayor a 50 MB.`
                    : "",
                );
                setSelected(invalid ? [] : files);
              }}
            />
            <Button
              icon={<Upload size={15} />}
              loading={upload.isPending}
              disabled={!selected.length}
              onClick={() => upload.mutate()}
            >
              Adjuntar{selected.length > 1 ? ` (${selected.length})` : ""}
            </Button>
          </div>
        </fieldset>
      )}
      {(validation || upload.error || download.error) && (
        <Alert tone="danger">
          {validation || upload.error?.message || download.error?.message}
        </Alert>
      )}
      <DataGrid
        label="Archivos del ECO"
        rows={list.data || []}
        columns={columns}
        rowKey={(row) => row.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        paginate={false}
        minWidth={650}
        maxHeight="260px"
      />
      {remove && (
        <ConfirmDialog
          title="Borrar archivo"
          pending={deletion.isPending}
          error={deletion.error}
          onConfirm={() => deletion.mutate(remove)}
          onClose={() => setRemove(null)}
          confirmLabel="Borrar archivo"
        >
          <p>{remove.nombre_original}</p>
        </ConfirmDialog>
      )}
      {preview && (
        <Preview
          key={preview.id}
          id={id}
          file={preview}
          api={api}
          scope={scope}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
function Preview({
  id,
  file,
  api,
  scope,
  onClose,
}: {
  id: number;
  file: FileRecord;
  api: BomApi;
  scope: string;
  onClose: () => void;
}) {
  const blob = useQuery({
    queryKey: ["bom", scope, "blob", id, file.id],
    queryFn: ({ signal }) => api.fileBlob(id, file, signal),
    gcTime: 0,
  });
  return (
    <Modal
      title={file.nombre_original}
      className="bom-preview"
      size="lg"
      onClose={onClose}
    >
      <DialogBody>
        {blob.error ? (
          <ErrorState error={blob.error} onRetry={() => void blob.refetch()} />
        ) : blob.data ? (
          <FilePreview blob={blob.data} name={file.nombre_original} />
        ) : (
          <Loading text="Cargando archivo…" />
        )}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
export function Paperwork({
  part,
  api,
  scope,
  onClose,
}: {
  part: string;
  api: BomApi;
  scope: string;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["bom", scope, "paperwork", part],
    queryFn: ({ signal }) => api.paperwork(part, signal),
    staleTime: 0,
  });
  return (
    <Modal title={`Papelería · ${part}`} size="lg" onClose={onClose}>
      <DialogBody>
        {query.error ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : query.isPending ? (
          <Loading />
        ) : query.data.eco ? (
          <FileManager
            id={Number(query.data.eco.id)}
            status={query.data.eco.status}
            api={api}
            scope={scope}
            canCreate={false}
          />
        ) : (
          <p>No hay papelería registrada para este modelo.</p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
