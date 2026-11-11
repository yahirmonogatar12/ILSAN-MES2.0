import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
} from "@/shared/ui";
import { Fields, useProcess } from "./components";
import { fieldIssues, planFields, planPayload, text } from "./model";
import type { Kind, Row } from "./types";
export function PlanForm({
  kind,
  initial,
  editing,
  onClose,
  onDone,
}: {
  kind: Kind;
  initial: Row;
  editing: boolean;
  onClose: () => void;
  onDone: (result: Row) => void;
}) {
  const context = useProcess();
  const form: ReturnType<typeof useForm<Row>> = useForm<Row>({
    initialValues: initial,
    validate: (value): string[] => [
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
  const part = text(form.values.part_no).trim();
  const revisions = useQuery({
    queryKey: context.key("revisions", part),
    queryFn: ({ signal }) => context.api.revisions(part, signal),
    enabled: editing && kind !== "SMT" && !!part,
  });
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
        readOnly: part !== text(initial.part_no).trim(),
      });
    }
    return fields;
  }, [kind, editing, revisions.data, form.values]);
  return (
    <Modal
      title={`${editing ? "Editar" : "Nuevo"} plan ${kind}${editing ? ` · ${text(initial.lot_no)}` : ""}`}
      size="lg"
      className="process-production-form"
      busy={form.pending}
      closeOnBackdrop={false}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          <Fields
            fields={fields}
            values={form.values}
            pending={form.pending}
            change={(key, value) => {
              if (key === "part_no" && editing && kind === "IMT")
                form.setValues((previous) => ({
                  ...previous,
                  part_no: value,
                  assigned_bom_rev: "",
                }));
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
          {kind === "SMT" && form.values.lado === "TOP" && !editing && (
            <Alert>
              Un TOP manual no establece un vínculo con un BOTTOM. Para generar
              la pareja ligada, crea un BOTTOM.
            </Alert>
          )}
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <DialogFooter>
          <Button disabled={form.pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={form.pending}>
            Guardar plan
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
