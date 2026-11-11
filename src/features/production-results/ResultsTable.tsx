import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  DataTable,
  ExportButton,
  FilterBar,
  Pagination,
  DEFAULT_PAGE_SIZE,
  type TableColumn,
} from "@/shared/ui";
import { filterIssue, number, text } from "./model";
import { useResults } from "./useResults";
import type { Filters, Row, ViewSpec, ColumnSpec } from "./types";

export function columnsFor(specs: readonly ColumnSpec[]): TableColumn<Row>[] {
  const totalWidth = specs.reduce((sum, column) => sum + column.width, 0);
  return specs.map((column) => ({
    id: column.key,
    header: column.title,
    width: (100 * column.width) / totalWidth + "%",
    textValue: (row) => text(row[column.key]),
    searchValue: column.searchValue,
    searchLabel: column.searchLabel,
    sortValue: (row) =>
      column.numeric ? number(row[column.key]) : text(row[column.key]),
    filterable: column.key !== "numero" && column.filterable !== false,
    cell: (row) => {
      const raw = row[column.key];
      const value =
        raw == null || raw === ""
          ? "—"
          : column.numeric
            ? number(raw).toLocaleString("es-MX")
            : text(raw);
      return (
        <span className="production-results-cell" title={value}>
          {value}
        </span>
      );
    },
  }));
}
const summaryLabels: Record<string, string> = {
  total_intentos: "Intentos",
  piezas_unicas: "Piezas únicas",
  piezas_repetidas: "Repetidas",
  piezas_reparacion: "Reparación",
  ok_total: "OK",
  ng_total: "NG",
  total_real: "Total real",
  ok_real: "OK real",
  defectos_detectados: "Detectados",
  falsos_negativos: "Falsos negativos",
  falsos_fail: "Falsos fail",
  pruebas: "Pruebas",
  posiciones: "Posiciones",
  ng: "NG",
};
/** The API determines whether filtering is remote or over the complete returned list. */
export function ResultsTable({
  spec,
  active = true,
  extra = {},
  actions,
  notice,
  extraColumns = [],
  leadingColumns = [],
  columns: displayColumns,
  rowHeight = 32,
}: {
  spec: ViewSpec;
  active?: boolean;
  extra?: Filters;
  actions?: ReactNode;
  notice?: ReactNode;
  extraColumns?: readonly TableColumn<Row>[];
  leadingColumns?: readonly TableColumn<Row>[];
  /** Custom presentation preserves the spec used for requests and exports. */
  columns?: readonly TableColumn<Row>[];
  /** Used by both CSS and the virtual window to keep scrolling aligned. */
  rowHeight?: number;
}) {
  const context = useResults();
  const [draft, setDraft] = useState<Filters>(() => ({ ...spec.defaults }));
  const [applied, setApplied] = useState<Filters>(() => ({ ...spec.defaults }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searches, setSearches] = useState<Filters>({});
  const [error, setError] = useState("");
  const [queried, setQueried] = useState(!spec.manual);
  const [progressId, setProgressId] = useState(() => crypto.randomUUID());
  const filters = { ...applied, ...extra };
  const criteria = JSON.stringify([
    spec.path,
    spec.params,
    filters,
    searches,
    spec.progressPath ? progressId : null,
  ]);
  const query = useQuery({
    queryKey: context.key("report", spec.id, criteria, page, pageSize),
    queryFn: ({ signal }) =>
      context.api.report(
        spec,
        filters,
        searches,
        page,
        pageSize,
        signal,
        progressId,
      ),
    enabled: active && queried,
  });
  const progress = useQuery({
    queryKey: context.key("progress", spec.id, progressId),
    queryFn: ({ signal }) =>
      context.api.progress(spec.progressPath!, progressId, signal),
    enabled: active && query.isFetching && !!spec.progressPath,
    refetchInterval: 750,
  });
  useEffect(() => {
    if (!spec.remote || !query.data) return;
    const last = Math.max(1, Math.ceil(query.data.total / query.data.perPage));
    const next = Math.min(query.data.page, last);
    if (next !== page) setPage(next);
  }, [query.data, page, spec.remote]);
  const columns = useMemo(
    () => [
      ...leadingColumns,
      ...(displayColumns ?? columnsFor(spec.columns)),
      ...extraColumns,
    ],
    [spec.columns, displayColumns, extraColumns, leadingColumns],
  );
  const exportForm = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () =>
      context.api.exportReport(
        spec,
        filters,
        searches,
        query.data?.page ?? page,
        query.data?.perPage ?? pageSize,
        query.data?.rows ?? [],
      ),
  });
  const tableProps = {
    label: spec.title,
    rows: queried ? (query.data?.rows ?? []) : [],
    columns,
    rowKey: (row: Row, index: number) =>
      text(row.id ?? row.numero ?? row.part_number ?? row.nparte) + ":" + index,
    minWidth: spec.minWidth,
    layout: "fixed" as const,
    loading: queried && query.isPending,
    fetching: query.isFetching,
    error: query.error,
    onRetry: () => void query.refetch(),
    virtualRows: { rowHeight },
    className: "production-results-table",
  };
  const limit =
    spec.id.startsWith("excess-") &&
    spec.id !== "excess-inventory" &&
    Object.values(applied).some(Boolean)
      ? 5000
      : spec.limit;
  return (
    <div
      className="production-results-view"
      style={
        { "--production-results-row-height": rowHeight + "px" } as CSSProperties
      }
    >
      {spec.fields.length > 0 && (
        <FilterBar
          fields={spec.fields}
          values={draft}
          defaults={spec.defaults}
          pending={query.isFetching}
          onChange={(patch) =>
            setDraft((previous) => ({ ...previous, ...patch }) as Filters)
          }
          onReset={() => {
            setDraft({ ...spec.defaults });
            setApplied({ ...spec.defaults });
            setSearches({});
            setPage(1);
            setError("");
            if (spec.manual) setQueried(false);
          }}
          onSubmit={() => {
            const issue = filterIssue(draft) || spec.validate?.(draft) || "";
            setError(issue);
            if (issue) return;
            if (
              queried &&
              !spec.progressPath &&
              JSON.stringify(applied) === JSON.stringify(draft) &&
              page === 1
            )
              void query.refetch();
            setProgressId(crypto.randomUUID());
            setQueried(true);
            setApplied({ ...draft });
            setPage(1);
          }}
        />
      )}
      <Card
        fill
        title={spec.title}
        badge={queried ? query.data?.total : undefined}
        actions={
          <>
            {Object.values(searches).some(Boolean) && (
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
              disabled={query.isFetching || !queried}
              onClick={() => void query.refetch()}
            >
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              loading={exportForm.pending}
              disabled={!queried || !query.isSuccess}
              title={
                spec.remote && spec.exportPage !== false
                  ? "Exporta la página consultada con los filtros aplicados."
                  : spec.exportLimit
                    ? "Exporta la consulta hasta " +
                      spec.exportLimit.toLocaleString("es-MX") +
                      " registros."
                    : "Exporta la consulta cargada."
              }
              onClick={() => void exportForm.submit()}
            />
            {actions}
          </>
        }
      >
        {(error || exportForm.error) && (
          <Alert tone="danger" className="table-notice">
            {error || exportForm.error?.message}
          </Alert>
        )}
        {notice}
        {queried && query.data?.summary && (
          <div
            className="production-results-stats"
            aria-label="Resumen de la consulta"
          >
            {Object.entries(query.data.summary)
              .filter(([key]) => summaryLabels[key])
              .map(([key, value]) => (
                <span key={key}>
                  {summaryLabels[key]}{" "}
                  <strong>{number(value).toLocaleString("es-MX")}</strong>
                </span>
              ))}
          </div>
        )}
        {!queried && (
          <Alert tone="info" className="table-notice">
            Selecciona los filtros y pulsa Consultar.
          </Alert>
        )}
        {query.isFetching && spec.progressPath && (
          <div role="status" className="production-results-stats">
            Leyendo archivos {number(progress.data?.done)} /{" "}
            {number(progress.data?.total)} · {text(progress.data?.phase)}
          </div>
        )}
        {queried && query.data?.warnings?.length ? (
          <Alert tone="warning" className="table-notice">
            {query.data.warnings.join(" ")}
          </Alert>
        ) : null}
        {queried && query.data?.meta && (
          <div className="production-results-stats">
            Archivos leídos{" "}
            <strong>{number(query.data.meta.archivos_leidos)}</strong> Cambios{" "}
            <strong>{number(query.data.meta.eventos)}</strong>
          </div>
        )}
        {query.isSuccess && limit && query.data.rows.length >= limit && (
          <Alert tone="info" className="table-notice">
            La API devuelve hasta {limit.toLocaleString("es-MX")} registros por
            consulta. Aplica filtros para acotar los resultados.
          </Alert>
        )}
        {spec.remote ? (
          <>
            <DataTable
              {...tableProps}
              key={criteria + page + ":" + pageSize}
              columnSearches={searches}
              onColumnSearchChange={(key, value) => {
                setSearches((previous) => ({ ...previous, [key]: value }));
                setPage(1);
              }}
            />
            {query.data && (
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
          </>
        ) : (
          <DataGrid
            {...tableProps}
            resetKey={criteria}
            summary={(loaded) =>
              spec.id === "excess-inventory" ||
              spec.id.startsWith("excess-") ? (
                <div className="production-results-stats">
                  Cantidad total{" "}
                  <strong>
                    {loaded
                      .reduce(
                        (sum, row) =>
                          sum + number(row.current_quantity ?? row.quantity),
                        0,
                      )
                      .toLocaleString("es-MX")}
                  </strong>
                </div>
              ) : null
            }
          />
        )}
      </Card>
    </div>
  );
}
