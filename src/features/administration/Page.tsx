import { useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Users } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  ErrorState,
  IconButton,
  Page,
  TextField,
  type TableColumn,
} from "@/shared/ui";
import { useUsers } from "./useAdministration";
import { canManage, normalizeSearch, userEditIssue } from "./model";
import { UserForm } from "./UserForm";
import type { UserRecord } from "./types";
import "./module.css";

export default function UsersPage() {
  const { api, context, list, afterSaved } = useUsers();
  const [dialog, setDialog] = useState<{ record: UserRecord | null } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  // Keep the same dataset when only a dialog changes; DataGrid can reuse its
  // column options and sorted rows instead of processing the entire list again.
  const rows = useMemo(() => {
    const records = list.data || [];
    const needle = normalizeSearch(search.trim());
    return needle
      ? records.filter((row) =>
          normalizeSearch(`${row.username} ${row.nombre_completo}`).includes(
            needle,
          ),
        )
      : records;
  }, [list.data, search]);
  const ready =
    !!context.data && !context.isError && !list.isError && list.isSuccess;
  const allowed =
    !!context.data &&
    canManage(context.data.es_superadmin, context.data.departamento_propio);
  const columns = useMemo<TableColumn<UserRecord>[]>(
    () => [
      {
        id: "username",
        header: "USUARIO",
        cell: (row) => row.username,
        sortValue: (row) => row.username,
      },
      {
        id: "name",
        header: "NOMBRE COMPLETO",
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
        cell: (row) => row.roles.join(", ") || "—",
        sortValue: (row) => row.roles.join(", "),
      },
      {
        id: "state",
        header: "ESTADO",
        cell: (row) => (
          <span
            className={`administration-status ${row.activo ? "administration-active" : ""}`}
          >
            {row.activo ? "Activo" : "Inactivo"}
          </span>
        ),
        textValue: (row) => (row.activo ? "Activo" : "Inactivo"),
        sortValue: (row) => row.activo,
      },
      {
        id: "actions",
        header: "ACCIONES",
        filterable: false,
        cell: (row) => {
          const issue = context.data
            ? userEditIssue(row, context.data)
            : "Cargando alcance…";
          return (
            <IconButton
              label={`Editar ${row.username}`}
              title={issue || "Editar usuario"}
              icon={<Pencil size={15} />}
              disabled={!ready || !allowed || !!issue}
              onClick={() => setDialog({ record: row })}
            />
          );
        },
      },
    ],
    [context.data, ready, allowed],
  );
  return (
    <Page className="administration-module" banner={<DemoBanner />}>
      <Card
        fill
        title="Usuarios registrados"
        icon={<Users size={18} />}
        badge={list.isSuccess ? list.data.length : "—"}
        actions={
          <>
            <TextField
              type="search"
              aria-label="Buscar usuarios"
              placeholder="Buscar usuario o nombre…"
              containerClassName="administration-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="administration-scope">
              {context.data?.es_superadmin
                ? "Todos los departamentos"
                : context.data?.departamento_propio}
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
              onClick={() => setDialog({ record: null })}
            >
              Nuevo usuario
            </Button>
          </>
        }
      >
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
                asignación para administrar usuarios.
              </Alert>
            )}
            <DataGrid
              label="Usuarios registrados"
              rows={rows}
              columns={columns}
              rowKey={(row) => row.id}
              itemLabel="usuarios"
              resetKey={search}
              minWidth={850}
              initialSort={{ columnId: "username", direction: "asc" }}
              loading={context.isPending || list.isPending}
              error={list.error}
              onRetry={() => void list.refetch()}
            />
          </>
        )}
      </Card>
      {dialog && context.data && (
        <UserForm
          record={dialog.record}
          context={context.data}
          users={list.data || []}
          api={api}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null);
            afterSaved(message);
          }}
        />
      )}
    </Page>
  );
}
