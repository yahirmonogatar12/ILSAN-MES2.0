import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Eye,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { usePermission } from "@/core/auth/usePermission";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  ExportButton,
  Card,
  DataTable,
  DEFAULT_PAGE_SIZE,
  FilterBar,
  Page,
  Pagination,
  TableRowActions,
  useToast,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { createFpaApi } from "./api";
import { DEFAULT_FILTERS, FPA_ADJUST, FPA_CREATE, STATUSES } from "./config";
import { FpaDetailDialog, NewRequest } from "./FpaForms";
import type { Filters, FpaRequest, LabelType } from "./types";
import "./module.css";
const fields: FilterField<Filters>[] = [
  { key: "dateFrom", label: "Fecha desde", type: "date" },
  { key: "dateTo", label: "Fecha hasta", type: "date" },
  { key: "folio", label: "Folio", type: "text" },
  { key: "fpaPartNumber", label: "Número de parte FPA", type: "text" },
  { key: "requester", label: "Solicitante", type: "text" },
  {
    key: "status",
    label: "Estado",
    type: "select",
    options: [
      { value: "", label: "Todos" },
      ...STATUSES.map((value) => ({ value, label: value })),
    ],
  },
];
function counts(record: FpaRequest, type: LabelType) {
  const item = record.items.find((value) => value.labelType === type);
  return item ? (
    <div>
      {item.code}
      <small className="fpa-counts">
        {item.confirmed} / {item.consumed} / {item.requested} · saldo{" "}
        {item.remaining}
      </small>
    </div>
  ) : (
    "—"
  );
}
export default function FpaPage() {
  const { mode, scope } = useAuth();
  const api = useMemo(() => createFpaApi(mode), [mode]);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [applied, setApplied] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [dialog, setDialog] = useState<
    { type: "create" } | { type: "detail" | "adjust"; id: number } | null
  >(null);
  const list = useQuery({
    queryKey: ["fpa", scope, "list", applied, page, pageSize],
    queryFn: ({ signal }) => api.list(applied, page, pageSize, signal),
  });
  const create = usePermission(FPA_CREATE);
  const adjust = usePermission(FPA_ADJUST);
  const client = useQueryClient();
  const toast = useToast();
  useEffect(() => {
    if (list.data && !list.isFetching) {
      const last = Math.max(1, Math.ceil(list.data.meta.total / pageSize));
      if (page > last) setPage(last);
    }
  }, [list.data, list.isFetching, page, pageSize]);
  const [filterError, setFilterError] = useState("");
  const exportFile = useMutation({
    mutationFn: () => api.export(applied),
    onSuccess: () => toast("Archivo FPA descargado."),
  });
  function saved(message: string) {
    setDialog(null);
    toast(message);
    void client.invalidateQueries({ queryKey: ["fpa", scope] });
  }
  const columns = useMemo<TableColumn<FpaRequest>[]>(
    () => [
      { id: "folio", header: "FOLIO", cell: (row) => row.folio },
      { id: "date", header: "FECHA / HORA", cell: (row) => row.createdAt },
      { id: "requester", header: "SOLICITANTE", cell: (row) => row.requester },
      {
        id: "part",
        header: "NÚMERO DE PARTE FPA",
        cell: (row) => row.fpaPartNumber,
      },
      {
        id: "main",
        header: "PGM MAIN · CONF. / CONS. / SOLIC.",
        cell: (row) => counts(row, "MICOM"),
      },
      {
        id: "comp",
        header: "PGM COMP · CONF. / CONS. / SOLIC.",
        cell: (row) => counts(row, "COMP"),
      },
      { id: "status", header: "ESTADO", cell: (row) => row.status },
      {
        id: "actions",
        header: "ACCIONES",
        filterable: false,
        cell: (row) => (
          <TableRowActions
            actions={[
              {
                id: "detail",
                label: `Detalle ${row.folio}`,
                icon: <Eye size={16} />,
                onClick: () => setDialog({ type: "detail", id: row.id }),
              },
              ...(adjust.data === true && !adjust.isError
                ? [
                    {
                      id: "adjust",
                      label: `Ajustar ${row.folio}`,
                      icon: <SlidersHorizontal size={16} />,
                      onClick: () => setDialog({ type: "adjust", id: row.id }),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [adjust.data, adjust.isError],
  );
  return (
    <Page className="fpa-module" banner={<DemoBanner />}>
      <FilterBar
        fields={fields}
        values={filters}
        defaults={DEFAULT_FILTERS}
        onChange={(patch) =>
          setFilters((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={() => {
          if (
            filters.dateFrom &&
            filters.dateTo &&
            filters.dateFrom > filters.dateTo
          ) {
            setFilterError(
              "La fecha inicial no puede ser posterior a la final.",
            );
            return;
          }
          setFilterError("");
          void client.invalidateQueries({
            queryKey: ["fpa", scope, "list"],
            refetchType: "none",
          });
          if (page === 1 && JSON.stringify(filters) === JSON.stringify(applied))
            void list.refetch();
          setApplied({ ...filters });
          setPage(1);
        }}
        onReset={() => {
          void client.invalidateQueries({
            queryKey: ["fpa", scope, "list"],
            refetchType: "none",
          });
          if (
            page === 1 &&
            JSON.stringify(applied) === JSON.stringify(DEFAULT_FILTERS)
          )
            void list.refetch();
          setFilters({ ...DEFAULT_FILTERS });
          setApplied({ ...DEFAULT_FILTERS });
          setPage(1);
          setFilterError("");
        }}
        pending={list.isFetching}
      />
      <Card
        fill
        title="Solicitudes de FPA"
        icon={<Tags size={18} />}
        badge={list.data?.meta.total ?? "—"}
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
            <ExportButton
              size="sm"
              icon={<Download size={15} />}
              loading={exportFile.isPending}
              disabled={list.isPending || list.isError}
              onClick={() => exportFile.mutate()}
            >
              {mode === "demo" ? "Exportar CSV" : "Exportar Excel"}
            </ExportButton>
            {create.data === true && !create.isError && (
              <Button
                size="sm"
                variant="success"
                icon={<Plus size={15} />}
                onClick={() => setDialog({ type: "create" })}
              >
                Nueva solicitud
              </Button>
            )}
          </>
        }
      >
        {(filterError || exportFile.error || create.error || adjust.error) && (
          <Alert tone="warning" className="table-notice">
            {filterError ||
              exportFile.error?.message ||
              create.error?.message ||
              adjust.error?.message}
          </Alert>
        )}
        <DataTable
          label="Solicitudes FPA"
          rows={list.data?.data || []}
          columns={columns}
          rowKey={(row) => row.id}
          loading={list.isPending}
          error={list.error}
          onRetry={() => void list.refetch()}
          minWidth={1400}
        />
        {list.data && !list.isError && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={list.data.meta.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            itemLabel="solicitudes"
            fetching={list.isFetching}
          />
        )}
      </Card>
      {dialog?.type === "create" && create.data === true && !create.isError && (
        <NewRequest api={api} onClose={() => setDialog(null)} onSaved={saved} />
      )}
      {dialog && dialog.type !== "create" && (
        <FpaDetailDialog
          key={dialog.id}
          id={dialog.id}
          api={api}
          scope={scope}
          canAdjust={adjust.data === true && !adjust.isError}
          focusAdjust={dialog.type === "adjust"}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </Page>
  );
}
