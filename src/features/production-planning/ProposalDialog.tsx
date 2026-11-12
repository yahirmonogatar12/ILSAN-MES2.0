import { actionPayloads } from "./requests";
import { useState } from "react";
import { ApiError } from "@/core/http";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  TabBar,
  TextareaField,
} from "@/shared/ui";
import { FormDialog, usePlanning } from "./components";
import { makeColumns, proposalCapacity, rows, text, TURNOS } from "./model";
import type {
  PivotFilters,
  Row,
  ScheduleItem,
  ScheduleProposal,
  Spec,
} from "./types";
const proposalSpecs: readonly Spec[] = [
  ["part_no", "PARTE", 155],
  ["sched_date", "FECHA", 110],
  ["linea", "LÍNEA", 80],
  ["turno", "TURNO", 115],
  ["qty", "CANTIDAD", 100],
  ["pack_size", "EMPAQUE", 80],
  ["uph", "UPH", 80],
  ["horas_requeridas", "HORAS", 80],
  ["inventario_antes", "INVENTARIO ANTES", 100],
  ["inventario_despues", "INVENTARIO DESPUÉS", 100],
  ["fecha_shortage", "FECHA FALTANTE", 110],
  ["sched_actual", "SCHEDULE ACTUAL", 100],
  ["excepciones", "EXCEPCIONES", 190],
];
export function ProposalDialog({
  filters,
  onClose,
  onDone,
}: {
  filters: PivotFilters;
  onClose: () => void;
  onDone: (result: Row) => void;
}) {
  const auth = usePlanning(),
    [proposal, setProposal] = useState<ScheduleProposal | null>(null),
    [items, setItems] = useState<(ScheduleItem & { included: boolean })[]>([]),
    [tab, setTab] = useState("items"),
    [editing, setEditing] = useState<number | null>(null),
    [action, setAction] = useState<"apply" | "reject" | null>(null),
    [stale, setStale] = useState(false);
  const form = useForm({
    initialValues: { objective: "", excluded: "" },
    validate: () => [],
    onSubmit: async (values) => {
      const result = await auth.api.action("propose", {
        date_from: filters.date_from,
        date_to: filters.date_to,
        objective: values.objective,
        excluded_parts: values.excluded
          .split(/[\n,]/)
          .map((v) => v.trim())
          .filter(Boolean),
      });
      const proposed = result.proposals;
      setProposal(result);
      setItems(proposed.map((item) => ({ ...item, included: true })));
      setStale(false);
    },
  });
  const selected = items.filter((item) => item.included !== false),
    changes =
      proposal && Array.isArray(proposal.schedule_changes)
        ? rows(proposal.schedule_changes)
        : [],
    omitted =
      proposal && Array.isArray(proposal.omitidas)
        ? rows(proposal.omitidas)
        : [],
    capacity = proposalCapacity(
      items,
      proposal && Array.isArray(proposal.line_summary)
        ? rows(proposal.line_summary)
        : [],
    );
  const otherSpecs = (records: Row[]) =>
    [...new Set(records.flatMap((row) => Object.keys(row)))].map(
      (key) =>
        [
          key,
          (
            {
              accion: "ACCIÓN",
              part_no: "PARTE",
              sched_date: "FECHA",
              antes_qty: "CANTIDAD ANTERIOR",
              despues_qty: "CANTIDAD PROPUESTA",
              antes_linea: "LÍNEA ANTERIOR",
              despues_linea: "LÍNEA PROPUESTA",
              turno: "TURNO",
              motivo: "MOTIVO",
              horas: "HORAS",
              horas_max: "HORAS DISPONIBLES",
              cantidad: "CANTIDAD",
              linea: "LÍNEA",
              fecha: "FECHA",
              lotes: "LOTES",
            } as Record<string, string>
          )[key] ?? key.replaceAll("_", " ").toUpperCase(),
          120,
        ] as Spec,
    );
  const columns =
    tab === "items"
      ? [
          {
            id: "include",
            header: "INCLUIR",
            filterable: false,
            width: "5%",
            cell: (row: Row) => (
              <CheckboxField
                aria-label={`Incluir ${text(row.part_no)} ${text(row.sched_date)}`}
                checked={row.included !== false}
                disabled={stale}
                onChange={(event) =>
                  setItems((previous) =>
                    previous.map((item) =>
                      item === row
                        ? { ...item, included: event.target.checked }
                        : item,
                    ),
                  )
                }
              />
            ),
          },
          ...makeColumns(proposalSpecs).map((col) => ({
            ...col,
            width: `${parseFloat(String(col.width)) * 0.87}%`,
          })),
          {
            id: "edit",
            header: "EDITAR",
            filterable: false,
            width: "8%",
            cell: (row: Row) => (
              <Button
                size="sm"
                disabled={stale}
                onClick={() =>
                  setEditing(
                    items.findIndex((item) => item.item_id === row.item_id),
                  )
                }
              >
                Editar
              </Button>
            ),
          },
        ]
      : makeColumns(
          otherSpecs(
            tab === "changes"
              ? changes
              : tab === "omitted"
                ? omitted
                : capacity,
          ),
        );
  const records =
    tab === "items"
      ? items
      : tab === "changes"
        ? changes
        : tab === "omitted"
          ? omitted
          : capacity;
  const edit = editing !== null ? items[editing] : null;
  async function applyOrReject(values: Row) {
    if (stale)
      throw new Error(
        "Genera una propuesta nueva antes de aplicar o rechazar.",
      );
    try {
      const operation =
        action === "apply" ? "apply-proposal" : "reject-proposal";
      return await auth.api.action(
        operation,
        actionPayloads[operation]({
          proposal_id: proposal?.proposal_id,
          version: proposal?.version,
          ...(action === "apply"
            ? {
                items: items.map((item) => ({
                  item_id: item.item_id,
                  included: item.included !== false,
                  sched_date: item.sched_date,
                  linea: item.linea,
                  turno: item.turno,
                  qty: Number(item.qty),
                })),
              }
            : {
                reason_code: "USER_REJECTED",
                reason_text: text(values.reason).trim(),
              }),
        }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setStale(true);
      throw error;
    }
  }
  return (
    <>
      <Modal
        title="Propuesta de schedule"
        subtitle={
          proposal
            ? `${text(proposal.date_from)} a ${text(proposal.date_to)} · versión ${text(proposal.version)}`
            : "Revisar y editar antes de aplicar"
        }
        onClose={onClose}
        busy={form.pending}
        size={proposal ? "xl" : "lg"}
        className={
          proposal ? "production-planning-dialog" : "production-planning-form"
        }
      >
        {!proposal ? (
          <form onSubmit={form.handleSubmit}>
            <DialogBody>
              <Alert tone="info">
                El cálculo prepara un borrador. El schedule se modifica
                únicamente al aplicar la propuesta.
              </Alert>
              <div className="production-planning-fields">
                <TextareaField
                  label="Objetivo de planificación"
                  value={form.values.objective}
                  onChange={(event) =>
                    form.setField("objective", event.target.value)
                  }
                />
                <TextareaField
                  label="Partes a excluir (una por línea)"
                  value={form.values.excluded}
                  onChange={(event) =>
                    form.setField("excluded", event.target.value)
                  }
                />
              </div>
              <FormMessages errors={form.errors} error={form.error} />
            </DialogBody>
            <DialogFooter>
              <Button disabled={form.pending} onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={form.pending}>
                Calcular propuesta
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogBody>
              {stale ? (
                <Alert tone="danger">
                  La propuesta cambió o quedó desactualizada. Genera una nueva
                  antes de aplicar.
                </Alert>
              ) : (
                <Alert tone="info">
                  {selected.length} de {items.length} capturas incluidas ·{" "}
                  {selected
                    .reduce((sum, item) => sum + Number(item.qty ?? 0), 0)
                    .toLocaleString("es-MX")}{" "}
                  piezas. Revisa también los cambios al schedule y las
                  omisiones.
                </Alert>
              )}
              {!!Number(proposal.requires_approval_count) && (
                <Alert tone="warning">
                  {text(proposal.requires_approval_count)} capturas requieren
                  aprobación de sus excepciones.
                </Alert>
              )}
              <TabBar
                id={`proposal-${text(proposal.proposal_id)}`}
                label="Revisión de propuesta"
                items={[
                  { id: "items", label: `Propuestas (${items.length})` },
                  {
                    id: "changes",
                    label: `Cambios al schedule (${changes.length})`,
                  },
                  {
                    id: "omitted",
                    label: `Omitidas (${text(proposal.omitidas_count ?? omitted.length)})`,
                  },
                  { id: "capacity", label: "Capacidad por línea" },
                ]}
                activeId={tab}
                onChange={setTab}
              />
              <DataGrid
                key={tab}
                label="Revisión de propuesta"
                rows={records}
                columns={columns}
                rowKey={(row, index) =>
                  `${text(row.item_id ?? row.part_no)}:${index}`
                }
                minWidth={tab === "items" ? 1350 : 950}
                layout="fixed"
              />
            </DialogBody>
            <DialogFooter>
              <Button onClick={onClose}>Cerrar sin aplicar</Button>
              <Button
                onClick={() => {
                  setProposal(null);
                  setItems([]);
                  setStale(false);
                }}
              >
                Nueva propuesta
              </Button>
              <Button disabled={stale} onClick={() => setAction("reject")}>
                Rechazar propuesta
              </Button>
              <Button
                variant="success"
                disabled={stale || !selected.length}
                onClick={() => setAction("apply")}
              >
                Aplicar propuesta ({selected.length})
              </Button>
            </DialogFooter>
          </>
        )}
      </Modal>
      {edit && editing !== null && (
        <FormDialog
          title={`Editar propuesta · ${text(edit.part_no)}`}
          fields={[
            { key: "sched_date", label: "Fecha", type: "date", required: true },
            { key: "linea", label: "Línea", required: true },
            {
              key: "turno",
              label: "Turno",
              type: "select",
              options: TURNOS.map((value) => ({ value, label: value })),
            },
            {
              key: "qty",
              label: "Cantidad",
              type: "number",
              required: true,
              min: Number(edit.pack_size) || 1,
              step: 1,
            },
          ]}
          initial={edit}
          validate={(values) =>
            Number(values.qty) % (Number(edit.pack_size) || 1) !== 0
              ? ["La cantidad debe ser múltiplo del empaque."]
              : []
          }
          onSubmit={async (values) => values}
          onDone={(values) => {
            setItems((previous) =>
              previous.map((item, index) =>
                index === editing
                  ? {
                      ...item,
                      ...values,
                      linea: text(values.linea).trim().toUpperCase(),
                      horas_requeridas:
                        Number(values.qty) / Number(item.uph || 1),
                      inventario_despues:
                        Number(item.inventario_antes || 0) + Number(values.qty),
                    }
                  : item,
              ),
            );
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {action && (
        <FormDialog
          title={
            action === "apply"
              ? "Aplicar propuesta de schedule"
              : "Rechazar propuesta"
          }
          description={
            action === "apply"
              ? "Se aplicarán las capturas seleccionadas y los cambios revisados al schedule, incluidas las eliminaciones previstas en el alcance de la propuesta."
              : "El motivo quedará registrado junto con la propuesta."
          }
          fields={
            action === "reject"
              ? [
                  {
                    key: "reason",
                    label: "Motivo de rechazo",
                    type: "textarea",
                    required: true,
                  },
                ]
              : []
          }
          initial={{ reason: "" }}
          label={
            action === "apply" ? "Confirmar aplicación" : "Confirmar rechazo"
          }
          onSubmit={applyOrReject}
          onDone={onDone}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
