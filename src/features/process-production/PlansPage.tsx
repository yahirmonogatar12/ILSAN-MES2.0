import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Card,
  DataGrid,
  FilterBar,
  Page,
  type FilterField,
} from "@/shared/ui";
import { ResultNotice } from "./components";
import { lineName, text } from "./model";
import { PlanActions, PlanOrderControls } from "./PlanActions";
import { PlanDialogs } from "./PlanDialogs";
import { usePlanColumns } from "./planColumns";
import { usePlans } from "./usePlans";
import type { Filters, Kind, Plan } from "./types";
import "./module.css";
export function PlansPage({ kind }: { kind: Kind }) {
  const state = usePlans(kind);
  const {
    initial,
    draft,
    setDraft,
    applied,
    error,
    result,
    query,
    data,
    grouping,
    ready,
    dirty,
    orderForm,
    exportForm,
    reorder,
  } = state;
  const columns = usePlanColumns(kind);
  const canMove = ready && !orderForm.pending;
  const canEdit = canMove && !dirty;
  function edit(row: Plan) {
    if (canEdit) state.setDialog({ type: "edit", row });
  }
  const fields: FilterField<Filters>[] = [
    { key: "start", label: "Fecha desde", type: "date" },
    { key: "end", label: "Fecha hasta", type: "date" },
    {
      key: "line",
      label: "Línea",
      type: "select",
      options: [
        { value: "", label: "Todas" },
        ...[...new Set((query.data ?? []).map((row) => text(row.line)))]
          .sort()
          .map((value) => ({ value, label: lineName(kind, value) })),
      ],
    },
    ...(kind === "ASSY"
      ? [
          {
            key: "view" as const,
            label: "Vista",
            type: "select" as const,
            options: [
              { value: "groups", label: "Por grupos" },
              { value: "lines", label: "Por líneas" },
            ],
          },
        ]
      : []),
  ];
  return (
    <Page
      className={`process-production-module process-production-plans process-production-${kind.toLowerCase()}`}
      banner={<DemoBanner />}
    >
      <FilterBar
        actions={<PlanActions state={state} />}
        fields={fields}
        values={draft}
        defaults={initial}
        pending={query.isFetching || dirty || orderForm.pending}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onReset={state.reset}
        onSubmit={state.submit}
      />
      <Card fill label={`Planes de producción ${kind}`}>
        {(error || orderForm.error || exportForm.error) && (
          <Alert tone="danger" className="table-notice">
            {error || orderForm.error?.message || exportForm.error?.message}
          </Alert>
        )}
        <ResultNotice result={result} />
        <PlanOrderControls state={state} />
        <DataGrid
          label={`Planes ${kind}`}
          rows={data}
          grouping={grouping}
          columns={columns}
          rowKey={(row) => text(row.lot_no)}
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          minWidth={1000}
          layout="fixed"
          resetKey={`${kind}:${applied.start}:${applied.end}:${applied.line}:${applied.view}`}
          rowProps={(row) => ({
            tabIndex: canEdit ? 0 : undefined,
            "aria-label": `Plan ${text(row.lot_no)}`,
            "aria-keyshortcuts": "Enter",
            title: canEdit
              ? "Doble clic o Enter para editar el plan"
              : dirty
                ? "Guarda o descarta el orden para editar el plan"
                : undefined,
            onDoubleClick: () => edit(row),
            onKeyDown: (event) => {
              if (
                event.key === "Enter" &&
                event.target === event.currentTarget
              ) {
                event.preventDefault();
                edit(row);
              }
            },
            draggable: canMove,
            onDragStart: (event) => {
              event.dataTransfer.setData("text/plain", text(row.lot_no));
              event.dataTransfer.effectAllowed = "move";
            },
            onDragOver: (event) => {
              if (canMove) event.preventDefault();
            },
            onDrop: (event) => {
              event.preventDefault();
              // Other drags (a workspace tab) carry no lot and change nothing.
              const lot = event.dataTransfer.getData("text/plain");
              if (canMove && lot) reorder(lot, text(row.lot_no));
            },
            className:
              row.status === "CANCELADO"
                ? "process-production-row-cancelled"
                : kind === "ASSY" && row._overtime
                  ? "process-production-overtime"
                  : undefined,
          })}
        />
      </Card>
      <PlanDialogs state={state} />
    </Page>
  );
}
