import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  ActionGroup,
  Alert,
  Button,
  Card,
  DataTable,
  ExportButton,
  FilterBar,
  Page,
  Pagination,
  SelectField,
  TextField,
} from "@/shared/ui";
import { ResultNotice } from "./components";
import { text, TURNOS } from "./model";
import { pivotFields } from "./pivot";
import { usePivotColumns } from "./pivotColumns";
import { usePivot } from "./usePivot";
import { PivotDialogs } from "./PivotDialogs";
import "./module.css";

export function PivotPage({ projection = false }: { projection?: boolean }) {
  const pivot = usePivot(projection);
  const {
    initial,
    draft,
    setDraft,
    key,
    page,
    size,
    setPage,
    setSize,
    error,
    setError,
    result,
    setResult,
    query,
    dates,
    records,
    writable,
    lineSuggestions,
    exported,
    submit,
    reset,
    cells,
    setDialog,
  } = pivot;
  const { capture, setCapture } = cells;
  const columns = usePivotColumns({
    dates,
    projection,
    writable,
    cells,
    setError,
  });
  const fields = pivotFields(projection);
  return (
    <Page
      className="production-planning-module production-planning-pivot"
      banner={<DemoBanner />}
    >
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
              loading={exported.isPending}
              disabled={!writable || !records.length}
              title="Exporta las partes de esta página."
              onClick={() => exported.mutate()}
            >
              Exportar página
            </ExportButton>
            <ActionGroup
              label={
                projection ? "Acciones de proyección" : "Acciones del Plan LG"
              }
              actions={[
                {
                  id: "history",
                  label: "Historial de importaciones",
                  onClick: () => setDialog({ type: "history" }),
                },
                ...(projection
                  ? [
                      {
                        id: "inventory",
                        label: "Importar inventario",
                        onClick: () =>
                          setDialog({ type: "import", kind: "inventory" }),
                      },
                      {
                        id: "sync",
                        label: "Sincronizar schedule",
                        onClick: () =>
                          setDialog({ type: "import", kind: "sync-schedule" }),
                      },
                      {
                        id: "proposal",
                        label: "Proponer schedule",
                        disabled: !writable,
                        onClick: () => setDialog({ type: "proposal" }),
                      },
                    ]
                  : [
                      {
                        id: "lg",
                        label: "Importar Plan LG",
                        onClick: () =>
                          setDialog({ type: "import", kind: "lg" }),
                      },
                    ]),
              ]}
            />
          </>
        }
        fields={fields}
        values={draft}
        defaults={initial}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={submit}
        onReset={reset}
        pending={query.isFetching}
      />
      <Card
        fill
        label={
          projection
            ? "Proyección · Plan / Schedule / Inventario"
            : "Plan de producción LG"
        }
      >
        {(error || exported.error) && (
          <Alert tone="warning" className="table-notice">
            {error || exported.error?.message}
          </Alert>
        )}
        <ResultNotice result={result} onClose={() => setResult(null)} />
        {projection && (
          <div className="production-planning-capture">
            <TextField
              label="Línea de schedule"
              placeholder="Usar línea de cada parte"
              suggestions={lineSuggestions}
              maxLength={10}
              value={capture.linea}
              onChange={(event) =>
                setCapture((previous) => ({
                  ...previous,
                  linea: event.target.value.toUpperCase(),
                }))
              }
            />
            <SelectField
              label="Turno de schedule"
              value={capture.turno}
              options={TURNOS.map((value) => ({ value, label: value }))}
              onChange={(event) =>
                setCapture((previous) => ({
                  ...previous,
                  turno: event.target.value,
                }))
              }
            />
          </div>
        )}
        <DataTable
          key={`${projection}:${key}:${page}:${size}`}
          virtualRows={{ rowHeight: 26, groupSize: projection ? 3 : 1 }}
          label={projection ? "Proyección P/S/I" : "Plan LG por parte y fecha"}
          rows={records}
          columns={columns}
          rowKey={(row) => `${text(row.part_no)}:${text(row._kind)}`}
          layout="fixed"
          minWidth={Math.max(
            projection ? 1350 : 750,
            dates.length * 80 + (projection ? 1050 : 280),
          )}
          loading={query.isPending}
          fetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
        {!query.isPending && !query.error && (
          <Pagination
            itemLabel="partes"
            page={page}
            pageSize={size}
            total={query.data?.total_parts ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPage(1);
              setSize(value);
            }}
            disabled={query.isFetching}
            fetching={query.isFetching}
          />
        )}
      </Card>

      <PivotDialogs pivot={pivot} />
    </Page>
  );
}
export default function PartPlanningPage() {
  return <PivotPage />;
}
