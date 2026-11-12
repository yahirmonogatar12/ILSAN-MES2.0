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
  type FilterField,
} from "@/shared/ui";
import { FormDialog, makeColumns, useProcess } from "./components";
import { rangeIssue, text } from "./model";
import type { Filters, Kind, Row } from "./types";
export function Reschedule({
  kind,
  initial,
  onClose,
  onDone,
}: {
  kind: Kind;
  initial: Filters;
  onClose: () => void;
  onDone: (value: Row) => void;
}) {
  const context = useProcess(),
    [draft, setDraft] = useState(initial),
    [applied, setApplied] = useState(initial),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [confirm, setConfirm] = useState(false);
  const query = useQuery({
    queryKey: context.key("pending", kind, applied.start, applied.end),
    queryFn: ({ signal }) => context.api.pending(kind, applied, signal),
  });
  const fields: FilterField<Filters>[] = [
    { key: "start", label: "Desde", type: "date" },
    { key: "end", label: "Hasta", type: "date" },
  ];
  const data = useMemo(
    () =>
      (query.data ?? [])
        .filter((row) => row.status !== "CANCELADO")
        .map((row): Row => ({
          ...row,
          produced_count: row.produced_count ?? row.produced ?? row.input ?? 0,
          pendiente: Math.max(
            0,
            Number(row.plan_count ?? 0) -
              Number(row.produced_count ?? row.produced ?? row.input ?? 0),
          ),
        }))
        .filter((row) => Number(row.pendiente) > 0),
    [query.data],
  );
  const columns = [
    {
      id: "select",
      header: "INCLUIR",
      width: "5%",
      filterable: false,
      cell: (row: Row) => (
        <CheckboxField
          aria-label={`Reprogramar ${text(row.lot_no)}`}
          disabled={query.isFetching}
          checked={selected.has(text(row.lot_no))}
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
      ["line", "LÍNEA", 70],
      ["working_date", "FECHA", 90],
      ["plan_count", "PLAN", 70],
      ["produced_count", "INPUT", 70],
      ["pendiente", "PENDIENTE", 80],
      ["status", "ESTADO", 95],
    ]).map((col) => ({
      ...col,
      width: `${parseFloat(String(col.width)) * 0.95}%`,
    })),
  ];
  return (
    <>
      <Modal
        title={`Reprogramar pendientes ${kind}`}
        className="process-production-dialog"
        size="xl"
        onClose={onClose}
      >
        <DialogBody>
          <FilterBar
            fields={fields}
            values={draft}
            defaults={initial}
            onChange={(patch) =>
              setDraft((previous) => ({ ...previous, ...patch }))
            }
            pending={query.isFetching}
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
                if (draft.start === applied.start && draft.end === applied.end)
                  void query.refetch();
              }
            }}
          />
          {error && <Alert tone="warning">{error}</Alert>}
          <DataGrid
            label={`Lotes pendientes ${kind}`}
            rows={data}
            columns={columns}
            rowKey={(row) => text(row.lot_no)}
            loading={query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
            minWidth={850}
            layout="fixed"
          />
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
          <Button
            disabled={query.isFetching || query.isError || !data.length}
            onClick={() =>
              setSelected(
                selected.size
                  ? new Set()
                  : new Set(data.map((row) => text(row.lot_no))),
              )
            }
          >
            {selected.size ? "Limpiar selección" : "Seleccionar pendientes"}
          </Button>
          <Button
            variant="primary"
            disabled={!selected.size || query.isFetching || query.isError}
            onClick={() => setConfirm(true)}
          >
            Reprogramar ({selected.size})
          </Button>
        </DialogFooter>
      </Modal>
      {confirm && (
        <FormDialog
          title="Confirmar reprogramación"
          description="Se crearán sublotes con la cantidad pendiente y se conservará la trazabilidad del lote original."
          fields={[
            {
              key: "new_working_date",
              label: "Nueva fecha de operación",
              type: "date",
              required: true,
            },
          ]}
          initial={{ new_working_date: initial.end, lot_nos: [...selected] }}
          onClose={() => setConfirm(false)}
          onDone={onDone}
          label="Confirmar reprogramación"
          onSave={(value) =>
            context.api.action(kind, "reschedule", {
              ...value,
              lot_nos: [...selected],
              new_working_date: text(value.new_working_date),
            })
          }
        />
      )}
    </>
  );
}
