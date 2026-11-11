import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  ConfirmDialog,
  DataGrid,
  DialogBody,
  DialogFooter,
  ErrorState,
  FormSection,
  KeyValueGrid,
  Loading,
  Modal,
  TextField,
  type TableColumn,
} from "@/shared/ui";
import { allowedAction, isKs, singleEcoModel } from "./model";
import { EcoDifferences } from "./EcoDifferences";
import { FileManager } from "./Files";
import type { BomApi, EcoRow, ItemData } from "./types";

function columns(fields: [string, string][]): TableColumn<ItemData>[] {
  return fields.map(([id, header]) => ({
    id,
    header,
    cell: (row) =>
      row[id] == null
        ? "—"
        : typeof row[id] === "object"
          ? JSON.stringify(row[id])
          : String(row[id]),
    sortValue: (row) => String(row[id] ?? ""),
  }));
}
const scopeColumns = columns([
  ["part_no", "MODELO"],
  ["family_prefix", "FAMILIA"],
  ["bom_revision", "REVISIÓN"],
]);
const itemColumns = columns([
  ["material_code", "MATERIAL"],
  ["item_name", "NOMBRE"],
  ["qty", "CANTIDAD"],
  ["unit", "UNIDAD"],
  ["location_text", "UBICACIÓN"],
  ["tipo_material", "TIPO DE MATERIAL"],
]);
type Action = "approve" | "cancel" | "delete";
export function EcoDetailDialog({
  row,
  api,
  scope,
  canCreate,
  canApprove,
  onClose,
  onChanged,
}: {
  row: EcoRow;
  api: BomApi;
  scope: string;
  canCreate: boolean;
  canApprove: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const ks = isKs(row);
  const query = useQuery({
    queryKey: ["bom", scope, "detail", row.id],
    queryFn: ({ signal }) => api.detail(row, signal),
    staleTime: 0,
  });
  const diff = useQuery({
    queryKey: ["bom", scope, "diff", row.id],
    queryFn: ({ signal }) => api.diff(Number(row.id), signal),
    enabled: !ks,
    staleTime: 0,
  });
  const record = query.data ? { ...row, ...query.data } : row;
  const [action, setAction] = useState<Action | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [filesBusy, setFilesBusy] = useState(false);
  const mutate = useMutation({
    mutationFn: async (action: Action) => {
      if (!allowedAction(record, action, canCreate, canApprove))
        throw new Error("La acción no está permitida para este ECO.");
      await api.action(Number(record.id), action);
    },
    onSuccess: (_, action) => {
      setAction(null);
      if (action === "delete") onClose();
      onChanged(
        action === "approve"
          ? "ECO aprobado y publicado."
          : action === "cancel"
            ? "ECO cancelado."
            : "ECO eliminado.",
      );
    },
  });
  const importItems = useMutation({
    mutationFn: async () => {
      if (!file || record.status !== "DRAFT" || !canCreate)
        throw new Error("Selecciona el Excel para un ECO en borrador.");
      await api.importItems(Number(record.id), file);
    },
    onSuccess: () => {
      setFile(null);
      setFileKey((previous) => previous + 1);
      onChanged("Ítems importados. Revisa las diferencias antes de aprobar.");
    },
  });
  const busy = mutate.isPending || importItems.isPending || filesBusy;
  const current =
    query.isSuccess &&
    !query.isFetching &&
    diff.isSuccess &&
    !diff.isFetching &&
    !diff.isError;
  return (
    <Modal
      title={`${ks ? "ECN KS" : "Detalle ECO"} · ${record.eco_no}`}
      className="bom-detail"
      size="xl"
      busy={busy}
      onClose={onClose}
    >
      <DialogBody>
        {query.error ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : !query.data ? (
          <Loading />
        ) : (
          <>
            <KeyValueGrid
              items={[
                { label: "Modelo", value: record.part_no },
                { label: "Revisión", value: record.bom_revision },
                { label: "Fecha efectiva", value: record.effective_at },
                { label: "Estado", value: record.status },
                ...(ks
                  ? [
                      { label: "Origen", value: "KS" },
                      { label: "Aprobado por", value: record.approved_by },
                      { label: "Notas", value: record.notes },
                    ]
                  : []),
              ]}
            />
            {ks ? (
              <KeyValueGrid
                items={Object.entries(query.data)
                  .filter(
                    ([key, value]) =>
                      typeof value !== "object" &&
                      ![
                        "part_no",
                        "bom_revision",
                        "effective_at",
                        "status",
                        "origen",
                        "approved_by",
                        "notes",
                      ].includes(key),
                  )
                  .map(([label, value]) => ({
                    label,
                    value: String(value ?? "—"),
                  }))}
              />
            ) : (
              <>
                {diff.error ? (
                  <ErrorState
                    error={diff.error}
                    onRetry={() => void diff.refetch()}
                  />
                ) : diff.isPending ? (
                  <Loading text="Cargando diferencias…" />
                ) : (
                  diff.data && (
                    <EcoDifferences
                      diff={diff.data}
                      model={singleEcoModel(query.data)}
                    />
                  )
                )}
                <FormSection title="Información adicional del ECO">
                  <KeyValueGrid
                    items={[
                      { label: "Origen", value: "MES" },
                      { label: "Aprobado por", value: record.approved_by },
                      { label: "Notas", value: record.notes },
                    ]}
                  />
                </FormSection>
                {!!query.data.scope?.length && (
                  <FormSection title="Modelos del alcance">
                    <DataGrid
                      label="Alcance del ECO"
                      rows={query.data.scope}
                      columns={scopeColumns}
                      rowKey={(item) => String(item.part_no)}
                      paginate={false}
                      minWidth={600}
                      maxHeight="180px"
                    />
                  </FormSection>
                )}
                {!!query.data.items?.length && (
                  <details className="bom-items">
                    <summary>
                      Ítems completos del ECO ({query.data.items.length})
                    </summary>
                    <DataGrid
                      label="Ítems del ECO"
                      rows={query.data.items}
                      columns={itemColumns}
                      rowKey={(item) => String(item.id ?? JSON.stringify(item))}
                      minWidth={750}
                      maxHeight="280px"
                    />
                  </details>
                )}
                {record.status === "DRAFT" && canCreate && (
                  <FormSection title="Reemplazar ítems del borrador">
                    <div className="bom-upload">
                      <TextField
                        key={fileKey}
                        label="Excel completo de BOM"
                        type="file"
                        accept=".xlsx,.xlsm"
                        disabled={busy}
                        onChange={(event) =>
                          setFile(event.target.files?.[0] || null)
                        }
                      />
                      <Button
                        disabled={!file || busy || !current}
                        loading={importItems.isPending}
                        onClick={() => importItems.mutate()}
                      >
                        Importar ítems
                      </Button>
                    </div>
                    {importItems.error && (
                      <Alert tone="danger">{importItems.error.message}</Alert>
                    )}
                  </FormSection>
                )}
                <FileManager
                  id={Number(record.id)}
                  status={record.status}
                  api={api}
                  scope={scope}
                  canCreate={canCreate}
                  onBusy={setFilesBusy}
                />
              </>
            )}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        {query.isSuccess &&
          !query.isError &&
          !ks &&
          (["approve", "cancel", "delete"] as const)
            .filter((value) =>
              allowedAction(record, value, canCreate, canApprove),
            )
            .map((value) => (
              <Button
                key={value}
                variant={
                  value === "approve"
                    ? "success"
                    : value === "delete"
                      ? "danger"
                      : "secondary"
                }
                disabled={busy || !current}
                onClick={() => {
                  mutate.reset();
                  setAction(value);
                }}
              >
                {value === "approve"
                  ? "Aprobar ECO"
                  : value === "cancel"
                    ? "Cancelar ECO"
                    : "Borrar ECO"}
              </Button>
            ))}
        <Button disabled={busy} onClick={onClose}>
          Cerrar
        </Button>
      </DialogFooter>
      {action && (
        <ConfirmDialog
          title={
            action === "approve"
              ? "Aprobar y publicar ECO"
              : action === "cancel"
                ? "Cancelar ECO"
                : "Borrar ECO"
          }
          confirmLabel={
            action === "approve"
              ? "Aprobar y publicar"
              : action === "cancel"
                ? "Cancelar ECO"
                : "Borrar ECO"
          }
          confirmVariant={action === "approve" ? "success" : "danger"}
          pending={mutate.isPending}
          error={mutate.error}
          onConfirm={() => mutate.mutate(action)}
          onClose={() => setAction(null)}
        >
          <p>
            {record.eco_no} · {record.part_no} · revisión {record.bom_revision}
          </p>
          {action === "approve" && (
            <>
              <p>
                Se aplicarán los cambios al BOM KS y el ECO quedará aprobado e
                inmutable.
              </p>
              <p>
                {diff.data?.counts.added || 0} añadidos,{" "}
                {diff.data?.counts.modified || 0} modificados y{" "}
                {diff.data?.counts.removed || 0} eliminados.
              </p>
              {diff.data?.warning?.message && (
                <Alert tone="warning">{diff.data.warning.message}</Alert>
              )}
            </>
          )}
        </ConfirmDialog>
      )}
    </Modal>
  );
}
