import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/AuthProvider";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useForm } from "@/shared/hooks/useForm";
import { usePersistentState } from "@/shared/hooks/usePersistentState";
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
  useClientTable,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { exportScrap, listScrap } from "./api";
import {
  decodeSearches,
  defaultFilters,
  quantity,
  rangeIssue,
  scrapAreas,
  scrapColumns,
} from "./model";
import type { ScrapFilters, ScrapRecord } from "./types";
import "./module.css";

const fields: FilterField<ScrapFilters>[] = [
  { key: "start", label: "Fecha desde", type: "date" },
  { key: "end", label: "Fecha hasta", type: "date" },
  {
    key: "area",
    label: "Área",
    type: "select",
    options: [
      { value: "", label: "Todas" },
      ...scrapAreas.map((value) => ({ value, label: value })),
    ],
  },
];
const columns: TableColumn<ScrapRecord>[] = scrapColumns.map(
  ({ id, field, title, width }) => ({
    id,
    header: title,
    width: width + "%",
    textValue: (row) => String(row[field] ?? ""),
    sortValue: (row) => (field === "cantidad" ? quantity(row) : row[field]),
    cell: (row) => {
      const value = String(row[field] ?? "");
      return (
        <span
          className={
            field === "cantidad" && value && quantity(row) === 0
              ? "scrap-control-zero"
              : undefined
          }
          title={value || undefined}
        >
          {value || "—"}
        </span>
      );
    },
  }),
);
const empty: ScrapRecord[] = [];
const numberFormat = new Intl.NumberFormat("es-MX");
const virtualRows = { rowHeight: 32 };

export default function ScrapControlPage() {
  const { mode, scope } = useAuth();
  const [initial] = useState(defaultFilters);
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [error, setError] = useState("");
  const [searches, setSearches] = usePersistentState(
    `scrap-control:${scope}:columns`,
    {},
    decodeSearches,
  );
  const criteria = [applied, searches] as const;
  const query = useQuery({
    queryKey: ["scrap-control", scope, ...criteria],
    queryFn: ({ signal }) => listScrap(mode, applied, searches, signal),
  });
  const rows = query.data ?? empty;
  const table = useClientTable(rows, columns, {
    resetKey: JSON.stringify(criteria),
  });
  const exportForm = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () => exportScrap(mode, applied, searches),
  });
  const pieces = rows.reduce((total, row) => total + quantity(row), 0);
  return (
    <Page className="scrap-control-module" banner={<DemoBanner />}>
      <FilterBar
        fields={fields}
        values={draft}
        defaults={initial}
        pending={query.isFetching}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={() => {
          const issue = rangeIssue(draft);
          setError(issue);
          if (issue) return;
          if (
            draft.start === applied.start &&
            draft.end === applied.end &&
            draft.area === applied.area
          )
            void query.refetch();
          else setApplied(draft);
        }}
        onReset={() => {
          setDraft(initial);
          setApplied(initial);
          setSearches({});
          setError("");
        }}
      />
      <Card
        fill
        title="Registros de scrap"
        badge={`${numberFormat.format(rows.length)} registros · ${numberFormat.format(pieces)} piezas`}
        actions={
          <>
            {Object.keys(searches).length > 0 && (
              <Button size="sm" onClick={() => setSearches({})}>
                Limpiar columnas
              </Button>
            )}
            <ExportButton
              size="sm"
              title="Exporta con los mismos filtros de fecha, área y columna de la consulta."
              loading={exportForm.pending}
              disabled={query.isFetching || query.isError}
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
        <DataTable
          key={`${table.page}:${table.pageSize}`}
          className="scrap-control-grid"
          label="Registros de scrap"
          rows={table.rows}
          columns={columns}
          rowKey={(row) => row.id}
          minWidth={1060}
          layout="fixed"
          loading={query.isPending}
          fetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          emptyState={
            <EmptyState message="No se encontraron registros con los filtros seleccionados." />
          }
          sorting={table.sorting}
          onSortChange={table.setSort}
          virtualRows={virtualRows}
          columnSearches={searches}
          onColumnSearchChange={(id, value) =>
            setSearches((previous) =>
              decodeSearches({ ...previous, [id]: value }),
            )
          }
        />
        {query.isSuccess && (
          <Pagination
            page={table.page}
            pageSize={table.pageSize}
            total={table.total}
            onPageChange={table.setPage}
            onPageSizeChange={table.setPageSize}
            disabled={query.isFetching}
          />
        )}
      </Card>
    </Page>
  );
}
