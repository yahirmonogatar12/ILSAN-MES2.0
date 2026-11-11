import { useCallback, useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Warehouse } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  ExportButton,
  Card,
  DataGrid,
  FilterBar,
  Page,
  TabBar,
  tabIds,
  useToast,
  type FilterField,
} from "@/shared/ui";
import { createLedgerApi } from "./api";
import { LOT_COLUMNS, summaryColumns } from "./columns";
import { inventoryDefaults } from "./config";
import { validateDates } from "./model";
import { RemoteLedger } from "./RemoteLedger";
import { useLedgerPage } from "./useLedgerPage";
import type { InventoryFilters, InventoryView, Searches } from "./types";
import "./module.css";
export default function InventoryPage() {
  const { mode, scope } = useAuth();
  const client = useQueryClient();
  const api = useMemo(() => createLedgerApi(mode), [mode]);
  const [defaults] = useState(inventoryDefaults);
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [view, setView] = useState<InventoryView>("summary");
  const [searches, setSearches] = useState<Searches>({});
  const [error, setError] = useState("");
  const id = useId();
  const summary = useQuery({
    queryKey: ["material-ledger", scope, "summary", applied],
    queryFn: ({ signal }) => api.summary(applied, signal),
    enabled: view === "summary",
  });
  const table = useLedgerPage(
    ["lots", applied, searches],
    (page, size, signal) => api.lots(applied, searches, page, size, signal),
    view === "detail",
  );
  const query = view === "summary" ? summary : table.query;
  const toast = useToast();
  const download = useMutation({
    mutationFn: () => api.exportInventory(view, applied, searches),
    onSuccess: () => toast("Inventario descargado."),
  });
  const openLots = useCallback(
    (part: string) => {
      const next = {
        ...applied,
        numero_parte: part,
        codigo_material_recibido: "",
      };
      setDraft(next);
      setApplied(next);
      setSearches({});
      setView("detail");
      table.reset();
    },
    [applied, table.reset],
  );
  const columns = useMemo(
    () => summaryColumns(applied.use_dates === "true", openLots),
    [applied.use_dates, openLots],
  );
  const fields: FilterField<InventoryFilters>[] = [
    {
      key: "numero_parte",
      label: "Número de parte",
      type: "search",
      placeholder: "Buscar parte…",
    },
    ...(view === "detail"
      ? [
          {
            key: "codigo_material_recibido" as const,
            label: "Código recibido",
            type: "text" as const,
          },
        ]
      : []),
    {
      key: "ubicacion",
      label: "Ubicación",
      type: "text",
      placeholder: "Rack / ubicación",
    },
    {
      key: "include_zero_stock",
      label: "Existencias",
      type: "select",
      options: [
        { value: "false", label: "Con stock" },
        { value: "true", label: "Incluir sin existencias" },
      ],
    },
    ...(view === "detail"
      ? [
          {
            key: "only_na" as const,
            label: "Lotes",
            type: "select" as const,
            options: [
              { value: "false", label: "Todos" },
              { value: "true", label: "Solo lotes N/A" },
            ],
          },
        ]
      : []),
    {
      key: "use_dates",
      label: "Periodo",
      type: "select",
      options: [
        { value: "false", label: "Inventario actual" },
        { value: "true", label: "Rango de fechas" },
      ],
    },
    ...(draft.use_dates === "true"
      ? [
          {
            key: "fecha_inicio" as const,
            label: "Desde",
            type: "date" as const,
          },
          { key: "fecha_fin" as const, label: "Hasta", type: "date" as const },
        ]
      : []),
  ];
  function submit() {
    const message =
      draft.use_dates === "true"
        ? validateDates(draft.fecha_inicio, draft.fecha_fin, true)
        : "";
    setError(message);
    if (message) return;
    void client.invalidateQueries({
      queryKey: [
        "material-ledger",
        scope,
        view === "summary" ? "summary" : "lots",
      ],
      refetchType: "none",
    });
    if (
      JSON.stringify(draft) === JSON.stringify(applied) &&
      (view === "summary" || table.page === 1)
    )
      void query.refetch();
    setApplied({ ...draft });
    table.reset();
  }
  function reset() {
    const next = inventoryDefaults();
    void client.invalidateQueries({
      queryKey: ["material-ledger", scope, "summary"],
      refetchType: "none",
    });
    if (view === "summary" && JSON.stringify(applied) === JSON.stringify(next))
      void summary.refetch();
    setDraft(next);
    setApplied(next);
    setSearches({});
    setView("summary");
    table.reset();
    setError("");
  }
  return (
    <Page className="material-ledger-module" banner={<DemoBanner />}>
      <div className="material-ledger-tabs">
        <TabBar
          id={id}
          label="Vistas de inventario"
          items={[
            { id: "summary", label: "Resumen" },
            { id: "detail", label: "Detalle por lote" },
          ]}
          activeId={view}
          onChange={(next) => {
            setView(next as InventoryView);
            table.reset();
          }}
        />
      </div>
      <FilterBar
        fields={fields}
        values={draft}
        defaults={defaults}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={submit}
        onReset={reset}
        pending={query.isFetching}
      />
      <Card
        fill
        title={
          view === "summary" ? "Inventario por material" : "Inventario por lote"
        }
        icon={<Warehouse size={18} />}
        badge={
          view === "summary"
            ? (summary.data?.length ?? "—")
            : (table.query.data?.total ?? "—")
        }
        actions={
          <>
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
              icon={<Download size={15} />}
              title="Exporta la consulta con los filtros de búsqueda aplicados"
              loading={download.isPending}
              disabled={!query.data || query.isError || query.isFetching}
              onClick={() => download.mutate()}
            >
              {mode === "demo" ? "Exportar CSV" : "Exportar Excel"}
            </ExportButton>
          </>
        }
      >
        {(error || download.error) && (
          <Alert tone="warning" className="table-notice">
            {error || download.error?.message}
          </Alert>
        )}
        {view === "summary" && summary.data && summary.data.length >= 5000 && (
          <Alert tone="warning" className="table-notice">
            El resumen está limitado a 5,000 materiales. Acota la búsqueda para
            consultar otro conjunto.
          </Alert>
        )}
        {view === "detail" &&
          table.query.data &&
          table.query.data.total > 5000 && (
            <Alert tone="warning" className="table-notice">
              El Excel de detalle admite hasta 5,000 lotes por consulta. Acota
              los filtros para incluir todos los resultados en la exportación.
            </Alert>
          )}
        <div
          className="material-ledger-panel"
          role="tabpanel"
          id={tabIds(id, view).panel}
          aria-labelledby={tabIds(id, view).tab}
        >
          {view === "summary" ? (
            <DataGrid
              label="Resumen de inventario"
              rows={summary.data || []}
              columns={columns}
              rowKey={(row) => String(row.numero_parte)}
              layout="fixed"
              minWidth={applied.use_dates === "true" ? 1080 : 900}
              loading={summary.isPending}
              error={summary.error}
              onRetry={() => void summary.refetch()}
              resetKey={JSON.stringify(applied)}
              itemLabel="materiales"
            />
          ) : (
            <RemoteLedger
              label="Detalle de inventario por lote"
              columns={LOT_COLUMNS}
              result={table.query.data}
              loading={table.query.isPending}
              fetching={table.query.isFetching}
              error={table.query.error}
              onRetry={() => void table.query.refetch()}
              searches={searches}
              onSearchChange={(next) => {
                setSearches(next);
                table.reset();
              }}
              page={table.page}
              pageSize={table.pageSize}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
              minWidth={1450}
            />
          )}
        </div>
      </Card>
    </Page>
  );
}
