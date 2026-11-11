import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, History, RefreshCw } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  ExportButton,
  Card,
  FilterBar,
  Page,
  useToast,
  type FilterField,
} from "@/shared/ui";
import { createLedgerApi } from "./api";
import { HISTORY_COLUMNS } from "./columns";
import { historyDefaults, TITLES } from "./config";
import { validateDates } from "./model";
import { RemoteLedger } from "./RemoteLedger";
import { useLedgerPage } from "./useLedgerPage";
import type { HistoryFilters, HistoryKind, Searches } from "./types";
import "./module.css";
const fields: FilterField<HistoryFilters>[] = [
  { key: "fecha_inicio", label: "Desde", type: "date" },
  { key: "fecha_fin", label: "Hasta", type: "date" },
  {
    key: "texto",
    label: "Buscar",
    type: "search",
    placeholder: "Código, parte, lote, usuario…",
  },
];
export function HistoryPage({ kind }: { kind: HistoryKind }) {
  const { mode, scope } = useAuth();
  const client = useQueryClient();
  const api = useMemo(() => createLedgerApi(mode), [mode]);
  const [defaults] = useState(historyDefaults);
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [searches, setSearches] = useState<Searches>({});
  const [error, setError] = useState("");
  const table = useLedgerPage(
    ["history", kind, applied, searches],
    (page, size, signal) =>
      api.history(kind, applied, searches, page, size, signal),
  );
  const toast = useToast();
  const download = useMutation({
    mutationFn: () => api.exportHistory(kind, applied, searches),
    onSuccess: () => toast("Historial descargado."),
  });
  function submit() {
    const message = validateDates(draft.fecha_inicio, draft.fecha_fin);
    setError(message);
    if (message) return;
    void client.invalidateQueries({
      queryKey: ["material-ledger", scope, "history", kind],
      refetchType: "none",
    });
    if (table.page === 1 && JSON.stringify(draft) === JSON.stringify(applied))
      void table.query.refetch();
    setApplied({ ...draft });
    table.reset();
  }
  function reset() {
    const next = historyDefaults();
    void client.invalidateQueries({
      queryKey: ["material-ledger", scope, "history", kind],
      refetchType: "none",
    });
    if (
      table.page === 1 &&
      JSON.stringify(applied) === JSON.stringify(next) &&
      Object.keys(searches).length === 0
    )
      void table.query.refetch();
    setDraft(next);
    setApplied(next);
    setSearches({});
    setError("");
    table.reset();
  }
  return (
    <Page className="material-ledger-module" banner={<DemoBanner />}>
      <FilterBar
        fields={fields}
        values={draft}
        defaults={defaults}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={submit}
        onReset={reset}
        pending={table.query.isFetching}
      />
      <Card
        fill
        title={TITLES[kind]}
        icon={<History size={18} />}
        badge={table.query.data?.total ?? "—"}
        actions={
          <>
            <Button
              size="sm"
              icon={<RefreshCw size={15} />}
              disabled={table.query.isFetching}
              onClick={() => void table.query.refetch()}
            >
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              icon={<Download size={15} />}
              loading={download.isPending}
              disabled={
                !table.query.data ||
                table.query.isError ||
                table.query.isFetching
              }
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
        <RemoteLedger
          label={TITLES[kind]}
          columns={HISTORY_COLUMNS[kind]}
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
          minWidth={
            kind === "entradas" ? 1600 : kind === "salidas" ? 1250 : 1180
          }
        />
      </Card>
    </Page>
  );
}
