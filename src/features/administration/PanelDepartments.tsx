import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Button,
  Card,
  CheckboxField,
  ConfirmDialog,
  DataGrid,
  DialogBody,
  FormActions,
  FormMessages,
  Modal,
  TableRowActions,
  TextField,
  type TableColumn,
} from "@/shared/ui";
import { PanelLayout } from "./PanelLayout";
import { PermissionAreas } from "./PermissionAreas";
import { panelKeys, usePanel } from "./usePanel";
import { normalizeSearch } from "./model";
import type { Department, PanelApi } from "./panelTypes";

function DepartmentForm({
  record,
  records,
  api,
  onClose,
  onSaved,
}: {
  record: Department | null;
  records: Department[];
  api: PanelApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm({
    initialValues: {
      nombre: record?.nombre || "",
      activo: record?.activo ?? 1,
    },
    validate: (values) => {
      if (!values.nombre.trim()) return ["Escribe el nombre del departamento."];
      if (
        records.some(
          (row) =>
            row.id !== record?.id &&
            normalizeSearch(row.nombre) ===
              normalizeSearch(values.nombre.trim()),
        )
      )
        return ["Ya existe otro departamento con ese nombre."];
      return [];
    },
    onSubmit: async (values) => {
      await api.saveDepartment(record, values.nombre, values.activo);
      onSaved();
    },
  });
  return (
    <Modal
      title={record ? "Editar departamento" : "Nuevo departamento"}
      onClose={onClose}
      busy={form.pending}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            <TextField
              label="Nombre del departamento"
              required
              initialFocus
              value={form.values.nombre}
              onChange={(event) => form.setField("nombre", event.target.value)}
            />
            {record && (
              <CheckboxField
                label="Departamento activo"
                checked={!!form.values.activo}
                onChange={(event) =>
                  form.setField("activo", event.target.checked ? 1 : 0)
                }
              />
            )}
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <FormActions pending={form.pending} onCancel={onClose} />
        </fieldset>
      </form>
    </Modal>
  );
}
export default function PanelDepartments() {
  const { api, scope, saved } = usePanel();
  const list = useQuery({
    queryKey: panelKeys.data(scope, "departments"),
    queryFn: ({ signal }) => api.departments(signal),
  });
  const [dialog, setDialog] = useState<
    | { kind: "edit"; row: Department | null }
    | { kind: "delete"; row: Department }
    | { kind: "areas" }
    | null
  >(null);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (dialog?.kind === "delete") await api.deleteDepartment(dialog.row.id);
    },
    onSuccess: () => {
      setDialog(null);
      saved("Departamento eliminado.");
    },
  });
  const records = useMemo(() => list.data || [], [list.data]);
  const columns = useMemo<TableColumn<Department>[]>(
    () => [
      {
        id: "name",
        header: "DEPARTAMENTO",
        width: "45%",
        cell: (row) => (
          <strong className="administration-panel-role">{row.nombre}</strong>
        ),
        sortValue: (row) => row.nombre,
      },
      {
        id: "state",
        header: "ESTADO",
        cell: (row) => (
          <span
            className={`administration-panel-status ${row.activo ? "administration-panel-active" : ""}`}
          >
            {row.activo ? "Activo" : "Inactivo"}
          </span>
        ),
        textValue: (row) => (row.activo ? "Activo" : "Inactivo"),
        sortValue: (row) => row.activo,
      },
      {
        id: "users",
        header: "USUARIOS",
        cell: (row) => row.total_usuarios,
        sortValue: (row) => row.total_usuarios,
      },
      {
        id: "actions",
        header: "ACCIONES",
        width: 110,
        filterable: false,
        cell: (row) => (
          <TableRowActions
            actions={[
              {
                id: "edit",
                label: `Editar departamento ${row.nombre}`,
                icon: <Pencil size={16} />,
                onClick: () => setDialog({ kind: "edit", row }),
              },
              {
                id: "delete",
                label: `Eliminar departamento ${row.nombre}`,
                icon: <Trash2 size={16} />,
                tone: "danger",
                disabled: row.total_usuarios > 0,
                onClick: () => {
                  mutation.reset();
                  setDialog({ kind: "delete", row });
                },
              },
            ]}
          />
        ),
      },
    ],
    [mutation],
  );
  return (
    <PanelLayout>
      <Card
        fill
        title="Organización"
        badge={list.data?.length ?? "—"}
        actions={
          <>
            <Button
              size="sm"
              icon={<RefreshCw size={15} />}
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              Actualizar
            </Button>
            <Button
              size="sm"
              icon={<SlidersHorizontal size={16} />}
              disabled={!list.isSuccess}
              onClick={() => setDialog({ kind: "areas" })}
            >
              Áreas de permisos
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={16} />}
              disabled={!list.isSuccess}
              onClick={() => setDialog({ kind: "edit", row: null })}
            >
              Nuevo departamento
            </Button>
          </>
        }
      >
        <DataGrid
          label="Departamentos"
          rows={records}
          columns={columns}
          rowKey={(row) => row.id}
          minWidth={620}
          layout="fixed"
          itemLabel="departamentos"
          loading={list.isPending}
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      </Card>
      {dialog?.kind === "edit" && (
        <DepartmentForm
          record={dialog.row}
          records={records}
          api={api}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            saved("Departamento guardado.");
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title="Eliminar departamento"
          pending={mutation.isPending}
          error={mutation.error}
          confirmLabel="Eliminar"
          onConfirm={() => mutation.mutate()}
          onClose={() => setDialog(null)}
        >
          <p>Se eliminará el departamento {dialog.row.nombre}.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === "areas" && (
        <PermissionAreas
          api={api}
          scope={scope}
          departments={records}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </PanelLayout>
  );
}
