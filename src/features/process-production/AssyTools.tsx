import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  FilterBar,
  Modal,
  TabBar,
  type FilterField,
} from "@/shared/ui";
import { FormDialog, makeColumns, useProcess } from "./components";
import { rangeIssue, record, rows, text } from "./model";
import type { Extra, Field, Filters, Row, Spec } from "./types";
type Dialog = {
  title: string;
  action: Extra;
  initial: Row;
  fields: Field[];
  description: string;
} | null;
export function AssyTools({
  tool,
  initial,
  onClose,
  onDone,
}: {
  tool: "wos" | "scan" | "proposals";
  initial: Filters;
  onClose: () => void;
  onDone: (result: Row) => void;
}) {
  const context = useProcess(),
    [draft, setDraft] = useState(initial),
    [applied, setApplied] = useState(initial),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState<Dialog>(null),
    [diff, setDiff] = useState<Row | null>(null),
    [diffBusy, setDiffBusy] = useState(false),
    [tab, setTab] = useState("changes");
  const params: Row =
    tool === "wos"
      ? { desde: applied.start, hasta: applied.end, include_import_status: 1 }
      : tool === "scan"
        ? {
            date_from: applied.start,
            date_to: applied.end,
            line: applied.line,
            part_no: applied.part_number,
            limit: 500,
          }
        : {};
  const query = useQuery({
    queryKey: context.key("assy-tools", tool, params),
    queryFn: ({ signal }) => context.api.extra(tool, params, signal),
  });
  const source = useMemo(
    () =>
      query.data
        ? tool === "scan"
          ? rows(record(query.data).scan_lots)
          : rows(query.data)
        : [],
    [query.data, tool],
  );
  const data = useMemo(
    () =>
      source.map((row, index) => ({
        ...row,
        _id:
          tool === "wos"
            ? String(row.id)
            : tool === "scan"
              ? `${row.linea}:${row.nparte}`
              : text(row.proposal_id),
        _code: row.wo_code ?? row.codigo_wo ?? row.proposal_id,
        _index: index,
      })),
    [source, tool],
  );
  const plans = useMemo(
    () =>
      tool === "scan" && query.data
        ? rows(record(query.data).plan_options)
        : [],
    [query.data, tool],
  );
  const fields: FilterField<Filters>[] = [
    { key: "start", label: "Desde", type: "date" },
    { key: "end", label: "Hasta", type: "date" },
    ...(tool === "scan"
      ? [
          { key: "line" as const, label: "Línea", type: "search" as const },
          {
            key: "part_number" as const,
            label: "Número de parte",
            type: "search" as const,
          },
        ]
      : []),
  ];
  async function compare(row: Row) {
    setDiffBusy(true);
    setError("");
    try {
      const value = record(
        await context.api.extra("diff", { proposal_id: row.proposal_id }),
      );
      const changes = rows(value.cambios);
      rows(value.nuevos);
      rows(value.sobran);
      setDiff(value);
      setTab("changes");
      setSelected(
        new Set(
          changes
            .filter(
              (change) =>
                !change.bloqueado &&
                Array.isArray(change.campos) &&
                change.campos.some((field) =>
                  ["cantidad", "linea"].includes(text(field)),
                ),
            )
            .map((change) => text(change.lot_no)),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo comparar la propuesta.",
      );
    } finally {
      setDiffBusy(false);
    }
  }
  const columns = useMemo(() => {
    const specs: readonly Spec[] =
      tool === "wos"
        ? [
            ["_code", "WO", 150],
            ["codigo_po", "PO", 130],
            ["modelo", "MODELO", 150],
            ["cantidad_planeada", "CANTIDAD", 90],
            ["fecha_operacion", "FECHA", 95],
            ["estado", "ESTADO", 95],
            ["lot_no_existente", "LOTE EXISTENTE", 180],
          ]
        : tool === "scan"
          ? [
              ["linea", "LÍNEA", 70],
              ["nparte", "PARTE", 140],
              ["modelo", "MODELO", 130],
              ["lotes_scan", "LOTES SCAN", 70],
              ["registros", "REGISTROS", 80],
              ["cantidad_total", "CANTIDAD", 85],
              ["primero", "PRIMERO", 135],
              ["ultimo", "ÚLTIMO", 135],
            ]
          : [
              ["proposal_id", "PROPUESTA", 250],
              ["version", "VERSIÓN", 65],
              ["date_from", "DESDE", 100],
              ["date_to", "HASTA", 100],
              ["status", "ESTADO", 90],
              ["total_items", "LOTES", 75],
              ["total_qty", "PIEZAS", 90],
              ["created_at", "CREADA", 140],
            ];
    return [
      ...(tool === "wos"
        ? [
            {
              id: "select",
              header: "INCLUIR",
              width: "5%",
              filterable: false,
              cell: (row: Row) => (
                <CheckboxField
                  aria-label={`Importar ${text(row._code)}`}
                  checked={selected.has(text(row._id))}
                  disabled={
                    !!row.ya_importado || query.isFetching || !Number(row.id)
                  }
                  onChange={(event) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (event.target.checked) next.add(text(row._id));
                      else next.delete(text(row._id));
                      return next;
                    })
                  }
                />
              ),
            },
          ]
        : []),
      ...makeColumns(specs).map((col) => ({
        ...col,
        width: `${parseFloat(String(col.width)) * (tool === "scan" ? 0.75 : tool === "proposals" ? 0.88 : 0.95)}%`,
      })),
      ...(tool !== "wos"
        ? [
            {
              id: "actions",
              header: "ACCIONES",
              width: tool === "scan" ? "25%" : "12%",
              filterable: false,
              cell: (row: Row) =>
                tool === "proposals" ? (
                  <Button
                    size="sm"
                    disabled={diffBusy || query.isFetching}
                    onClick={() => void compare(row)}
                  >
                    Ver cambios
                  </Button>
                ) : (
                  <div className="process-production-row-actions">
                    <Button
                      size="sm"
                      disabled={query.isFetching}
                      onClick={() => {
                        const eligible = plans.filter(
                          (plan) =>
                            plan.line === row.linea &&
                            plan.part_no === row.nparte &&
                            plan.status !== "CANCELADO" &&
                            Number(plan.plan_count) >
                              Number(plan.produced_count ?? 0),
                        );
                        setDialog({
                          title: `Asignar SCAN · ${text(row.nparte)}`,
                          action: "assign-scan",
                          initial: {
                            ...params,
                            linea: row.linea,
                            nparte: row.nparte,
                            target_lot_no: eligible[0]?.lot_no ?? "",
                            allow_extend: false,
                          },
                          fields: [
                            {
                              key: "target_lot_no",
                              label: "Plan destino",
                              type: "select",
                              required: true,
                              options: eligible.map((plan) => ({
                                value: text(plan.lot_no),
                                label: `${text(plan.lot_no)} · pendiente ${Number(plan.plan_count) - Number(plan.produced_count ?? 0)}`,
                              })),
                            },
                            {
                              key: "allow_extend",
                              label:
                                "Extender el plan si la cantidad SCAN supera el pendiente",
                              type: "checkbox",
                            },
                          ],
                          description: `Se asignarán ${text(row.cantidad_total)} piezas al plan seleccionado. La extensión requiere activar la casilla.`,
                        });
                      }}
                    >
                      Asignar a plan
                    </Button>
                    <Button
                      size="sm"
                      disabled={query.isFetching}
                      onClick={() =>
                        setDialog({
                          title: `Crear plan desde SCAN · ${text(row.nparte)}`,
                          action: "create-scan",
                          initial: {
                            ...params,
                            linea: row.linea,
                            nparte: row.nparte,
                            working_date: applied.end,
                          },
                          fields: [
                            {
                              key: "working_date",
                              label: "Fecha de operación",
                              type: "date",
                              required: true,
                            },
                          ],
                          description: `Se creará un plan y se asignarán ${text(row.cantidad_total)} piezas de los escaneos del período.`,
                        })
                      }
                    >
                      Crear plan
                    </Button>
                  </div>
                ),
            },
          ]
        : []),
    ];
  }, [tool, selected, query.isFetching, plans, params, applied.end, diffBusy]);
  const changes = diff ? rows(diff.cambios) : [];
  const diffRows = (
    tab === "changes"
      ? changes
      : diff
        ? rows(tab === "new" ? diff.nuevos : diff.sobran)
        : []
  ).map((row) => ({ ...row, _old: row.antes, _new: row.despues }));
  const diffColumns =
    tab === "changes"
      ? [
          {
            id: "include",
            header: "INCLUIR",
            width: "6%",
            filterable: false,
            cell: (row: Row) => (
              <CheckboxField
                aria-label={`Aplicar ${text(row.lot_no)}`}
                checked={selected.has(text(row.lot_no))}
                disabled={
                  !!row.bloqueado ||
                  !Array.isArray(row.aplicables) ||
                  !row.aplicables.length
                }
                onChange={(event) =>
                  setSelected((previous) => {
                    const next = new Set(previous);
                    if (event.target.checked) next.add(text(row.lot_no));
                    else next.delete(text(row.lot_no));
                    return next;
                  })
                }
              />
            ),
          },
          ...makeColumns([
            ["lot_no", "LOTE", 160],
            ["part_no", "PARTE", 140],
            ["_old", "ANTES (cantidad / línea / grupo / secuencia)", 300],
            ["_new", "DESPUÉS (cantidad / línea / grupo / secuencia)", 300],
            ["aplicables", "CAMPOS APLICABLES", 180],
            ["bloqueado", "BLOQUEO", 190],
            ["razon", "MOTIVO", 180],
          ]).map((col) => ({
            ...col,
            width: `${parseFloat(String(col.width)) * 0.94}%`,
            ...(["_old", "_new"].includes(col.id)
              ? {
                  cell: (row: Row) => {
                    const value = record(row[col.id]);
                    return `${text(value.cantidad)} pzas · ${text(value.linea)} · G${text(value.grupo)} / ${text(value.secuencia)}`;
                  },
                }
              : {}),
          })),
        ]
      : makeColumns(
          tab === "new"
            ? [
                ["part_no", "PARTE", 150],
                ["linea", "LÍNEA", 90],
                ["cantidad", "CANTIDAD", 90],
                ["grupo", "GRUPO", 80],
              ]
            : [
                ["lot_no", "LOTE", 160],
                ["part_no", "PARTE", 150],
                ["linea", "LÍNEA", 90],
                ["cantidad", "CANTIDAD", 90],
                ["status", "ESTADO", 120],
              ],
        );
  return (
    <>
      <Modal
        title={
          tool === "wos"
            ? "Importar Work Orders · ASSY"
            : tool === "scan"
              ? "Lotes SCAN sin asignar"
              : "Propuestas IA · ASSY"
        }
        size="xl"
        className="process-production-dialog"
        onClose={onClose}
      >
        <DialogBody>
          {tool !== "proposals" && (
            <FilterBar
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
                setSelected(new Set());
              }}
              onSubmit={() => {
                const issue = rangeIssue(draft);
                setError(issue);
                if (!issue) {
                  setApplied({ ...draft });
                  setSelected(new Set());
                  if (JSON.stringify(draft) === JSON.stringify(applied))
                    void query.refetch();
                }
              }}
            />
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          {diff ? (
            <>
              <p className="process-production-compact">
                Propuesta {text(diff.proposal_id)} · versión{" "}
                {text(diff.version)} · {text(diff.sin_cambio)} lotes sin cambio.
              </p>
              <TabBar
                id="process-production-diff"
                label="Comparación de propuesta"
                items={[
                  { id: "changes", label: "Cambios" },
                  { id: "new", label: "Lotes nuevos" },
                  { id: "other", label: "Fuera de propuesta" },
                ]}
                activeId={tab}
                onChange={setTab}
              />
              <DataGrid
                key={tab}
                label="Cambios de propuesta ASSY"
                rows={diffRows}
                columns={diffColumns}
                rowKey={(_, index) => index}
                minWidth={tab === "changes" ? 1200 : 700}
                layout="fixed"
              />
            </>
          ) : (
            <DataGrid
              label={
                tool === "scan"
                  ? "Grupos SCAN"
                  : tool === "wos"
                    ? "Work Orders disponibles"
                    : "Propuestas disponibles"
              }
              rows={data}
              columns={columns}
              rowKey={(row) => text(row._id)}
              loading={query.isPending}
              error={query.error}
              onRetry={() => void query.refetch()}
              minWidth={1000}
              layout="fixed"
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
          {diff && (
            <>
              <Button
                onClick={() => {
                  setDiff(null);
                  setSelected(new Set());
                }}
              >
                Volver a propuestas
              </Button>
              <Button
                disabled={!selected.size}
                onClick={() =>
                  setDialog({
                    title: "Aplicar cambios de propuesta",
                    description:
                      "Se aplicarán únicamente los cambios seleccionados. El servidor volverá a comprobar los lotes iniciados y las restricciones de producción.",
                    action: "apply-diff",
                    initial: {
                      proposal_id: diff.proposal_id,
                      cambios: changes
                        .filter(
                          (row) =>
                            selected.has(text(row.lot_no)) && !row.bloqueado,
                        )
                        .map((row) => ({
                          lot_no: row.lot_no,
                          ...record(row.despues),
                        })),
                    },
                    fields: [],
                  })
                }
              >
                Aplicar cambios ({selected.size})
              </Button>
              {rows(diff.nuevos).length > 0 && (
                <Button
                  onClick={() =>
                    setDialog({
                      title: "Insertar lotes de propuesta",
                      description:
                        "Se insertarán los lotes nuevos de la propuesta; los lotes existentes se conservarán.",
                      action: "import-proposal",
                      initial: { proposal_id: diff.proposal_id },
                      fields: [],
                    })
                  }
                >
                  Insertar lotes nuevos ({rows(diff.nuevos).length})
                </Button>
              )}
            </>
          )}
          {tool === "wos" && (
            <Button
              variant="primary"
              disabled={!selected.size || query.isFetching || query.isError}
              onClick={() =>
                setDialog({
                  title: "Importar WO seleccionadas",
                  action: "import-wos",
                  initial: {
                    wo_ids: [...selected].map(Number),
                    import_date: applied.end,
                  },
                  fields: [
                    {
                      key: "import_date",
                      label: "Fecha de importación",
                      type: "date",
                      required: true,
                    },
                  ],
                  description: `Se importarán ${selected.size} WO. Los duplicados y errores parciales se mostrarán en el resultado.`,
                })
              }
            >
              Importar seleccionadas ({selected.size})
            </Button>
          )}
        </DialogFooter>
      </Modal>
      {dialog && (
        <FormDialog
          title={dialog.title}
          description={dialog.description}
          fields={dialog.fields}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSave={async (value) =>
            record(await context.api.extra(dialog.action, value))
          }
          onDone={onDone}
          label="Confirmar"
        />
      )}
    </>
  );
}
