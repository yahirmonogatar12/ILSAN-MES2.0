import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  ExportButton,
  FilterBar,
  Page,
  TableRowActions,
  useToast,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { createReworkApi } from "./api";
import { AreaBadges, columnsFor, ListSummary, StateBadge } from "./components";
import { Detail } from "./Detail";
import { areaText, defaultFilters, filterIssue, STATES } from "./model";
import { RequestForm } from "./RequestForm";
import type { Filters, ReworkDetail, ReworkSummary } from "./types";
import "./module.css";
const fields: FilterField<Filters>[] = [
  { key: "desde", label: "Fecha desde", type: "date" },
  { key: "hasta", label: "Fecha hasta", type: "date" },
  {
    key: "codigo",
    label: "Folio, NP, QR o caja",
    type: "search",
    placeholder: "Busca en todo el historial",
  },
  {
    key: "estado",
    label: "Estado",
    type: "select",
    options: [
      { value: "", label: "Todos" },
      ...Object.entries(STATES).map(([value, label]) => ({ value, label })),
    ],
  },
];
const baseColumns = columnsFor<ReworkSummary>([
  ["folio", "FOLIO", 145],
  ["np_origen", "NP ORIGEN", 115],
  ["np_destino", "NP DESTINO", 115],
  ["cantidad", "CANT.", 55],
  ["tipo_material", "MATERIAL", 70],
  ["origenes_txt", "ORIGEN", 145],
  ["areas", "ÁREAS", 330],
  ["estado", "ESTADO", 100],
  ["solicitado_por", "SOLICITÓ", 95],
  ["created_at", "FECHA", 145],
]);
export default function ReworkPage() {
  const { mode, scope } = useAuth(),
    api = useMemo(() => createReworkApi(mode), [mode]),
    client = useQueryClient(),
    toast = useToast();
  const [defaults] = useState(defaultFilters),
    [draft, setDraft] = useState(defaults),
    [applied, setApplied] = useState(defaults),
    [error, setError] = useState("");
  const [dialog, setDialog] = useState<
    { type: "new" } | { type: "detail"; id: number } | null
  >(null);
  const query = useQuery({
    queryKey: ["rework", scope, "list", applied],
    queryFn: ({ signal }) => api.list(applied, signal),
  });
  const exported = useMutation({ mutationFn: () => api.export(applied) });
  const columns = useMemo<TableColumn<ReworkSummary>[]>(
    () => [
      ...baseColumns.map((col) => ({
        ...col,
        width: `${parseFloat(String(col.width)) * 0.94}%`,
        ...(col.id === "areas"
          ? {
              cell: (row: ReworkSummary) => (
                <AreaBadges areas={row.areas} compact />
              ),
              textValue: (row: ReworkSummary) => areaText(row.areas),
            }
          : col.id === "estado"
            ? {
                cell: (row: ReworkSummary) => <StateBadge state={row.estado} />,
                textValue: (row: ReworkSummary) =>
                  STATES[row.estado] ?? row.estado,
              }
            : col.id === "tipo_material"
              ? {
                  cell: (row: ReworkSummary) =>
                    row.tipo_material === "ASSY" ? "ASSY" : "IMD-SMD",
                }
              : {}),
      })),
      {
        id: "actions",
        header: "ACCIONES",
        width: "6%",
        filterable: false,
        cell: (row) => (
          <TableRowActions
            actions={[
              {
                id: "detail",
                label: `Ver ${row.folio}`,
                icon: <Eye size={16} />,
                onClick: () => setDialog({ type: "detail", id: row.id }),
              },
            ]}
          />
        ),
      },
    ],
    [],
  );
  function submit() {
    const issue = filterIssue(draft);
    setError(issue);
    if (issue) return;
    setApplied({ ...draft });
    if (JSON.stringify(draft) === JSON.stringify(applied)) void query.refetch();
  }
  function created(record: ReworkDetail) {
    client.setQueryData(["rework", scope, "detail", record.id], record);
    setDialog({ type: "detail", id: record.id });
    void client.invalidateQueries({ queryKey: ["rework", scope, "list"] });
    toast(`Solicitud ${record.folio} creada.`);
  }
  return (
    <Page className="rework-module" banner={<DemoBanner />}>
      <FilterBar
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
              loading={exported.isPending}
              title="Exporta hasta 5,000 solicitudes con los filtros generales aplicados; los filtros de columna se usan solo en la tabla."
              onClick={() => exported.mutate()}
            />
            <Button
              size="sm"
              variant="success"
              icon={<Plus size={15} />}
              onClick={() => setDialog({ type: "new" })}
            >
              Nueva solicitud
            </Button>
          </>
        }
        fields={fields}
        values={draft}
        defaults={defaults}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={submit}
        onReset={() => {
          const next = defaultFilters();
          setDraft(next);
          setApplied(next);
          setError("");
        }}
        pending={query.isFetching}
      />
      <Card fill label="Solicitudes de retrabajo">
        {(error || exported.error) && (
          <Alert tone="danger" className="table-notice">
            {error || exported.error?.message}
          </Alert>
        )}
        {applied.codigo.trim() && (
          <Alert className="table-notice">
            Búsqueda por código: todo el historial, sin límite de fechas.
          </Alert>
        )}
        {(query.data?.length ?? 0) >= 500 && (
          <Alert className="table-notice">
            Consulta: últimas 500 solicitudes. Excel: hasta 5,000 registros.
          </Alert>
        )}
        <DataGrid
          label="Solicitudes de retrabajo"
          rows={query.data ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          fetching={query.isFetching}
          layout="fixed"
          minWidth={1250}
          resetKey={JSON.stringify(applied)}
          itemLabel="solicitudes"
          summary={(rows) => <ListSummary rows={rows} />}
        />
      </Card>
      {dialog?.type === "new" && (
        <RequestForm
          api={api}
          scope={scope}
          onClose={() => setDialog(null)}
          onCreated={created}
        />
      )}
      {dialog?.type === "detail" && (
        <Detail
          key={dialog.id}
          api={api}
          scope={scope}
          id={dialog.id}
          onClose={() => setDialog(null)}
          onCancelled={() => {
            void client.invalidateQueries({
              queryKey: ["rework", scope, "list"],
            });
          }}
        />
      )}
    </Page>
  );
}
