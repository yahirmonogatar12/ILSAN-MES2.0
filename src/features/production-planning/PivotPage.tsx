import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  ActionGroup,
  Alert,
  Button,
  Card,
  DataTable,
  DEFAULT_PAGE_SIZE,
  EditableCell,
  ExportButton,
  FilterBar,
  Page,
  Pagination,
  SelectField,
  TextField,
  useCellEditor,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import {
  ReportDialog,
  ResultNotice,
  exportRows,
  usePlanning,
} from "./components";
import { ImportDialog } from "./ImportDialog";
import { ProposalDialog } from "./ProposalDialog";
import {
  HISTORY_SPECS,
  INV_FIELDS,
  cellInteger,
  numeric,
  object,
  rangeIssue,
  text,
  TURNOS,
  week,
} from "./model";
import type { PivotFilters, Row, Spec } from "./types";
import "./module.css";
type Dialog =
  | { type: "import"; kind: "lg" | "inventory" | "sync-schedule" }
  | { type: "history" }
  | { type: "proposal" }
  | null;
export function pivotRows(records: Row[], projection: boolean): Row[] {
  return records.flatMap((row) =>
    projection
      ? [
          { ...row, _kind: "P" },
          { ...row, _kind: "S" },
          { ...row, _kind: "I" },
        ]
      : [{ ...row, _kind: "P" }],
  );
}
export function PivotPage({ projection = false }: { projection?: boolean }) {
  const auth = usePlanning(),
    [initial] = useState(week),
    [draft, setDraft] = useState(initial),
    [applied, setApplied] = useState(initial),
    [page, setPage] = useState(1),
    [size, setSize] = useState(DEFAULT_PAGE_SIZE),
    [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null),
    [result, setResult] = useState<Row | null>(null);
  const editor = useCellEditor();
  const [capture, setCapture] = useState({ linea: "", turno: "DIA" });
  const key = JSON.stringify(applied);
  const query = useQuery({
    queryKey: auth.key("pivot", projection, key, page, size),
    queryFn: ({ signal }) => auth.api.pivot(applied, page, size, signal),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === projection &&
      previousQuery.queryKey[4] === key
        ? previous
        : undefined,
  });
  useEffect(() => {
    if (query.data && !query.isFetching && !query.isPlaceholderData) {
      const last = Math.max(1, Math.ceil(query.data.total_parts / size));
      if (page > last) setPage(last);
    }
  }, [query.data, query.isFetching, query.isPlaceholderData, page, size]);
  const history = useQuery({
    queryKey: auth.key("imports"),
    queryFn: ({ signal }) => auth.api.history(signal),
    enabled: dialog?.type === "history",
  });
  const dates = query.data?.dates ?? [],
    records = useMemo(
      () => pivotRows(query.data?.rows ?? [], projection),
      [query.data, projection],
    );
  const writable = !!query.data && !query.error && !query.isPlaceholderData;
  const lineSuggestions = useMemo(
    () => [
      ...new Set(
        (query.data?.rows ?? [])
          .map((row) => (object(row.inv) ? text(row.inv.line) : ""))
          .filter(Boolean),
      ),
    ],
    [query.data],
  );
  const saveCell = useCallback(
    async (
      row: Row,
      kind: "inventory" | "schedule",
      field: string,
      raw: string,
    ) => {
      const part = text(row.part_no);
      try {
        setError("");
        const value = cellInteger(raw, kind === "schedule" ? 0 : undefined);
        const linea = (
          capture.linea.trim() || (object(row.inv) ? text(row.inv.line) : "")
        )
          .trim()
          .toUpperCase();
        if (kind === "schedule" && value > 0 && !linea)
          throw new Error(
            "Selecciona una línea de schedule para una cantidad positiva.",
          );
        await auth.api.action(
          kind === "inventory" ? "inventory-field" : "schedule",
          kind === "inventory"
            ? {
                part_no: part,
                field,
                value,
              }
            : {
                part_no: part,
                sched_date: field,
                sched_qty: raw.trim() === "" ? null : value,
                linea,
                turno: capture.turno,
              },
        );
        setResult(null);
        await auth.client.invalidateQueries({
          queryKey: ["production-planning", auth.scope],
        });
        return kind === "schedule" && raw.trim() === "" ? "" : String(value);
      } catch (cause) {
        const issue =
          cause instanceof Error
            ? cause
            : new Error("No se pudo guardar la celda.");
        setError(
          `${part} · ${kind === "inventory" ? field.toUpperCase() : field}: ${issue.message}`,
        );
        throw issue;
      }
    },
    [auth.api, auth.client, auth.scope, capture],
  );
  const columns = useMemo(() => {
    const grouped = (row: Row) => ({ rowSpan: row._kind === "P" ? 3 : 0 });
    const common: TableColumn<Row>[] = [
      {
        id: "part_no",
        header: "NÚMERO DE PARTE",
        width: projection ? 170 : 190,
        cellSpan: projection ? grouped : undefined,
        cell: (row) => (
          <span
            title={
              object(row.inv)
                ? `Referencia: ${text(row.inv.ref_date)} · Línea: ${text(row.inv.line)}`
                : undefined
            }
          >
            {text(row.part_no)}
          </span>
        ),
      },
    ];
    if (projection) {
      common.push({
        id: "req_lg",
        header: "REQ LG",
        width: 85,
        cellSpan: grouped,
        cell: (row) => numeric(row.req_lg),
      });
      for (const field of INV_FIELDS)
        common.push({
          id: field,
          header: field.toUpperCase(),
          width: 75,
          cellSpan: grouped,
          cell: (row) => (
            <EditableCell
              editor={editor}
              cellId={JSON.stringify(["inventory", row.part_no, field])}
              label={`Editar ${field.toUpperCase()} ${text(row.part_no)}`}
              value={object(row.inv) ? (row.inv[field] as number | null) : null}
              formatValue={(value) => (value === "" ? "—" : numeric(value))}
              disabled={!writable}
              onSave={(value) => saveCell(row, "inventory", field, value)}
              onCancel={() => setError("")}
            />
          ),
        });
      common.push({
        id: "kind",
        header: "TIPO",
        width: 55,
        cell: (row) => (
          <span
            className={`production-planning-${text(row._kind).toLowerCase()}`}
          >
            {text(row._kind)}
          </span>
        ),
      });
    }
    common.push({
      id: "total",
      header: "TOTAL",
      width: 95,
      cell: (row) => {
        if (row._kind === "P") return numeric(row.total);
        if (row._kind === "S") return numeric(row.sched_total ?? 0);
        const vals = dates
          .map((day) => (object(row.proj) ? row.proj[day] : null))
          .filter((v) => v !== null && v !== undefined);
        return vals.length ? numeric(vals.at(-1)) : "—";
      },
    });
    for (const date of dates)
      common.push({
        id: date,
        header: `${date.slice(8)}/${date.slice(5, 7)}`,
        width: 90,
        cell: (row) => {
          const source =
              row._kind === "P"
                ? row.qty
                : row._kind === "S"
                  ? row.sched
                  : row.proj,
            value = object(source) ? source[date] : null;
          return row._kind === "S" ? (
            <EditableCell
              editor={editor}
              cellId={JSON.stringify(["schedule", row.part_no, date])}
              label={`Editar schedule ${text(row.part_no)} ${date}`}
              value={value as number | null}
              formatValue={(value) => (value === "" ? "—" : numeric(value))}
              disabled={!writable}
              onSave={(value) => saveCell(row, "schedule", date, value)}
              onCancel={() => setError("")}
            />
          ) : (
            <span
              className={
                Number(value) < 0 ? "production-planning-negative" : undefined
              }
            >
              {value === null || value === undefined ? "—" : numeric(value)}
            </span>
          );
        },
      });
    const totalWidth = common.reduce(
      (sum, column) => sum + Number(column.width),
      0,
    );
    return common.map((column) => ({
      ...column,
      width: `${(Number(column.width) / totalWidth) * 100}%`,
    }));
  }, [dates, projection, writable, editor, saveCell]);
  const fields: FilterField<PivotFilters>[] = [
    { key: "date_from", label: "Fecha desde", type: "date" },
    { key: "date_to", label: "Fecha hasta", type: "date" },
    { key: "part", label: "Buscar parte", type: "search" },
    ...(projection
      ? [
          {
            key: "only_shortage",
            label: "Existencias proyectadas",
            type: "select",
            options: [
              { value: "", label: "Todas" },
              { value: "1", label: "Solo faltantes desde hoy" },
            ],
          } as FilterField<PivotFilters>,
        ]
      : []),
  ];
  const sheetSpecs: Spec[] = [
    ["part_no", "NÚMERO DE PARTE", 180],
    ...(projection ? [["_kind", "TIPO", 60] as Spec] : []),
    ["_total", "TOTAL", 90],
    ...dates.map((date) => [date, date, 100] as Spec),
  ];
  const exported = useMutation({
    mutationFn: () =>
      exportRows(
        projection ? `Proyeccion_pagina_${page}` : `Plan_LG_pagina_${page}`,
        sheetSpecs,
        records.map((row) => {
          const source =
            row._kind === "P"
              ? row.qty
              : row._kind === "S"
                ? row.sched
                : row.proj;
          return {
            ...row,
            ...(object(source) ? source : {}),
            _total:
              row._kind === "P"
                ? row.total
                : row._kind === "S"
                  ? row.sched_total
                  : object(row.proj)
                    ? row.proj[dates.at(-1) ?? ""]
                    : null,
          };
        }),
      ),
  });
  function done(response: Row) {
    setDialog(null);
    setResult(response);
    auth.saved();
  }
  function submit() {
    const issue = rangeIssue(draft.date_from, draft.date_to, 120);
    setError(issue);
    if (issue) return;
    setPage(1);
    setApplied({ ...draft });
    if (page === 1 && JSON.stringify(draft) === key) void query.refetch();
  }
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
        onReset={() => {
          const next = week();
          setDraft(next);
          setApplied(next);
          setPage(1);
          setError("");
        }}
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
      {dialog?.type === "import" && (
        <ImportDialog
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === "history" && (
        <ReportDialog
          title="Historial de importaciones LG"
          records={history.data ?? []}
          specs={HISTORY_SPECS}
          loading={history.isPending}
          error={history.error}
          onRetry={() => void history.refetch()}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "proposal" && (
        <ProposalDialog
          filters={applied}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
    </Page>
  );
}
export default function PartPlanningPage() {
  return <PivotPage />;
}
