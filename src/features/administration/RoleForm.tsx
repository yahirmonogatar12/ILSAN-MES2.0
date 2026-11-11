import { useForm } from "@/shared/hooks/useForm";
import {
  DialogBody,
  FormActions,
  FormMessages,
  Modal,
  TextField,
  TextareaField,
} from "@/shared/ui";
import { rolePayload, validateRole } from "./model";
import type {
  AdministrationApi,
  AuthorityContext,
  RoleDraft,
  RoleRecord,
} from "./types";

export function RoleForm({
  record,
  context,
  roles,
  api,
  onClose,
  onSaved,
}: {
  record: RoleRecord | null;
  context: AuthorityContext;
  roles: RoleRecord[];
  api: AdministrationApi;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const form = useForm<RoleDraft>({
    initialValues: {
      nombre: record?.nombre || "",
      descripcion: record?.descripcion || "",
      departamento: context.es_superadmin
        ? record?.departamento || ""
        : context.departamento || "",
    },
    validate: (values) => validateRole(values, record, context, roles),
    onSubmit: async (values) => {
      const result = await api.saveRole(rolePayload(values, record, context));
      onSaved(result.mensaje);
    },
  });
  return (
    <Modal
      className="administration-form"
      title={record ? "Editar rol" : "Nuevo rol"}
      onClose={onClose}
      busy={form.pending}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            <div className="administration-fields">
              <TextField
                label="Nombre del rol"
                required
                initialFocus
                value={form.values.nombre}
                onChange={(event) =>
                  form.setField("nombre", event.target.value)
                }
              />
              <TextareaField
                label="Descripción"
                rows={3}
                value={form.values.descripcion}
                onChange={(event) =>
                  form.setField("descripcion", event.target.value)
                }
              />
              <TextField
                label="Departamento"
                readOnly={!context.es_superadmin}
                hint={
                  context.es_superadmin
                    ? "Vacío para un rol transversal."
                    : "Los roles se administran dentro de tu departamento."
                }
                suggestions={
                  context.es_superadmin
                    ? [
                        ...new Set(
                          roles.flatMap((role) =>
                            role.departamento ? [role.departamento] : [],
                          ),
                        ),
                      ]
                    : undefined
                }
                value={form.values.departamento}
                onChange={(event) =>
                  form.setField("departamento", event.target.value)
                }
              />
            </div>
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <FormActions
            pending={form.pending}
            onCancel={onClose}
            submitLabel={record ? "Guardar cambios" : "Crear rol"}
          />
        </fieldset>
      </form>
    </Modal>
  );
}
