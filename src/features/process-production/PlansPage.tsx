import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  MoveRight,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useForm } from "@/shared/hooks/useForm";
import {
  ActionGroup,
  Alert,
  Button,
  Card,
  DataGrid,
  ExportButton,
  FilterBar,
  TableRowActions,
  Page,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { AssyTools } from "./AssyTools";
import {
  FormDialog,
  makeColumns,
  ResultNotice,
  useProcess,
} from "./components";
import { ImportPlans } from "./ImportPlans";
import { defaults, lineName, PLAN_SPECS, rangeIssue, text } from "./model";
import { PlanForm } from "./PlanForm";
import { planGrouping } from "./PlanGroups";
import { Reschedule } from "./Reschedule";
import {
  autoArrange,
  calculateTimeline,
  moveRow,
  moveToGroup,
  orderPayload,
} from "./timeline";
import type { Field, Filters, Kind, Row } from "./types";
import "./module.css";
type Dialog =
  | { type: "new" }
  | { type: "edit" | "cancel" | "group"; row: Row }
  | { type: "import" | "reschedule" | "wos" | "scan" | "proposals" }
  | null;
export function PlansPage({ kind }: { kind: Kind }) {
  const context = useProcess(),
    [initial] = useState(defaults),
    [draft, setDraft] = useState(initial),
    [applied, setApplied] = useState(initial),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState<Dialog>(null),
    [result, setResult] = useState<Row | null>(null),
    [localOrder, setLocalOrder] = useState<Row[] | null>(null),
    [groups, setGroups] = useState(6);
  const query = useQuery({
    queryKey: context.key("plans", kind, applied.start, applied.end),
    queryFn: ({ signal }) => context.api.plans(kind, applied, signal),
    refetchOnWindowFocus: false,
  });
  const source = localOrder ?? query.data ?? [];
  const calculated = useMemo(
    () => calculateTimeline(kind, source, applied.view),
    [kind, source, applied.view],
  );
  const data = useMemo(
    () =>
      calculated.filter(
        (row) => !applied.line || text(row.line) === applied.line,
      ),
    [calculated, applied.line],
  );
  const dirty = localOrder !== null,
    ready = !query.isFetching && !query.error && !!query.data;
  function done(value: Row) {
    setDialog(null);
    setResult(value);
    context.saved();
  }
  const orderForm = useForm({
    initialValues: {},
    validate: () =>
      source.length && dirty && ready
        ? []
        : ["No hay cambios de orden para guardar."],
    onSubmit: async () => {
      const value = await context.api.action(
        kind,
        "order",
        orderPayload(kind, calculateTimeline(kind, source)),
      );
      setLocalOrder(null);
      setResult(value);
      context.saved("Orden guardado.");
    },
  });
  const exportForm = useForm({
    initialValues: {},
    validate: () =>
      dirty ? ["Guarda o descarta el orden antes de exportar."] : [],
    onSubmit: () => context.api.export(kind, data),
  });
  const specs = useMemo(
    () =>
      PLAN_SPECS.filter(([id]) => id !== "group_no").filter(([id]) =>
        kind === "ASSY"
          ? ![
              "lado",
              "lote_padre",
              "qr_required_count",
              "array_size",
              "bottom_producido",
              "top_producido",
            ].includes(id)
          : kind === "IMT"
            ? ![
                "sub_assy",
                "lado",
                "lote_padre",
                "bottom_producido",
                "top_producido",
                "output",
                "entregadas_main",
              ].includes(id)
            : ![
                "sub_assy",
                "assigned_bom_rev",
                "output",
                "entregadas_main",
              ].includes(id),
      ),
    [kind],
  );
  function reorder(lot: string, target: string) {
    if (!ready || orderForm.pending) return;
    try {
      setLocalOrder(moveRow(kind, calculated, lot, target));
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo cambiar el orden.",
      );
    }
  }
  function moveGroup(lot: string, group: number, date: string) {
    if (!ready || orderForm.pending) return;
    try {
      setLocalOrder(moveToGroup(calculated, lot, group, date));
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo cambiar de grupo.",
      );
    }
  }
  const grouping = useMemo(
    () =>
      planGrouping({
        kind,
        view: applied.view,
        rows: data,
        count: groups,
        date: applied.end,
        canDrop: ready && !orderForm.pending,
        onMove: moveGroup,
      }),
    [
      kind,
      applied.view,
      applied.end,
      data,
      groups,
      ready,
      orderForm.pending,
      calculated,
    ],
  );
  const columns = useMemo<TableColumn<Row>[]>(
    () => [
      ...makeColumns(specs, false).map((col) => ({
        ...col,
        className:
          col.id === "sequence" ? "process-production-sequence" : col.className,
        width: `${parseFloat(String(col.width)) * 0.89}%`,
        ...(col.id === "line"
          ? { cell: (row: Row) => lineName(kind, row.line) }
          : col.id === "status"
            ? {
                cell: (row: Row) => (
                  <span
                    className={`process-production-status ${row.status === "CANCELADO" ? "process-production-cancelled" : ""}`}
                  >
                    {text(row.status)}
                  </span>
                ),
              }
            : {}),
      })),
      {
        id: "actions",
        header: "ACCIONES",
        width: "11%",
        filterable: false,
        cell: (row) => {
          const index = calculated.findIndex(
              (item) => item.lot_no === row.lot_no,
            ),
            previous = calculated[index - 1],
            next = calculated[index + 1];
          return (
            <TableRowActions
              actions={[
                {
                  id: "edit",
                  label: `Editar ${text(row.lot_no)}`,
                  icon: <Pencil size={14} />,
                  disabled: !ready || dirty,
                  onClick: () => setDialog({ type: "edit", row }),
                },
                {
                  id: "cancel",
                  label: `${row.status === "CANCELADO" ? "Reactivar" : "Cancelar"} ${text(row.lot_no)}`,
                  icon: <Ban size={14} />,
                  tone: "danger",
                  disabled: !ready || dirty,
                  onClick: () => setDialog({ type: "cancel", row }),
                },
                {
                  id: "up",
                  label: `Subir ${text(row.lot_no)}`,
                  icon: <ArrowUp size={14} />,
                  disabled:
                    !ready || !previous || previous._bucket !== row._bucket,
                  onClick: () =>
                    previous &&
                    reorder(text(row.lot_no), text(previous.lot_no)),
                },
                {
                  id: "down",
                  label: `Bajar ${text(row.lot_no)}`,
                  icon: <ArrowDown size={14} />,
                  disabled: !ready || !next || next._bucket !== row._bucket,
                  onClick: () =>
                    next && reorder(text(row.lot_no), text(next.lot_no)),
                },
                ...(kind === "ASSY"
                  ? [
                      {
                        id: "group",
                        label: `Mover de grupo ${text(row.lot_no)}`,
                        icon: <MoveRight size={14} />,
                        disabled: !ready,
                        onClick: () => setDialog({ type: "group", row }),
                      },
                    ]
                  : []),
              ]}
            />
          );
        },
      },
    ],
    [specs, kind, ready, dirty, calculated],
  );
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
  let actionFields: Field[] = [],
    actionInitial: Row = {},
    actionTitle = "";
  const row = dialog && "row" in dialog ? dialog.row : undefined;
  if (dialog?.type === "cancel") {
    actionTitle = `${row?.status === "CANCELADO" ? "Reactivar" : "Cancelar"} plan`;
    actionInitial = {
      lot_no: row?.lot_no,
      status: row?.status === "CANCELADO" ? "PLAN" : "CANCELADO",
    };
  }
  if (dialog?.type === "group") {
    actionTitle = `Mover de grupo · ${text(row?.lot_no)}`;
    actionInitial = { group_no: row?.group_no ?? 1 };
    actionFields = [
      {
        key: "group_no",
        label: "Grupo destino",
        type: "number",
        min: 1,
        max: 12,
        step: 1,
        required: true,
      },
    ];
  }
  const commonInitial = {
    working_date: applied.end,
    line: kind === "ASSY" ? "M1" : kind === "IMT" ? "P1" : "SA",
    plan_count: 0,
    turno: "DIA",
    shift: "DIA",
    group_no: 1,
    sequence: source.length + 1,
    ct: 0,
    uph: 100,
    qr_required_count: 1,
    array_size: 1,
    lado: "",
    process: kind === "IMT" ? "IMD" : kind,
  };
  const orderNotice = (
    <span
      className="process-production-order-notice"
      role="status"
      aria-live="polite"
      title={dirty ? "Orden sin guardar" : undefined}
    >
      {dirty && (
        <>
          <span className="process-production-order-dot" aria-hidden="true">
            ●
          </span>
          <span className="process-production-order-text">
            Orden sin guardar.
          </span>
        </>
      )}
    </span>
  );
  return (
    <Page
      className={`process-production-module process-production-plans process-production-${kind.toLowerCase()}`}
      banner={<DemoBanner />}
    >
      <FilterBar
        actions={
          <>
            <Button
              size="sm"
              disabled={!ready || dirty}
              icon={<RefreshCw size={15} />}
              onClick={() => void query.refetch()}
            >
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              disabled={!ready || dirty || !data.length}
              loading={exportForm.pending}
              title="Exporta los planes de la consulta y línea seleccionada, con su orden y tiempos."
              onClick={() => void exportForm.submit()}
            />
            <Button
              size="sm"
              variant="success"
              disabled={dirty}
              onClick={() => setDialog({ type: "new" })}
            >
              Nuevo plan
            </Button>
            <ActionGroup
              label="Acciones de planes"
              actions={[
                {
                  id: "reschedule",
                  label: "Reprogramar",
                  disabled: dirty,
                  onClick: () => setDialog({ type: "reschedule" }),
                },
                ...(kind === "ASSY"
                  ? [
                      {
                        id: "wos",
                        label: "Importar WOs",
                        disabled: dirty,
                        onClick: () => setDialog({ type: "wos" }),
                      },
                      {
                        id: "scan",
                        label: "Lotes SCAN sin asignar",
                        disabled: dirty,
                        onClick: () => setDialog({ type: "scan" }),
                      },
                      {
                        id: "ia",
                        label: "Plan IA",
                        disabled: dirty,
                        onClick: () => setDialog({ type: "proposals" }),
                      },
                    ]
                  : [
                      {
                        id: "excel",
                        label: "Importar Excel",
                        disabled: dirty,
                        onClick: () => setDialog({ type: "import" }),
                      },
                    ]),
                ...(kind !== "ASSY"
                  ? [
                      {
                        id: "order",
                        label: "Guardar orden",
                        disabled: !dirty || !ready || orderForm.pending,
                        onClick: () => void orderForm.submit(),
                      },
                      {
                        id: "discard-order",
                        label: "Descartar orden",
                        disabled: !dirty || orderForm.pending,
                        onClick: () => setLocalOrder(null),
                      },
                    ]
                  : []),
              ]}
            />
          </>
        }
        fields={fields}
        values={draft}
        defaults={initial}
        pending={query.isFetching || dirty || orderForm.pending}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onReset={() => {
          const next = defaults();
          setDraft(next);
          setApplied(next);
          setError("");
        }}
        onSubmit={() => {
          const issue = rangeIssue(draft);
          setError(issue);
          if (!issue) {
            setApplied({ ...draft });
            if (draft.start === applied.start && draft.end === applied.end)
              void query.refetch();
          }
        }}
      />
      <Card fill label={`Planes de producción ${kind}`}>
        {(error || orderForm.error || exportForm.error) && (
          <Alert tone="danger" className="table-notice">
            {error || orderForm.error?.message || exportForm.error?.message}
          </Alert>
        )}
        <ResultNotice result={result} />
        {kind === "ASSY" && (
          <div className="process-production-controls">
            <TextGroupCount value={groups} onChange={setGroups} />
            <Button
              size="sm"
              disabled={!ready || orderForm.pending}
              onClick={() => {
                try {
                  setLocalOrder(autoArrange(calculated, groups));
                  setError("");
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "No se pudo acomodar.",
                  );
                }
              }}
            >
              Auto acomodo
            </Button>
            <div
              className="process-production-order-controls"
              data-dirty={dirty}
              aria-hidden={!dirty}
              inert={!dirty}
            >
              {orderNotice}
              <Button
                size="sm"
                aria-label="Guardar orden"
                loading={orderForm.pending}
                disabled={!dirty || !ready}
                onClick={() => void orderForm.submit()}
              >
                Guardar
                <span className="process-production-order-suffix"> orden</span>
              </Button>
              <Button
                size="sm"
                aria-label="Descartar orden"
                disabled={!dirty || orderForm.pending}
                onClick={() => setLocalOrder(null)}
              >
                Descartar
                <span className="process-production-order-suffix"> orden</span>
              </Button>
            </div>
          </div>
        )}
        <DataGrid
          label={`Planes ${kind}`}
          rows={data}
          grouping={grouping}
          columns={columns}
          rowKey={(row) => text(row.lot_no)}
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          minWidth={kind === "ASSY" ? 1850 : 1750}
          layout="fixed"
          resetKey={`${kind}:${applied.start}:${applied.end}:${applied.line}:${applied.view}`}
          rowProps={(row) => ({
            draggable: ready && !orderForm.pending,
            onDragStart: (event) => {
              event.dataTransfer.setData("text/plain", text(row.lot_no));
              event.dataTransfer.effectAllowed = "move";
            },
            onDragOver: (event) => {
              if (ready) event.preventDefault();
            },
            onDrop: (event) => {
              event.preventDefault();
              if (ready)
                reorder(
                  event.dataTransfer.getData("text/plain"),
                  text(row.lot_no),
                );
            },
            className:
              row.status === "CANCELADO"
                ? "process-production-row-cancelled"
                : row._overtime
                  ? "process-production-overtime"
                  : undefined,
          })}
        />
      </Card>
      {(dialog?.type === "new" || dialog?.type === "edit") && (
        <PlanForm
          kind={kind}
          editing={dialog.type === "edit"}
          initial={
            dialog.type === "edit"
              ? {
                  ...commonInitial,
                  ...dialog.row,
                  turno:
                    ["DIA", "TIEMPO EXTRA", "NOCHE"][
                      Number(dialog.row.routing ?? 1) - 1
                    ] ?? "DIA",
                }
              : commonInitial
          }
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === "import" && (
        <ImportPlans
          kind={kind}
          date={applied.end}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === "reschedule" && (
        <Reschedule
          kind={kind}
          initial={applied}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog && ["wos", "scan", "proposals"].includes(dialog.type) && (
        <AssyTools
          tool={dialog.type as "wos" | "scan" | "proposals"}
          initial={applied}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog && ["cancel", "group"].includes(dialog.type) && (
        <FormDialog
          title={actionTitle}
          description={
            dialog.type === "cancel"
              ? `Se actualizará el estado de ${text(row?.lot_no)}. Se conserva el registro y su trazabilidad.`
              : dialog.type === "group"
                ? "El cambio quedará en el orden local hasta pulsar Guardar orden."
                : undefined
          }
          fields={actionFields}
          initial={actionInitial}
          onClose={() => setDialog(null)}
          label={dialog.type === "group" ? "Mover" : "Confirmar"}
          onSave={async (value) => {
            if (dialog.type === "group") {
              setLocalOrder(
                moveToGroup(
                  calculated,
                  text(row?.lot_no),
                  Number(value.group_no),
                  text(row?.working_date),
                ),
              );
              setDialog(null);
              return { message: "Grupo actualizado en el orden local." };
            }
            return context.api.action(kind, "update", value);
          }}
          onDone={(value) => {
            if (dialog.type === "group") {
              setResult(value);
              return;
            }
            done(value);
          }}
        />
      )}
    </Page>
  );
}
import { TextField } from "@/shared/ui";
function TextGroupCount({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <TextField
      label="Grupos"
      type="number"
      min={1}
      max={12}
      step={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
