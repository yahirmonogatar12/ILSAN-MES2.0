import { useForm } from "@/shared/hooks/useForm";
import {
  DialogBody,
  FormActions,
  FormMessages,
  Modal,
  TextField,
} from "@/shared/ui";
import { cleanDraft, editableColumn, validateDraft } from "./model";
import type { CatalogApi, CatalogKind, ModelRow } from "./types";
export function CatalogForm({
  kind,
  record,
  columns,
  api,
  actor,
  onClose,
  onSaved,
}: {
  kind: CatalogKind;
  record: ModelRow | null;
  columns: string[];
  api: CatalogApi;
  actor: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fields = columns.filter(editableColumn);
  const form = useForm<ModelRow>({
    initialValues: Object.fromEntries(
      fields.map((column) => [column, record?.[column] ?? ""]),
    ),
    validate: (values) => {
      const errors = validateDraft(values, columns, kind);
      if (record) {
        const next = cleanDraft(values, columns, kind);
        const previous = cleanDraft(record, columns, kind);
        if (
          !Object.keys(next).some(
            (key) => String(next[key] ?? "") !== String(previous[key] ?? ""),
          )
        )
          errors.push("No hay cambios para guardar.");
      }
      return errors;
    },
    onSubmit: async (values) => {
      await api.save(values, record, columns, actor);
      onSaved();
    },
  });
  return (
    <Modal
      title={record ? "Editar modelo" : "Registrar modelo"}
      size="lg"
      className="model-catalog-form"
      busy={form.pending}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            <div className="form-grid">
              {fields.map((column, index) => (
                <TextField
                  key={column}
                  label={column}
                  initialFocus={index === 0}
                  value={String(form.values[column] ?? "")}
                  onChange={(event) =>
                    form.setField(column, event.target.value)
                  }
                />
              ))}
            </div>
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <FormActions
            pending={form.pending}
            onCancel={onClose}
            submitLabel={record ? "Guardar cambios" : "Registrar modelo"}
          />
        </fieldset>
      </form>
    </Modal>
  );
}
export function FamilyLines({
  api,
  onClose,
  onSaved,
}: {
  api: CatalogApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm({
    initialValues: { familia: "", lineas: "" },
    validate: (values) => {
      const errors = /^[A-Z0-9-]{4,30}$/.test(
        values.familia.trim().toUpperCase(),
      )
        ? []
        : ["La familia debe tener entre 4 y 30 letras, números o guiones."];
      if (
        values.lineas
          .split(",")
          .some(
            (line) => line.trim() && !/^[A-Z0-9-]{1,10}$/i.test(line.trim()),
          )
      )
        errors.push(
          "Las líneas deben separarse por comas, con hasta 10 caracteres cada una.",
        );
      return errors;
    },
    onSubmit: async (values) => {
      await api.familyLines(
        values.familia.trim().toUpperCase(),
        [
          ...new Set(
            values.lineas
              .split(",")
              .map((value) => value.trim().toUpperCase())
              .filter(Boolean),
          ),
        ].join(","),
      );
      onSaved();
    },
  });
  return (
    <Modal title="Líneas por familia" onClose={onClose} busy={form.pending}>
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            <div className="model-catalog-fields">
              <TextField
                label="Familia"
                required
                initialFocus
                placeholder="EBR807574"
                value={form.values.familia}
                onChange={(event) =>
                  form.setField("familia", event.target.value)
                }
              />
              <TextField
                label="Líneas permitidas"
                hint="Separadas por comas. Vacío permite cualquier línea para toda la familia."
                placeholder="ASSY-A,ASSY-B"
                value={form.values.lineas}
                onChange={(event) =>
                  form.setField("lineas", event.target.value)
                }
              />
            </div>
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <FormActions
            pending={form.pending}
            onCancel={onClose}
            submitLabel="Aplicar a la familia"
          />
        </fieldset>
      </form>
    </Modal>
  );
}
