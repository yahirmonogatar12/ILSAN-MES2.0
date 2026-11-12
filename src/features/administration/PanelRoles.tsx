import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Download,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import {
  Button,
  Card,
  ConfirmDialog,
  DataGrid,
  ErrorState,
  ExportButton,
  FilterBar,
  TableRowActions,
  type TableColumn,
} from "@/shared/ui";
import { PermissionEditor } from "./PermissionEditor";
import { PanelRoleForm } from "./PanelRoleForm";
import { PanelLayout } from "./PanelLayout";
import { panelKeys, usePanel } from "./usePanel";
import { normalizeSearch } from "./model";
import type { RoleRecord } from "./types";

export default function PanelRoles() {
  const { api, scope, saved } = usePanel();
  const roles = useQuery({
    queryKey: panelKeys.data(scope, "roles"),
    queryFn: ({ signal }) => api.roles(signal),
  });
  const departments = useQuery({
    queryKey: panelKeys.data(scope, "departments"),
    queryFn: ({ signal }) => api.departments(signal),
  });
  const [search, setSearch] = useState({ search: "" });
  const [applied, setApplied] = useState(search);
  const [dialog, setDialog] = useState<
    | { type: "role"; row: RoleRecord | null }
    | { type: "permissions" | "delete"; row: RoleRecord }
    | { type: "sync" }
    | null
  >(null);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (dialog?.type === "delete") {
        await api.deleteRole(dialog.row.id);
        return "Rol eliminado.";
      }
      return api.synchronize();
    },
    onSuccess: (message) => {
      setDialog(null);
      saved(message);
    },
  });
  const exporter = useMutation({
    mutationFn: async (role: RoleRecord | null) => {
      if (!role) {
        await exportSpreadsheet("Roles.xlsx", [
          {
            name: "Roles",
            rows: [
              ["Rol", "Descripción", "Nivel", "Departamento", "Usuarios"],
              ...rows.map((row) => [
                row.nombre,
                row.descripcion,
                row.nivel,
                row.departamento,
                row.total_usuarios,
              ]),
            ],
          },
        ]);
        return;
      }
      const [catalog, selected] = await Promise.all([
        api.availablePermissions(),
        api.rolePermissions(role.id),
      ]);
      const assigned = new Set(selected);
      await exportSpreadsheet("Permisos.xlsx", [
        {
          name: "Permisos",
          rows: [
            ["Rol", "Página", "Sección", "Permiso", "Descripción", "Asignado"],
            ...Object.entries(catalog).flatMap(([page, sections]) =>
              Object.entries(sections).flatMap(([section, items]) =>
                items.map((item) => [
                  role.nombre,
                  page,
                  section,
                  item.boton,
                  item.descripcion,
                  assigned.has(item.id),
                ]),
              ),
            ),
          ],
        },
      ]);
    },
  });
  const records = useMemo(() => roles.data || [], [roles.data]);
  const rows = useMemo(
    () =>
      records.filter((role) =>
        normalizeSearch(
          [role.nombre, role.descripcion, role.departamento].join(" "),
        ).includes(normalizeSearch(applied.search.trim())),
      ),
    [records, applied],
  );
  const columns = useMemo<TableColumn<RoleRecord>[]>(
    () => [
      {
        id: "name",
        header: "ROL",
        width: "20%",
        cell: (row) => (
          <strong className="administration-panel-role">{row.nombre}</strong>
        ),
        sortValue: (row) => row.nombre,
      },
      {
        id: "description",
        header: "DESCRIPCIÓN",
        width: "30%",
        cell: (row) => row.descripcion || "—",
        sortValue: (row) => row.descripcion,
      },
      {
        id: "level",
        header: "NIVEL",
        cell: (row) => (
          <span className="administration-panel-status">
            {row.nivel >= 8 ? `Sistema · ${row.nivel}` : row.nivel}
          </span>
        ),
        sortValue: (row) => row.nivel,
      },
      {
        id: "department",
        header: "DEPARTAMENTO",
        cell: (row) => row.departamento || "Transversal",
        sortValue: (row) => row.departamento,
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
        width: 145,
        filterable: false,
        cell: (row) => (
          <TableRowActions
            actions={[
              {
                id: "permissions",
                label: `Permisos de ${row.nombre}`,
                icon: <SlidersHorizontal size={16} />,
                onClick: () => setDialog({ type: "permissions", row }),
              },
              {
                id: "edit",
                label: `Editar rol ${row.nombre}`,
                icon: <Pencil size={16} />,
                disabled: !departments.isSuccess,
                onClick: () => setDialog({ type: "role", row }),
              },
              {
                id: "export",
                label: `Exportar permisos de ${row.nombre}`,
                icon: (
                  <Download size={16} className="administration-panel-export" />
                ),
                disabled: exporter.isPending,
                onClick: () => exporter.mutate(row),
              },
              {
                id: "delete",
                label: `Eliminar rol ${row.nombre}`,
                icon: <Trash2 size={16} />,
                tone: "danger",
                disabled: row.nivel >= 8 || row.total_usuarios > 0,
                onClick: () => {
                  mutation.reset();
                  setDialog({ type: "delete", row });
                },
              },
            ]}
          />
        ),
      },
    ],
    [departments.isSuccess, exporter, mutation],
  );
  return (
    <PanelLayout>
      <FilterBar
        actions={
          <>
            <Button
              size="sm"
              icon={<RefreshCw size={15} />}
              disabled={roles.isFetching}
              onClick={() => {
                void roles.refetch();
                void departments.refetch();
              }}
            >
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                mutation.reset();
                setDialog({ type: "sync" });
              }}
            >
              Sincronizar permisos
            </Button>
            <ExportButton
              size="sm"
              loading={exporter.isPending}
              disabled={!roles.isSuccess}
              onClick={() => exporter.mutate(null)}
            />
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={16} />}
              disabled={!roles.isSuccess || !departments.isSuccess}
              onClick={() => setDialog({ type: "role", row: null })}
            >
              Nuevo rol
            </Button>
          </>
        }
        fields={[
          {
            key: "search",
            label: "Buscar rol",
            type: "search",
            placeholder: "Rol, descripción o departamento…",
          },
        ]}
        values={search}
        defaults={{ search: "" }}
        onChange={(patch) => setSearch((value) => ({ ...value, ...patch }))}
        onSubmit={() => setApplied(search)}
        onReset={() => {
          setSearch({ search: "" });
          setApplied({ search: "" });
        }}
      />
      <Card fill label="Roles del sistema">
        {departments.error && (
          <ErrorState
            error={departments.error}
            onRetry={() => void departments.refetch()}
          />
        )}
        {exporter.error && <ErrorState error={exporter.error} />}
        <DataGrid
          label="Roles del sistema"
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          minWidth={850}
          layout="fixed"
          itemLabel="roles"
          resetKey={applied.search}
          loading={roles.isPending}
          error={roles.error}
          onRetry={() => void roles.refetch()}
        />
      </Card>
      {dialog?.type === "role" && (
        <PanelRoleForm
          record={dialog.row}
          roles={records}
          departments={departments.data || []}
          api={api}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            saved("Rol guardado.");
          }}
        />
      )}
      {dialog?.type === "permissions" && (
        <PermissionEditor
          record={dialog.row}
          context={{ es_superadmin: true, departamento: null }}
          api={api}
          scope={scope + ":panel"}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null);
            saved(message);
          }}
        />
      )}
      {(dialog?.type === "sync" || dialog?.type === "delete") && (
        <ConfirmDialog
          title={
            dialog.type === "sync"
              ? "Sincronizar catálogo de permisos"
              : "Eliminar rol"
          }
          confirmLabel={dialog.type === "sync" ? "Sincronizar" : "Eliminar"}
          confirmVariant={dialog.type === "sync" ? "primary" : "danger"}
          pending={mutation.isPending}
          error={mutation.error}
          onConfirm={() => mutation.mutate()}
          onClose={() => setDialog(null)}
        >
          <p>
            {dialog.type === "sync"
              ? "Se actualizará el catálogo desde los menús del MES original. Los permisos obsoletos se desactivarán."
              : `Se eliminará el rol ${dialog.row.nombre} y sus asignaciones de permisos.`}
          </p>
        </ConfirmDialog>
      )}
    </PanelLayout>
  );
}
