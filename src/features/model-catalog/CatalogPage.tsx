import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, Layers, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { normalizeSearch } from "@/shared/lib/text";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataGrid,
  Page,
  TableRowActions,
  TextField,
  useToast,
  type TableColumn,
} from "@/shared/ui";
import { createCatalogApi } from "./api";
import { CatalogForm, FamilyLines } from "./CatalogForm";
import { LIMIT, rowKey, visibleColumn } from "./model";
import type { CatalogKind, ModelRow } from "./types";
import "./module.css";

export function CatalogPage({ kind }: { kind: CatalogKind }) {
  const { mode, scope, profile } = useAuth();
  const api = useMemo(() => createCatalogApi(kind, mode), [kind, mode]);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const query = kind === "models" ? debounced.value : "";
  const list = useQuery({
    queryKey: ["model-catalog", scope, kind, query],
    queryFn: ({ signal }) => api.list(query, signal),
  });
  const client = useQueryClient();
  const toast = useToast();
  const [dialog, setDialog] = useState<
    | { type: "edit" | "delete"; record: ModelRow }
    | { type: "create" | "family" }
    | null
  >(null);
  const rows = useMemo(() => {
    const records = list.data?.rows || [];
    const needle = normalizeSearch(search.trim());
    return kind === "smt" && needle
      ? records.filter((row) =>
          normalizeSearch(Object.values(row).join(" ")).includes(needle),
        )
      : records;
  }, [list.data, search, kind]);
  const ready = list.isSuccess && !list.isError && !!list.data.columns.length;
  function saved() {
    setDialog(null);
    toast("Catálogo actualizado correctamente.");
    void client.invalidateQueries({ queryKey: ["model-catalog", scope] });
  }
  const remove = useMutation({
    mutationFn: (record: ModelRow) => api.remove(record),
    onSuccess: saved,
  });
  const columns = useMemo<TableColumn<ModelRow>[]>(
    () => [
      ...(list.data?.columns || []).filter(visibleColumn).map((column) => ({
        id: column,
        header: column.toUpperCase(),
        cell: (row: ModelRow) => String(row[column] ?? "—"),
        sortValue: (row: ModelRow) =>
          typeof row[column] === "boolean" ? Number(row[column]) : row[column],
      })),
      {
        id: "actions",
        header: "ACCIONES",
        filterable: false,
        cell: (record) => (
          <TableRowActions
            actions={[
              {
                id: "edit",
                label: `Editar ${String(record.part_no ?? record.model ?? rowKey(record))}`,
                icon: <Pencil size={15} />,
                disabled: !ready,
                onClick: () => setDialog({ type: "edit", record }),
              },
              {
                id: "delete",
                label: `Eliminar ${String(record.part_no ?? record.model ?? rowKey(record))}`,
                icon: <Trash2 size={15} />,
                tone: "danger",
                disabled:
                  !ready || (kind === "models" && !record.id && !record.ID),
                onClick: () => {
                  remove.reset();
                  setDialog({ type: "delete", record });
                },
              },
            ]}
          />
        ),
      },
    ],
    [list.data?.columns, ready, kind],
  );
  return (
    <Page className="model-catalog-module" banner={<DemoBanner />}>
      <Card
        fill
        title={
          kind === "smt" ? "Configuraciones SMT por línea" : "Modelos base RAW"
        }
        icon={kind === "smt" ? <Cpu size={18} /> : <Layers size={18} />}
        badge={list.data?.rows.length ?? "—"}
        actions={
          <>
            <TextField
              type="search"
              aria-label="Buscar modelos"
              placeholder="Parte, modelo o proyecto…"
              containerClassName="model-catalog-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button
              size="sm"
              icon={<RefreshCw size={15} />}
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              Actualizar
            </Button>
            {kind === "models" && (
              <Button
                size="sm"
                disabled={!ready}
                onClick={() => setDialog({ type: "family" })}
              >
                Líneas por familia
              </Button>
            )}
            <Button
              size="sm"
              variant="success"
              icon={<Plus size={15} />}
              disabled={!ready}
              onClick={() => setDialog({ type: "create" })}
            >
              Registrar
            </Button>
          </>
        }
      >
        {list.data &&
          ((list.data.total > rows.length && kind === "models") ||
            list.data.rows.length >= LIMIT) && (
            <Alert className="table-notice" tone="warning">
              La consulta carga hasta {LIMIT.toLocaleString("es-MX")} modelos.{" "}
              {kind === "models"
                ? `Hay ${list.data.total.toLocaleString("es-MX")} coincidencias; usa el buscador para acotar. Los filtros de columna operan sobre las filas cargadas.`
                : "El servidor limita el catálogo a ese conjunto."}
            </Alert>
          )}
        <DataGrid
          label={kind === "smt" ? "Modelos SMT" : "Modelos base"}
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          itemLabel="modelos"
          minWidth={Math.max(
            800,
            (list.data?.columns.filter(visibleColumn).length || 6) * 125,
          )}
          resetKey={query || search}
          loading={list.isPending}
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      </Card>
      {(dialog?.type === "create" || dialog?.type === "edit") && list.data && (
        <CatalogForm
          kind={kind}
          record={dialog.type === "edit" ? dialog.record : null}
          columns={list.data.columns}
          api={api}
          actor={profile?.nombre_completo || profile?.username || ""}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.type === "family" && (
        <FamilyLines
          api={api}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.type === "delete" && (
        <ConfirmDialog
          title="Eliminar modelo"
          confirmLabel="Eliminar"
          pending={remove.isPending}
          error={remove.error}
          onConfirm={() => remove.mutate(dialog.record)}
          onClose={() => setDialog(null)}
        >
          <p>
            Se eliminará{" "}
            {String(
              dialog.record.part_no ??
                dialog.record.model ??
                "el registro seleccionado",
            )}{" "}
            del catálogo.
          </p>
        </ConfirmDialog>
      )}
    </Page>
  );
}
