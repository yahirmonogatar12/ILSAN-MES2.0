import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  DataTable,
  ExportButton,
  FilterBar,
  Page,
  Pagination,
  useClientTable,
  type FilterField,
} from "@/shared/ui";
import { makeColumns } from "./columns";
import { useProcess } from "./useProcess";
import {
  defaults,
  OPERATION_SPECS,
  OUTPUT_SPECS,
  rangeIssue,
  text,
} from "./model";
import type { Filters } from "./types";
import "./module.css";
export function ReportsPage({ kind }: { kind: "operations" | "outputs" }) {
  const context = useProcess(),
    [initial] = useState(() => {
      const result = defaults();
      if (kind === "outputs") {
        const d = new Date(`${result.start}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 7);
        result.start = d.toISOString().slice(0, 10);
      }
      return result;
    });
  const [draft, setDraft] = useState(initial),
    [applied, setApplied] = useState(initial),
    [searches, setSearches] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const query = useQuery({
    queryKey: context.key("report", kind, applied, searches),
    queryFn: ({ signal }) =>
      context.api.report(kind, applied, searches, signal),
  });
  const columns = useMemo(
    () =>
      makeColumns(kind === "operations" ? OPERATION_SPECS : OUTPUT_SPECS).map(
        (col) =>
          kind === "operations" && col.id === "proceso"
            ? { ...col, filterable: false }
            : col,
      ),
    [kind],
  );
  const data = query.data?.rows ?? [],
    table = useClientTable(data, columns, {
      resetKey: JSON.stringify([applied, searches]),
    });
  const exportForm = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () => context.api.exportReport(kind, applied, searches),
  });
  const fields: FilterField<Filters>[] = [
    { key: "start", label: "Fecha desde", type: "date" },
    { key: "end", label: "Fecha hasta", type: "date" },
    ...(kind === "operations"
      ? [
          {
            key: "proceso" as const,
            label: "Proceso",
            type: "select" as const,
            options: [
              { value: "", label: "Todos" },
              ...["SMT", "IMT", "ASSY"].map((value) => ({
                value,
                label: value,
              })),
            ],
          },
        ]
      : [
          {
            key: "part_number" as const,
            label: "Número de parte",
            type: "search" as const,
          },
        ]),
  ];
  const summaryLabels: Record<string, string> = {
    produced_quantity: "Producción",
    production_boxes: "Cajas producción",
    oqc_quantity: "Liberación OQC",
    warehouse_quantity: "Entradas almacén",
    pending_oqc: "Pendiente OQC",
    pending_warehouse: "Pendiente almacén",
  };
  return (
    <Page className="process-production-module" banner={<DemoBanner />}>
      <FilterBar
        actions={
          <>
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
              title={
                kind === "operations"
                  ? "Exporta hasta 5,000 registros con los mismos filtros de consulta y encabezados."
                  : "Exporta hasta 5,000 registros con fechas y número de parte; los filtros de columna se usan en la tabla."
              }
              onClick={() => void exportForm.submit()}
            />
          </>
        }
        fields={fields}
        values={draft}
        defaults={initial}
        pending={query.isFetching}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onReset={() => {
          setDraft(initial);
          setApplied(initial);
          setSearches({});
          setError("");
        }}
        onSubmit={() => {
          const issue = rangeIssue(draft);
          setError(issue);
          if (!issue) {
            setApplied({ ...draft });
            if (JSON.stringify(draft) === JSON.stringify(applied))
              void query.refetch();
          }
        }}
      />
      <Card
        fill
        label={
          kind === "operations"
            ? "Historial de operación por proceso"
            : "Producción / OQC / Almacén"
        }
      >
        {(error || exportForm.error) && (
          <Alert tone="danger" className="table-notice">
            {error || exportForm.error?.message}
          </Alert>
        )}
        {kind === "outputs" && query.data && (
          <div className="process-production-summary">
            {Object.entries(summaryLabels).map(([key, label]) => (
              <span key={key}>
                {label}: <strong>{text(query.data.summary[key] ?? 0)}</strong>
              </span>
            ))}
          </div>
        )}
        {kind === "operations" ? (
          <>
            <DataTable
              label="Operación por proceso"
              rows={table.rows}
              columns={columns}
              rowKey={(row, index) =>
                `${text(row.proceso)}:${text(row.lote)}:${index}`
              }
              loading={query.isPending}
              error={query.error}
              onRetry={() => void query.refetch()}
              fetching={query.isFetching}
              sorting={table.sorting}
              onSortChange={table.setSort}
              columnSearches={searches}
              onColumnSearchChange={(id, value) =>
                setSearches((previous) => {
                  const next = { ...previous };
                  if (value) next[id] = value;
                  else delete next[id];
                  return next;
                })
              }
              layout="fixed"
              minWidth={1150}
            />
            {!query.isPending && !query.error && (
              <Pagination
                page={table.page}
                pageSize={table.pageSize}
                total={table.total}
                onPageChange={table.setPage}
                onPageSizeChange={table.setPageSize}
                disabled={query.isFetching}
              />
            )}
          </>
        ) : (
          <DataGrid
            label="Salida de líneas"
            rows={data}
            columns={columns}
            rowKey={(row, index) => `${text(row.part_number)}:${index}`}
            loading={query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
            layout="fixed"
            minWidth={1400}
            resetKey={JSON.stringify(applied)}
          />
        )}
      </Card>
    </Page>
  );
}
