import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Boxes, RefreshCw } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { usePersistentState } from "@/shared/hooks/usePersistentState";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DEFAULT_PAGE_SIZE,
  EmptyState,
  ExportButton,
  FilterBar,
  Page,
  Pagination,
  type FilterField,
} from "@/shared/ui";
import { createAreaApi } from "./api";
import { AREA_CONFIG, COLUMNS } from "./config";
import { columnsFor } from "./columns";
import {
  dateIssue,
  decodeSearches,
  defaults,
  effectiveView,
  EXPORT_LIMIT,
  isInventory,
  numberText,
  params,
  REMOTE_PAGE_SIZES,
  rowKey,
} from "./model";
import type { Area, AreaFilters, ConnectedArea, Searches } from "./types";
import "./module.css";

export function AreaPage({ area }: { area: Area }) {
  if (area === "assy")
    return (
      <Page className="material-areas-module">
        <Card fill title="Control de material ASSY" icon={<Boxes size={18} />}>
          <EmptyState
            title="Consulta pendiente de habilitación"
            message="El control de material de ASSY todavía no está disponible."
          />
        </Card>
      </Page>
    );
  return <ConnectedAreaPage area={area} />;
}
function ConnectedAreaPage({ area }: { area: ConnectedArea }) {
  const auth = useAuth(),
    api = useMemo(() => createAreaApi(auth.mode), [auth.mode]);
  const [initial] = useState(defaults),
    [draft, setDraft] = useState(initial),
    [dates, setDates] = useState({ start: initial.start, end: initial.end });
  const [error, setError] = useState("");
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [saved, setSaved] = usePersistentState(
    `material-areas:${auth.scope}:${area}:columns`,
    {},
    decodeSearches,
  );
  const view = effectiveView(draft),
    inventory = isInventory(view),
    searches = useMemo(() => saved[view] ?? {}, [saved, view]);
  const filters = useMemo(() => ({ ...draft, ...dates }), [draft, dates]);
  const criteria = params(area, filters, searches).toString();
  const query = useQuery({
    queryKey: [
      "material-areas",
      auth.scope,
      area,
      view,
      criteria,
      page,
      pageSize,
    ],
    queryFn: ({ signal }) =>
      api.list(area, filters, searches, page, pageSize, signal),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === view &&
      previousQuery.queryKey[4] === criteria
        ? previous
        : undefined,
  });
  useEffect(() => {
    if (
      query.data &&
      !query.isPlaceholderData &&
      !query.isFetching &&
      query.data.page !== page
    )
      setPage(query.data.page);
  }, [query.data, query.isPlaceholderData, query.isFetching, page]);
  const download = useMutation({
    mutationFn: () => api.export(area, filters, searches),
  });
  const fields: FilterField<AreaFilters>[] = [
    {
      key: "consulta",
      label: "Consulta",
      type: "select",
      options: [
        { value: "entradas", label: "Entradas" },
        { value: "salidas", label: "Salidas" },
        ...AREA_CONFIG[area].inventories,
      ],
    },
    ...(inventory
      ? [
          {
            key: "modo",
            label: "Modo",
            type: "select",
            options: [
              { value: "general", label: "General" },
              { value: "detallado", label: "Detallado" },
            ],
          } as FilterField<AreaFilters>,
        ]
      : ([
          { key: "start", label: "Fecha desde", type: "date" },
          { key: "end", label: "Fecha hasta", type: "date" },
        ] as FilterField<AreaFilters>[])),
  ];
  const columns = useMemo(() => columnsFor(view), [view]);
  function changeSearches(next: Searches) {
    setPage(1);
    setSaved((previous) => ({
      ...previous,
      [view]: decodeSearches({ [view]: next })[view] ?? {},
    }));
  }
  function submit() {
    const issue = dateIssue(draft);
    setError(issue);
    if (issue) return;
    setPage(1);
    if (!inventory) setDates({ start: draft.start, end: draft.end });
    if (
      page === 1 &&
      (inventory || (dates.start === draft.start && dates.end === draft.end))
    )
      void query.refetch();
  }
  const title =
    AREA_CONFIG[area].inventories.find((item) => item.value === draft.consulta)
      ?.label || (draft.consulta === "entradas" ? "Entradas" : "Salidas");
  return (
    <Page className="material-areas-module" banner={<DemoBanner />}>
      <FilterBar
        fields={fields}
        values={draft}
        defaults={{ ...initial, consulta: draft.consulta, modo: draft.modo }}
        onChange={(patch) => {
          setDraft((previous) => ({ ...previous, ...patch }));
          if (patch.consulta || patch.modo) {
            setPage(1);
            setError("");
            download.reset();
          }
        }}
        onSubmit={submit}
        onReset={() => {
          const next = defaults();
          setDraft((previous) => ({
            ...previous,
            start: next.start,
            end: next.end,
          }));
          setDates({ start: next.start, end: next.end });
          changeSearches({});
          setError("");
          download.reset();
        }}
        pending={query.isFetching}
      />
      <Card
        fill
        title={`${AREA_CONFIG[area].title} · ${title}${inventory ? ` · ${draft.modo === "general" ? "General" : "Detallado"}` : ""}`}
        icon={<Boxes size={18} />}
        badge={query.data?.total ?? "—"}
        actions={
          <>
            <span className="material-areas-summary" aria-live="polite">
              {query.data
                ? `${numberText(query.data.piezas)} ${inventory ? "stock" : "piezas"}`
                : ""}
            </span>
            <Button
              size="sm"
              icon={<RefreshCw size={15} />}
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              loading={download.isPending}
              disabled={
                query.isFetching || query.isError || !query.data?.rows.length
              }
              onClick={() => download.mutate()}
              title="Exporta todas las filas que cumplen los filtros, hasta 50,000 registros."
            >
              Exportar Excel
            </ExportButton>
          </>
        }
      >
        {(error || download.error) && (
          <Alert tone="warning" className="table-notice">
            {error || download.error?.message}
          </Alert>
        )}
        {!!Object.keys(searches).length && (
          <div
            className="table-filter-summary"
            aria-label="Filtros de columna activos"
          >
            {COLUMNS[view]
              .filter(([key]) => searches[key])
              .map(([key, label]) => (
                <Button
                  key={key}
                  variant="plain"
                  className="table-filter-chip"
                  onClick={() => {
                    const next = { ...searches };
                    delete next[key];
                    changeSearches(next);
                  }}
                >
                  {label}: {searches[key]} ×
                </Button>
              ))}
            <Button
              variant="plain"
              className="text-button"
              onClick={() => changeSearches({})}
            >
              Quitar filtros de columnas
            </Button>
          </div>
        )}
        {(query.data?.total ?? 0) > EXPORT_LIMIT && (
          <Alert tone="info" className="table-notice">
            El Excel admite hasta 50,000 registros. Aplica filtros para exportar
            el conjunto que necesitas.
          </Alert>
        )}
        <DataTable
          label={`Material ${AREA_CONFIG[area].title} · ${title}${inventory ? ` ${draft.modo}` : ""}`}
          rows={query.data?.rows ?? []}
          columns={columns}
          rowKey={(row, index) =>
            rowKey(row, index, ((query.data?.page ?? page) - 1) * pageSize)
          }
          layout="fixed"
          minWidth={columns.length > 8 ? 1050 : columns.length > 6 ? 850 : 640}
          loading={query.isPending}
          fetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          columnSearches={searches}
          onColumnSearchChange={(key, value) => {
            const next = { ...searches };
            if (value) next[key] = value;
            else delete next[key];
            changeSearches(next);
          }}
        />
        {!query.isPending && !query.error && (
          <Pagination
            page={query.data?.page ?? page}
            pageSize={pageSize}
            total={query.data?.total ?? 0}
            pageSizeOptions={REMOTE_PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
            disabled={query.isFetching}
            fetching={query.isFetching}
          />
        )}
      </Card>
    </Page>
  );
}
export default function SmdPage() {
  return <AreaPage area="smd" />;
}
