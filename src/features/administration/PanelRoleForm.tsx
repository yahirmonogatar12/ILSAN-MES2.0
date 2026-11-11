import { useForm } from "@/shared/hooks/useForm";
import {
  DialogBody,
  FormActions,
  FormMessages,
  Modal,
  SelectField,
  TextField,
  TextareaField,
} from "@/shared/ui";
import { normalizeSearch } from "./model";
import type { RoleRecord } from "./types";
import type { Department, PanelApi, PanelRolePayload } from "./panelTypes";

/** The central role endpoint supports levels. Department delegates use RoleForm instead. */
export function PanelRoleForm({
  record,
  roles,
  departments,
  api,
  onClose,
  onSaved,
}: {
  record: RoleRecord | null;
  roles: RoleRecord[];
  departments: Department[];
  api: PanelApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const system = !!record && record.nivel >= 8;
  const form = useForm<PanelRolePayload>({
    initialValues: {
      nombre: record?.nombre || "",
      descripcion: record?.descripcion || "",
      departamento: record?.departamento || "",
      nivel: record?.nivel ?? 1,
      rol_id: record?.id,
    },
    validate: (values) => {
      const issues: string[] = [];
      if (!values.nombre.trim()) issues.push("Escribe el nombre del rol.");
      if (!record && !values.descripcion.trim())
        issues.push("Escribe la descripción del rol.");
      if (
        roles.some(
          (role) =>
            role.id !== record?.id &&
            normalizeSearch(role.nombre) ===
              normalizeSearch(values.nombre.trim()),
        )
      )
        issues.push("Ya existe otro rol con ese nombre.");
      if (
        !Number.isInteger(values.nivel) ||
        values.nivel < 1 ||
        values.nivel > (system ? record.nivel : 7)
      )
        issues.push("Selecciona un nivel válido.");
      return issues;
    },
    onSubmit: async (values) => {
      await api.savePanelRole({
        ...values,
        nombre: values.nombre.trim(),
        descripcion: values.descripcion.trim(),
      });
      onSaved();
    },
  });
  return (
    <Modal
      className="administration-form"
      title={record ? "Editar rol" : "Nuevo rol"}
      busy={form.pending}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            <div className="administration-fields">
              <TextField
                label="Nombre del rol"
                required
                readOnly={system}
                initialFocus
                value={form.values.nombre}
                onChange={(event) =>
                  form.setField("nombre", event.target.value)
                }
              />
              <TextareaField
                label="Descripción"
                required={!record}
                rows={3}
                value={form.values.descripcion}
                onChange={(event) =>
                  form.setField("descripcion", event.target.value)
                }
              />
              <SelectField
                label="Nivel"
                disabled={system}
                value={String(form.values.nivel)}
                options={Array.from(
                  { length: system ? 10 : 7 },
                  (_, index) => ({
                    value: String(index + 1),
                    label: String(index + 1),
                  }),
                )}
                onChange={(event) =>
                  form.setField("nivel", Number(event.target.value))
                }
              />
              <SelectField
                label="Departamento"
                disabled={system}
                value={form.values.departamento}
                options={[
                  { value: "", label: "Transversal" },
                  ...[
                    ...new Set([
                      ...departments
                        .filter((row) => row.activo)
                        .map((row) => row.nombre),
                      ...(record?.departamento ? [record.departamento] : []),
                    ]),
                  ].map((value) => ({ value, label: value })),
                ]}
                onChange={(event) =>
                  form.setField("departamento", event.target.value)
                }
              />
            </div>
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <FormActions pending={form.pending} onCancel={onClose} />
        </fieldset>
      </form>
    </Modal>
  );
}
