import { useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  ErrorState,
  Page,
  TableRowActions,
  type TableColumn,
  TableToolbar,
} from "@/shared/ui";
import { useAuthorities } from "./useAdministration";
import { canManage } from "./model";
import { RoleForm } from "./RoleForm";
import { PermissionEditor } from "./PermissionEditor";
import type { RoleRecord } from "./types";
import "./module.css";

export default function AuthoritiesPage() {
  const { api, scope, context, list, afterSaved } = useAuthorities();
  const [dialog, setDialog] = useState<
    | { type: "role"; record: RoleRecord | null }
    | { type: "permissions"; record: RoleRecord }
    | null
  >(null);
  const ready =
    !!context.data && !context.isError && !list.isError && list.isSuccess;
  const allowed =
    !!context.data &&
    canManage(context.data.es_superadmin, context.data.departamento);
  const columns = useMemo<TableColumn<RoleRecord>[]>(
    () => [
      {
        id: "name",
        header: "ROL",
        cell: (row) => row.nombre,
        sortValue: (row) => row.nombre,
      },
      {
        id: "description",
        header: "DESCRIPCIÓN",
        cell: (row) => row.descripcion || "—",
        sortValue: (row) => row.descripcion,
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
        align: "center",
      },
      {
        id: "actions",
        header: "ACCIONES",
        filterable: false,
        cell: (row) => (
          <TableRowActions
            actions={[
              {
                id: "edit",
                label: `Editar rol ${row.nombre}`,
                icon: <Pencil size={15} />,
                disabled:
                  !ready ||
                  !allowed ||
                  ["admin", "superadmin"].includes(row.nombre),
                onClick: () => setDialog({ type: "role", record: row }),
              },
              {
                id: "permissions",
                label: `Permisos de ${row.nombre}`,
                icon: <SlidersHorizontal size={16} />,
                disabled:
                  !ready ||
                  !allowed ||
                  ["admin", "superadmin"].includes(row.nombre),
                onClick: () => setDialog({ type: "permissions", record: row }),
              },
            ]}
          />
        ),
      },
    ],
    [ready, allowed],
  );
  const saved = (message: string) => {
    setDialog(null);
    afterSaved(message);
  };
  return (
    <Page className="administration-module" banner={<DemoBanner />}>
      <>
        <TableToolbar
          actions={
            <>
              <span className="administration-scope">
                {context.data?.es_superadmin
                  ? "Todos los departamentos"
                  : context.data?.departamento}
              </span>
              <Button
                size="sm"
                icon={<RefreshCw size={16} />}
                disabled={context.isFetching || list.isFetching}
                onClick={() => {
                  void context.refetch();
                  void list.refetch();
                }}
              >
                Actualizar
              </Button>
              <Button
                size="sm"
                variant="success"
                icon={<Plus size={15} />}
                disabled={!ready || !allowed}
                onClick={() => setDialog({ type: "role", record: null })}
              >
                Nuevo rol
              </Button>
            </>
          }
        />
        <Card fill label="Roles registrados">
          {context.error ? (
            <ErrorState
              error={context.error}
              onRetry={() => void context.refetch()}
            />
          ) : (
            <>
              {context.data && !allowed && (
                <Alert tone="warning" className="table-notice">
                  Tu usuario no tiene departamento asignado. Solicita la
                  asignación para administrar roles.
                </Alert>
              )}
              <DataGrid
                label="Roles registrados"
                rows={list.data || []}
                columns={columns}
                rowKey={(row) => row.id}
                itemLabel="roles"
                minWidth={780}
                initialSort={{ columnId: "name", direction: "asc" }}
                loading={context.isPending || list.isPending}
                error={list.error}
                onRetry={() => void list.refetch()}
              />
            </>
          )}
        </Card>
      </>
      {dialog?.type === "role" && context.data && (
        <RoleForm
          record={dialog.record}
          context={context.data}
          roles={list.data || []}
          api={api}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.type === "permissions" && context.data && (
        <PermissionEditor
          key={dialog.record.id}
          record={dialog.record}
          context={context.data}
          api={api}
          scope={scope}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </Page>
  );
}
