import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
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
  type FilterField,
} from "@/shared/ui";
import { ResultNotice, useInvoicing } from "./components";
import { VALUATION, makeColumns } from "./columns";
import { EMPTY_ROWS, amount, text, valuationDefaults } from "./model";
import { BackfillDialog } from "./BackfillDialog";
import type { DataRow, ValuationFilters } from "./types";
import "./module.css";
const fields: FilterField<ValuationFilters>[] = [
  { key: "numero_parte", label: "Número de parte", type: "search" },
  { key: "codigo_material_recibido", label: "Código recibido", type: "search" },
  { key: "pallet_no", label: "Pallet", type: "text" },
  {
    key: "fuente_costo",
    label: "Fuente del costo",
    type: "select",
    options: [
      { value: "", label: "Todas" },
      ...["INVOICE", "CONTROL_MATERIAL", "SIN_COSTO"].map((value) => ({
        value,
        label: value,
      })),
    ],
  },
  {
    key: "include_zero_stock",
    label: "Existencias",
    type: "select",
    options: [
      { value: "", label: "Solo con stock" },
      { value: "1", label: "Incluir sin stock" },
    ],
  },
];
export default function ValuationPage() {
  const auth = useInvoicing();
  const [defaults] = useState(valuationDefaults);
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [preview, setPreview] = useState<DataRow | null>(null);
  const [result, setResult] = useState<DataRow | null>(null);
  const query = useQuery({
    queryKey: auth.key("valuation", applied, page, size),
    queryFn: ({ signal }) => auth.valuation.list(applied, page, size, signal),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: auth.key("valuation-summary", applied),
    queryFn: ({ signal }) => auth.valuation.summary(applied, signal),
  });
  const simulation = useMutation({
    mutationFn: () => auth.valuation.backfill(true),
    onSuccess: setPreview,
  });
  const download = useMutation({
    mutationFn: () => auth.valuation.export(applied),
  });
  const columns = useMemo(() => makeColumns(VALUATION, {}, false), []);
  const total = query.data?.total || 0;
  useEffect(() => {
    if (query.isSuccess && !query.isFetching)
      setPage((previous) =>
        Math.min(previous, Math.max(1, Math.ceil(total / size))),
      );
  }, [query.isSuccess, query.isFetching, total, size]);
  function refresh() {
    void query.refetch();
    void summary.refetch();
  }
  return (
    <Page className="invoicing-module" banner={<DemoBanner />}>
      <FilterBar
        actions={
          <>
            <Button size="sm" disabled={query.isFetching} onClick={refresh}>
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              loading={download.isPending}
              disabled={query.isFetching || !query.isSuccess}
              onClick={() => download.mutate()}
            >
              Exportar Excel
            </ExportButton>
            <Button
              size="sm"
              loading={simulation.isPending}
              onClick={() => simulation.mutate()}
            >
              Simular costos históricos
            </Button>
          </>
        }
        fields={fields}
        values={draft}
        defaults={defaults}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={() => {
          setPage(1);
          void auth.client.invalidateQueries({
            queryKey: auth.key("valuation"),
            refetchType: "none",
          });
          void auth.client.invalidateQueries({
            queryKey: auth.key("valuation-summary"),
            refetchType: "none",
          });
          if (page === 1 && JSON.stringify(draft) === JSON.stringify(applied))
            refresh();
          setApplied({ ...draft });
        }}
        onReset={() => {
          const next = valuationDefaults();
          setDraft(next);
          setApplied(next);
          setPage(1);
          void auth.client.invalidateQueries({
            queryKey: auth.key("valuation"),
          });
          void auth.client.invalidateQueries({
            queryKey: auth.key("valuation-summary"),
          });
        }}
        pending={query.isFetching}
      />
      <Card fill label="Valorización de inventario">
        {(simulation.error || download.error) && (
          <Alert tone="danger" className="table-notice">
            {simulation.error?.message || download.error?.message}
          </Alert>
        )}
        <ResultNotice result={result} />
        <details className="invoicing-summary">
          <summary>
            Resumen por fuente y moneda{" "}
            {summary.data ? `(${summary.data.length})` : ""}
          </summary>
          {summary.error ? (
            <Alert tone="warning">
              {summary.error.message}{" "}
              <Button size="sm" onClick={() => void summary.refetch()}>
                Reintentar
              </Button>
            </Alert>
          ) : (
            <div className="invoicing-summary-cards">
              {summary.data?.map((row, index) => (
                <div key={index}>
                  <strong>
                    {text(row.fuente_costo)} · {text(row.moneda)}
                  </strong>
                  <span>
                    {amount(row.valor_total).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <small>
                    {amount(row.lotes)} lotes · Stock {text(row.stock_total)}
                  </small>
                </div>
              ))}
            </div>
          )}
        </details>
        {total > 20000 && (
          <Alert tone="info" className="table-notice">
            El Excel del servidor incluye hasta 20,000 lotes. Aplica filtros
            para exportar un conjunto más pequeño.
          </Alert>
        )}
        <DataTable
          label="Valorización de inventario"
          rows={query.data?.records || EMPTY_ROWS}
          columns={columns}
          rowKey={(row) => text(row.codigo_material_recibido)}
          loading={query.isPending}
          fetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          layout="fixed"
          minWidth={1400}
        />
        <Pagination
          page={page}
          pageSize={size}
          total={total}
          disabled={query.isFetching}
          itemLabel="lotes"
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setSize(value);
            setPage(1);
          }}
        />
      </Card>
      {preview && (
        <BackfillDialog
          preview={preview}
          api={auth.valuation}
          onClose={() => setPreview(null)}
          onSaved={(result) => {
            setPreview(null);
            setResult(result);
            auth.saved("Bloque de costos aplicado.");
          }}
        />
      )}
    </Page>
  );
}
