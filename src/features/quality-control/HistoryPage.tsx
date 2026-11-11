import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { usePersistentState } from "@/shared/hooks/usePersistentState";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ExportButton,
  FilterBar,
  Page,
  Pagination,
  DEFAULT_PAGE_SIZE,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import {
  decodeSearches,
  defaultFilters,
  filterIssue,
  histories,
  number,
  text,
} from "./model";
import { useQuality } from "./useQuality";
import type { HistoryFilters, HistoryKind, Row } from "./types";
import "./module.css";

const windowed = { rowHeight: 32 };
export function HistoryView({
  kind,
  active = true,
}: {
  kind: HistoryKind;
  active?: boolean;
}) {
  const context = useQuality();
  const config = histories[kind];
  const [initial] = useState(() => defaultFilters(kind));
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [error, setError] = useState("");
  const [searches, setSearches] = usePersistentState(
    `quality-control:${context.scope}:${kind}:columns`,
    {},
    (value) => decodeSearches(kind, value),
  );
  const criteria = JSON.stringify([applied, searches]);
  const query = useQuery({
    queryKey: context.key("history", kind, criteria, page, pageSize),
    queryFn: ({ signal }) =>
      context.api.history(kind, applied, searches, page, pageSize, signal),
    enabled: active,
  });
  const options = useQuery({
    queryKey: context.key("options", kind),
    queryFn: ({ signal }) => context.api.options(kind, signal),
    enabled: active,
    staleTime: 300_000,
  });
  useEffect(() => {
    if (!query.data) return;
    const last = Math.max(1, Math.ceil(query.data.total / pageSize));
    if (page > last) setPage(last);
  }, [query.data, pageSize, page]);
  const fields: FilterField<HistoryFilters>[] = config.filters.map((field) => ({
    key: field.key,
    label: field.title,
    type: field.type ?? "text",
    min: field.min,
    step: field.step,
    options: [
      { value: "", label: "Todos" },
      ...(field.options ?? options.data?.[field.optionsKey ?? ""] ?? []).map(
        (value) => ({ value, label: value }),
      ),
    ],
  }));
  const columns = useMemo<TableColumn<Row>[]>(() => {
    const total = config.columns.reduce((sum, col) => sum + col.width, 0);
    return config.columns.map((column) => ({
      id: column.key,
      header: column.title,
      width: (100 * column.width) / total + "%",
      textValue: (row) => text(row[column.key]),
      ...(kind === "interlock" && column.key === "duracion"
        ? {
            searchValue: (row: Row) => String(number(row.duracion_ms) / 1000),
            searchLabel: "Mínimo en segundos",
          }
        : {}),
      cell: (row) => {
        const value = text(row[column.key]);
        return (
          <span className="quality-control-cell" title={value || undefined}>
            {value || "—"}
          </span>
        );
      },
    }));
  }, [config, kind]);
  const exportForm = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () => context.api.exportHistory(kind, applied, searches),
  });
  return (
    <div className="quality-control-history">
      <FilterBar
        fields={fields}
        values={draft}
        defaults={initial}
        pending={query.isFetching}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }) as HistoryFilters)
        }
        onReset={() => {
          setDraft(initial);
          setApplied(initial);
          setSearches({});
          setPage(1);
          setError("");
        }}
        onSubmit={() => {
          const issue = filterIssue(draft);
          setError(issue);
          if (issue) return;
          if (JSON.stringify(applied) === JSON.stringify(draft) && page === 1)
            void query.refetch();
          setPage(1);
          setApplied({ ...draft });
        }}
      />
      <Card
        fill
        title={config.title}
        badge={query.data?.total}
        actions={
          <>
            {query.data?.stopped !== undefined && (
              <span
                className="quality-control-stopped"
                title="Tiempo detenido de todos los registros filtrados"
              >
                {query.data.stopped} detenidos
              </span>
            )}
            {Object.keys(searches).length > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setSearches({});
                  setPage(1);
                }}
              >
                Limpiar columnas
              </Button>
            )}
            <Button
              size="sm"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              loading={exportForm.pending}
              disabled={query.isPending || query.isError}
              title="Exporta hasta 10,000 registros con los filtros de consulta y encabezados."
              onClick={() => void exportForm.submit()}
            />
          </>
        }
      >
        {(error || exportForm.error) && (
          <Alert tone="danger" className="table-notice">
            {error || exportForm.error?.message}
          </Alert>
        )}
        {options.error && (
          <Alert tone="warning" className="table-notice">
            {options.error.message}{" "}
            <Button size="sm" onClick={() => void options.refetch()}>
              Reintentar opciones
            </Button>
          </Alert>
        )}
        <DataTable
          key={page + ":" + pageSize}
          className="quality-control-history-table"
          label={config.title}
          rows={query.data?.rows ?? []}
          columns={columns}
          rowKey={(row, index) =>
            text(row.id ?? row.ciclo ?? row.codigo ?? row.barcode) + ":" + index
          }
          minWidth={config.minWidth}
          layout="fixed"
          loading={query.isPending}
          fetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          emptyState={
            <EmptyState message="No se encontraron registros con los filtros seleccionados." />
          }
          virtualRows={windowed}
          columnSearches={searches}
          filterOptions={Object.fromEntries(
            config.filters
              .filter((field) => field.type === "select")
              .map((field) => [
                field.key,
                field.options ?? options.data?.[field.optionsKey ?? ""] ?? [],
              ]),
          )}
          onColumnSearchChange={(key, value) => {
            setSearches((previous) =>
              decodeSearches(kind, { ...previous, [key]: value }),
            );
            setPage(1);
          }}
          rowProps={(row) => ({
            className:
              row._destacar === true ||
              (kind === "smt" && text(row.resultado).toUpperCase() === "NG")
                ? "quality-control-rejected"
                : undefined,
          })}
        />
        {query.isSuccess && (
          <Pagination
            page={query.data.page}
            pageSize={query.data.perPage}
            total={query.data.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
            disabled={query.isFetching}
          />
        )}
      </Card>
    </div>
  );
}
export function HistoryPage({ kind }: { kind: HistoryKind }) {
  return (
    <Page className="quality-control-page" banner={<DemoBanner />}>
      <HistoryView kind={kind} />
    </Page>
  );
}
