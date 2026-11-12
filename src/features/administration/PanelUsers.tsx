import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, Power, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  ConfirmDialog,
  DataGrid,
  ErrorState,
  FilterBar,
  TableRowActions,
  type TableColumn,
} from "@/shared/ui";
import { userEditIssue, normalizeSearch } from "./model";
import { UserForm } from "./UserForm";
import { PanelLayout } from "./PanelLayout";
import { panelKeys, usePanel } from "./usePanel";
import type { PanelUser } from "./panelTypes";

const defaults = { search: "", estado: "", departamento: "" };
export default function PanelUsers() {
  const { api, scope, profile, saved } = usePanel();
  const users = useQuery({
    queryKey: panelKeys.data(scope, "users"),
    queryFn: ({ signal }) => api.users(signal),
  });
  const context = useQuery({
    queryKey: panelKeys.data(scope, "context"),
    queryFn: ({ signal }) => api.userContext(signal),
  });
  const [filters, setFilters] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [edit, setEdit] = useState<{ record: PanelUser | null } | null>(null);
  const [action, setAction] = useState<{
    kind: "state" | "unlock";
    row: PanelUser;
  } | null>(null);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!action) return;
      if (action.kind === "unlock") await api.unlock(action.row.username);
      else await api.changeState(action.row.username, !action.row.activo);
    },
    onSuccess: () => {
      setAction(null);
      saved("Usuario actualizado.");
    },
  });
  const records = useMemo(() => users.data || [], [users.data]);
  const roleList = useQuery({
    queryKey: panelKeys.data(scope, "roles"),
    queryFn: ({ signal }) => api.roles(signal),
  });
  const formContext = useMemo(
    () =>
      context.data && roleList.data
        ? {
            ...context.data,
            roles: roleList.data.map((role) => role.nombre),
          }
        : undefined,
    [context.data, roleList.data],
  );
  const rows = useMemo(
    () =>
      records.filter(
        (row) =>
          normalizeSearch(
            [row.username, row.nombre_completo, row.email, row.cargo].join(" "),
          ).includes(normalizeSearch(applied.search.trim())) &&
          (!applied.departamento ||
            row.departamento === applied.departamento) &&
          (!applied.estado ||
            (applied.estado === "bloqueado"
              ? row.bloqueado
              : applied.estado === "activo"
                ? !!row.activo
                : !row.activo)),
      ),
    [records, applied],
  );
  const columns = useMemo<TableColumn<PanelUser>[]>(
    () => [
      {
        id: "user",
        header: "USUARIO",
        width: "18%",
        cell: (row) => (
          <div className="administration-panel-person">
            <span>{row.nombre_completo.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{row.username}</strong>
              <small>{row.email || row.cargo || "—"}</small>
            </div>
          </div>
        ),
        textValue: (row) => row.username,
        sortValue: (row) => row.username,
      },
      {
        id: "name",
        header: "NOMBRE COMPLETO",
        width: "21%",
        cell: (row) => row.nombre_completo,
        sortValue: (row) => row.nombre_completo,
      },
      {
        id: "department",
        header: "DEPARTAMENTO",
        cell: (row) => row.departamento || "—",
        sortValue: (row) => row.departamento,
      },
      {
        id: "roles",
        header: "ROLES",
        width: "20%",
        cell: (row) => (
          <div className="administration-panel-tags">
            {row.roles.map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>
        ),
        textValue: (row) => row.roles.join(", "),
        sortValue: (row) => row.roles.join(", "),
      },
      {
        id: "state",
        header: "ESTADO",
        cell: (row) => (
          <span
            className={`administration-panel-status ${row.bloqueado ? "administration-panel-warning" : row.activo ? "administration-panel-active" : ""}`}
          >
            {row.bloqueado ? "Bloqueado" : row.activo ? "Activo" : "Inactivo"}
          </span>
        ),
        textValue: (row) =>
          row.bloqueado ? "Bloqueado" : row.activo ? "Activo" : "Inactivo",
      },
      {
        id: "access",
        header: "ÚLTIMO ACCESO",
        cell: (row) => row.ultimo_acceso || "—",
        sortValue: (row) => row.ultimo_acceso,
      },
      {
        id: "actions",
        header: "ACCIONES",
        width: 112,
        filterable: false,
        cell: (row) => {
          const protectedUser = row.username === "admin";
          return (
            <TableRowActions
              actions={[
                {
                  id: "edit",
                  label: `Editar ${row.username}`,
                  icon: <Pencil size={16} />,
                  disabled:
                    !users.isSuccess ||
                    !context.isSuccess ||
                    context.isFetching ||
                    !roleList.isSuccess ||
                    !formContext ||
                    !!userEditIssue(row, formContext),
                  onClick: () => setEdit({ record: row }),
                },
                {
                  id: "state",
                  label: `${row.activo ? "Desactivar" : "Activar"} ${row.username}`,
                  icon: <Power size={16} />,
                  disabled: protectedUser || row.username === profile?.username,
                  onClick: () => {
                    mutation.reset();
                    setAction({ kind: "state", row });
                  },
                },
                {
                  id: "unlock",
                  label: `Desbloquear ${row.username}`,
                  icon: <KeyRound size={16} />,
                  disabled:
                    protectedUser || (!row.bloqueado && !row.intentos_fallidos),
                  onClick: () => {
                    mutation.reset();
                    setAction({ kind: "unlock", row });
                  },
                },
              ]}
            />
          );
        },
      },
    ],
    [
      formContext,
      context.isSuccess,
      context.isFetching,
      roleList.isSuccess,
      users.isSuccess,
      profile?.username,
      mutation,
    ],
  );
  const ready =
    users.isSuccess &&
    context.isSuccess &&
    !context.isFetching &&
    roleList.isSuccess;
  return (
    <PanelLayout>
      <FilterBar
        actions={
          <>
            <Button
              size="sm"
              icon={<RefreshCw size={15} />}
              disabled={
                users.isFetching || context.isFetching || roleList.isFetching
              }
              onClick={() => {
                void users.refetch();
                void context.refetch();
                void roleList.refetch();
              }}
            >
              Actualizar
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={16} />}
              disabled={!ready}
              onClick={() => setEdit({ record: null })}
            >
              Nuevo usuario
            </Button>
          </>
        }
        fields={[
          {
            key: "search",
            label: "Buscar usuario",
            type: "search",
            placeholder: "Usuario, nombre, correo o cargo…",
          },
          {
            key: "estado",
            label: "Estado",
            type: "select",
            options: [
              { value: "", label: "Todos" },
              ...["Activo", "Inactivo", "Bloqueado"].map((label) => ({
                value: label.toLowerCase(),
                label,
              })),
            ],
          },
          {
            key: "departamento",
            label: "Departamento",
            type: "select",
            options: [
              { value: "", label: "Todos" },
              ...[
                ...new Set(
                  records.flatMap((row) =>
                    row.departamento ? [row.departamento] : [],
                  ),
                ),
              ]
                .sort()
                .map((value) => ({ value, label: value })),
            ],
          },
        ]}
        values={filters}
        defaults={defaults}
        onChange={(patch) =>
          setFilters((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={() => setApplied(filters)}
        onReset={() => {
          setFilters(defaults);
          setApplied(defaults);
        }}
      />
      <Card fill label="Directorio de usuarios">
        {context.error && (
          <ErrorState
            error={context.error}
            onRetry={() => void context.refetch()}
          />
        )}
        {roleList.error && (
          <ErrorState
            error={roleList.error}
            onRetry={() => void roleList.refetch()}
          />
        )}
        <DataGrid
          label="Directorio de usuarios"
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          minWidth={960}
          layout="fixed"
          resetKey={JSON.stringify(applied)}
          itemLabel="usuarios"
          loading={users.isPending}
          error={users.error}
          onRetry={() => void users.refetch()}
        />
      </Card>
      {edit && formContext && (
        <UserForm
          record={edit.record}
          context={formContext}
          users={records}
          api={api}
          onClose={() => setEdit(null)}
          onSaved={(message) => {
            setEdit(null);
            saved(message);
          }}
        />
      )}
      {action && (
        <ConfirmDialog
          title={
            action.kind === "unlock"
              ? "Desbloquear usuario"
              : action.row.activo
                ? "Desactivar usuario"
                : "Activar usuario"
          }
          confirmLabel={
            action.kind === "unlock"
              ? "Desbloquear"
              : action.row.activo
                ? "Desactivar"
                : "Activar"
          }
          confirmVariant={
            action.kind === "state" && action.row.activo ? "danger" : "primary"
          }
          pending={mutation.isPending}
          error={mutation.error}
          onConfirm={() => mutation.mutate()}
          onClose={() => setAction(null)}
        >
          <p>
            {action.row.nombre_completo} · {action.row.username}
          </p>
          {action.kind === "unlock" ? (
            <p>
              Se restablecerán los intentos fallidos y el bloqueo de acceso.
            </p>
          ) : (
            !!action.row.activo && <p>Se cerrarán sus sesiones activas.</p>
          )}
        </ConfirmDialog>
      )}
    </PanelLayout>
  );
}
