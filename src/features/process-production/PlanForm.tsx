import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  ConfirmDialog,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  TextField,
} from "@/shared/ui";
import { Fields } from "./components";
import { useProcess } from "./useProcess";
import {
  bottomOptions,
  daysBefore,
  defaults,
  fieldIssues,
  planFields,
  planPayload,
  text,
  today,
  validDate,
  withBottomParent,
} from "./model";
/** Días hacia atrás en que se buscan BOTTOM al abrir un TOP; el usuario puede ampliar. */
const BOTTOM_DAYS = 14;
import type { Kind, Row } from "./types";
export function PlanForm({
  kind,
  initial,
  editing,
  plans = [],
  onClose,
  onDone,
  reloadSubAssy,
}: {
  kind: Kind;
  initial: Row;
  editing: boolean;
  /** Planes cargados: de ahí salen los BOTTOM que puede elegir un TOP. */
  plans?: readonly Row[];
  onClose: () => void;
  onDone: (result: Row) => void;
  reloadSubAssy?: () => Promise<string | null>;
}) {
  const context = useProcess();
  const [subAssyReloaded, setSubAssyReloaded] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const reactivating = initial.status === "CANCELADO";
  const statusLabel = reactivating ? "Reactivar plan" : "Cancelar plan";
  const smtTop = (values: Row) => kind === "SMT" && text(values.lado) === "TOP";
  const form: ReturnType<typeof useForm<Row>> = useForm<Row>({
    initialValues:
      kind === "SMT"
        ? {
            ...withBottomParent(plans, initial),
            bottom_desde: daysBefore(text(initial.working_date), BOTTOM_DAYS),
          }
        : initial,
    validate: (value): string[] => [
      ...(smtTop(value) && !text(value.lote_padre).trim()
        ? ["Elige el lote BOTTOM del que es TOP."]
        : []),
      ...(subAssyForm.pending
        ? ["Espera a que termine la consulta de sub-assy."]
        : []),
      ...(statusForm.pending || confirmingStatus
        ? ["Termina la actualización del estado antes de guardar el plan."]
        : []),
      ...fieldIssues(planFields(kind, editing), value),
      ...(revisions.isError &&
      text(value.part_no).trim() === text(initial.part_no).trim() &&
      value.assigned_bom_rev !== initial.assigned_bom_rev
        ? ["Carga el catálogo BOM antes de cambiar la revisión."]
        : []),
    ],
    onSubmit: async (value) =>
      onDone(
        await context.api.action(
          kind,
          editing ? "update" : "create",
          planPayload(kind, value, editing),
        ),
      ),
  });
  const subAssyForm = useForm({
    initialValues: {},
    validate: () =>
      form.pending ? ["Espera a que termine el guardado del plan."] : [],
    onSubmit: async () => {
      if (!reloadSubAssy) return;
      const value = await reloadSubAssy();
      form.setField("sub_assy", value);
      setSubAssyReloaded(true);
    },
  });
  const statusForm = useForm({
    initialValues: {},
    validate: () =>
      form.pending || subAssyForm.pending
        ? ["Espera a que termine la operación actual del plan."]
        : [],
    onSubmit: async () =>
      onDone(
        await context.api.action(kind, "update", {
          lot_no: text(initial.lot_no),
          status: reactivating ? "PLAN" : "CANCELADO",
        }),
      ),
  });
  const busy =
    form.pending ||
    subAssyForm.pending ||
    statusForm.pending ||
    confirmingStatus;
  const part = text(form.values.part_no).trim();
  const initialPart = text(initial.part_no).trim();
  const revisions = useQuery({
    queryKey: context.key("revisions", part),
    queryFn: ({ signal }) => context.api.revisions(part, signal),
    enabled: editing && kind !== "SMT" && !!part,
  });
  // El BOTTOM pudo producirse otro día: se buscan desde la fecha elegida hasta
  // la del TOP (u hoy), además de los planes ya cargados.
  const top = smtTop(form.values);
  const bottomFrom = text(form.values.bottom_desde);
  const workDate = text(form.values.working_date);
  const bottomTo = workDate > today() ? workDate : today();
  const bottoms = useQuery({
    queryKey: context.key("bottoms", bottomFrom, bottomTo),
    queryFn: ({ signal }) =>
      context.api.plans(
        "SMT",
        { ...defaults(), start: bottomFrom, end: bottomTo },
        signal,
      ),
    enabled: top && validDate(bottomFrom) && bottomFrom <= bottomTo,
  });
  const candidates = useMemo(
    () => [...plans, ...(bottoms.data ?? [])],
    [plans, bottoms.data],
  );
  const { setValues } = form;
  useEffect(() => {
    setValues((previous) => withBottomParent(candidates, previous));
  }, [candidates, setValues]);
  const fields = useMemo(() => {
    const fields = planFields(kind, editing).map((field) =>
      field.options &&
      !field.options.some(
        (option) => option.value === text(form.values[field.key]),
      ) &&
      form.values[field.key]
        ? {
            ...field,
            options: [
              ...field.options,
              {
                value: text(form.values[field.key]),
                label: text(form.values[field.key]),
              },
            ],
          }
        : field,
    );
    if (editing && kind !== "SMT") {
      const options = [
        { value: "", label: "Automático · revisión vigente" },
        ...(revisions.data ?? []).map((row) => ({
          value: text(row.bom_rev),
          label: `Rev. ${text(row.bom_rev)}${row.is_current ? " · vigente" : ""}${row.eco_no ? ` · ECO ${text(row.eco_no)}` : ""}`,
        })),
      ];
      const current = text(form.values.assigned_bom_rev);
      if (current && !options.some((option) => option.value === current))
        options.push({ value: current, label: `Rev. ${current} · actual` });
      fields.push({
        key: "assigned_bom_rev",
        label: "Revisión BOM asignada",
        type: "select",
        options,
        readOnly: part !== initialPart,
      });
    }
    if (kind === "SMT" && text(form.values.lado) === "TOP") {
      const options = bottomOptions(candidates, form.values);
      fields.push(
        { key: "bottom_desde", label: "Buscar BOTTOM desde", type: "date" },
        {
          key: "lote_padre",
          label: "Lote BOTTOM (padre)",
          type: "select",
          required: true,
          options: [
            {
              value: "",
              label: options.length
                ? "Elige el BOTTOM"
                : bottoms.isFetching
                  ? "Buscando BOTTOM…"
                  : "Sin BOTTOM",
            },
            ...options,
          ],
        },
      );
    }
    return fields;
  }, [
    kind,
    editing,
    revisions.data,
    form.values,
    initialPart,
    part,
    candidates,
    bottoms.isFetching,
  ]);
  const noBottom =
    top &&
    !bottoms.isFetching &&
    bottomOptions(candidates, form.values).length === 0;
  return (
    <>
      <Modal
        title={`${editing ? "Editar" : "Nuevo"} plan ${kind}${editing ? ` · ${text(initial.lot_no)}` : ""}`}
        size="lg"
        className="process-production-form"
        busy={busy}
        closeOnBackdrop={false}
        onClose={onClose}
      >
        <form onSubmit={form.handleSubmit}>
          <DialogBody>
            {editing && kind === "ASSY" && (
              <div className="process-production-sub-assy">
                <TextField
                  label="Sub-assy / PCB"
                  value={text(form.values.sub_assy)}
                  placeholder="Sin sub-assy / PCB"
                  readOnly
                />
                <Button
                  size="sm"
                  icon={<RefreshCw size={14} />}
                  disabled={busy || !reloadSubAssy}
                  loading={subAssyForm.pending}
                  loadingLabel="Consultando RAW…"
                  onClick={() => void subAssyForm.submit()}
                >
                  Recargar sub-assy
                </Button>
              </div>
            )}
            {subAssyReloaded && !subAssyForm.pending && !subAssyForm.error && (
              <Alert
                tone={text(form.values.sub_assy).trim() ? "info" : "warning"}
              >
                {text(form.values.sub_assy).trim()
                  ? "Sub-assy actualizado desde RAW."
                  : "RAW todavía no tiene un sub-assy / PCB configurado para esta parte."}
              </Alert>
            )}
            <FormMessages
              errors={subAssyForm.errors}
              error={subAssyForm.error}
            />
            <Fields
              fields={fields}
              values={form.values}
              pending={busy}
              change={(key, value) => {
                if (key === "part_no" && editing && kind === "IMT")
                  form.setValues((previous) => ({
                    ...previous,
                    part_no: value,
                    assigned_bom_rev: "",
                  }));
                else if (kind === "SMT")
                  form.setValues((previous) =>
                    withBottomParent(candidates, { ...previous, [key]: value }),
                  );
                else form.setField(key, value);
              }}
            />
            {revisions.isError && editing && kind !== "SMT" && (
              <Alert tone="warning">
                No se pudo consultar el catálogo BOM. Se conserva la revisión
                actual.{" "}
                <Button size="sm" onClick={() => void revisions.refetch()}>
                  Reintentar BOM
                </Button>
              </Alert>
            )}
            {kind === "SMT" && form.values.lado === "BOTTOM" && !editing && (
              <Alert>
                BOTTOM creará también su TOP ligado, con cero QR y el mismo
                array/cantidad.
              </Alert>
            )}
            {top && bottoms.isError && (
              <Alert tone="warning">
                No se pudieron buscar los BOTTOM.{" "}
                <Button size="sm" onClick={() => void bottoms.refetch()}>
                  Reintentar
                </Button>
              </Alert>
            )}
            {noBottom && !bottoms.isError && (
              <Alert tone="warning">
                No hay un plan BOTTOM de {part || "esta parte"} desde el{" "}
                {bottomFrom.split("-").reverse().join("/")}. Elige una fecha
                anterior en “Buscar BOTTOM desde” o marca primero su BOTTOM.
              </Alert>
            )}
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <DialogFooter>
            {editing && (
              <Button
                className="process-production-plan-status"
                variant={reactivating ? "success" : "danger"}
                disabled={busy}
                onClick={() => setConfirmingStatus(true)}
              >
                {statusLabel}
              </Button>
            )}
            <Button disabled={busy} onClick={onClose}>
              {editing ? "Cerrar" : "Cancelar"}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={form.pending}
              disabled={busy}
            >
              Guardar plan
            </Button>
          </DialogFooter>
        </form>
      </Modal>
      {confirmingStatus && (
        <ConfirmDialog
          title={statusLabel}
          confirmLabel={statusLabel}
          pendingLabel="Actualizando estado…"
          confirmVariant={reactivating ? "success" : "danger"}
          pending={statusForm.pending}
          error={statusForm.error}
          onConfirm={() => void statusForm.submit()}
          onClose={() => setConfirmingStatus(false)}
        >
          <p>
            Plan <strong>{text(initial.lot_no)}</strong>
          </p>
          <p>
            {reactivating
              ? "El plan volverá al estado PLAN."
              : "El plan quedará cancelado y conservará su historial."}{" "}
            Los cambios sin guardar del formulario se descartarán.
          </p>
          <FormMessages errors={statusForm.errors} />
        </ConfirmDialog>
      )}
    </>
  );
}
