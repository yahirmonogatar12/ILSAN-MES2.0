import { useForm } from "@/shared/hooks/useForm";
import {
  CheckboxField,
  DialogBody,
  FormActions,
  FormMessages,
  FormSection,
  Modal,
  SelectField,
  TextField,
} from "@/shared/ui";
import { userDraft, userPayload, validateUser } from "./model";
import type { AdministrationApi, UserContext, UserRecord } from "./types";

export function UserForm({
  record,
  context,
  users,
  api,
  onClose,
  onSaved,
}: {
  record: UserRecord | null;
  context: UserContext;
  users: UserRecord[];
  api: Pick<AdministrationApi, "saveUser">;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const form = useForm({
    initialValues: userDraft(record, context),
    validate: (values) => validateUser(values, record, context, users),
    onSubmit: async (values) => {
      const result = await api.saveUser(userPayload(values, context));
      onSaved(result.mensaje);
    },
  });
  const values = form.values;
  const departments = [
    ...new Set([
      ...context.departamentos,
      ...(values.departamento ? [values.departamento] : []),
    ]),
  ];
  return (
    <Modal
      className="administration-form"
      title={record ? "Editar usuario" : "Nuevo usuario"}
      size="lg"
      onClose={onClose}
      busy={form.pending}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            <FormSection title="Datos del usuario">
              <div className="form-grid">
                <TextField
                  label="Usuario"
                  autoComplete="off"
                  required
                  initialFocus={!record}
                  readOnly={!!record}
                  value={values.username}
                  onChange={(event) =>
                    form.setField("username", event.target.value)
                  }
                />
                <TextField
                  label="Nombre completo"
                  autoComplete="off"
                  required
                  initialFocus={!!record}
                  value={values.nombre_completo}
                  onChange={(event) =>
                    form.setField("nombre_completo", event.target.value)
                  }
                />
                <TextField
                  label="Correo electrónico"
                  type="email"
                  autoComplete="off"
                  value={values.email}
                  onChange={(event) =>
                    form.setField("email", event.target.value)
                  }
                />
                <TextField
                  label="Contraseña"
                  type="password"
                  autoComplete="new-password"
                  required={!record}
                  hint={
                    record
                      ? "Déjala vacía para conservar la contraseña actual."
                      : "Requerida para crear el usuario."
                  }
                  value={values.password}
                  onChange={(event) =>
                    form.setField("password", event.target.value)
                  }
                />
                <SelectField
                  label="Departamento"
                  disabled={!context.es_superadmin}
                  value={values.departamento}
                  options={[
                    { value: "", label: "Sin departamento" },
                    ...departments.map((value) => ({ value, label: value })),
                  ]}
                  onChange={(event) =>
                    form.setField("departamento", event.target.value)
                  }
                />
                <TextField
                  label="Cargo"
                  suggestions={context.cargos}
                  value={values.cargo}
                  onChange={(event) =>
                    form.setField("cargo", event.target.value)
                  }
                />
              </div>
              <CheckboxField
                label="Usuario activo"
                checked={!!values.activo}
                onChange={(event) =>
                  form.setField("activo", event.target.checked ? 1 : 0)
                }
              />
            </FormSection>
            <FormSection title="Roles asignados">
              {context.roles.length ? (
                <div className="administration-checks">
                  {context.roles.map((role) => (
                    <CheckboxField
                      key={role}
                      label={role}
                      checked={values.roles.includes(role)}
                      onChange={(event) =>
                        form.setField(
                          "roles",
                          event.target.checked
                            ? [...values.roles, role]
                            : values.roles.filter((value) => value !== role),
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <p>No hay roles asignables en tu alcance.</p>
              )}
            </FormSection>
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <FormActions
            pending={form.pending}
            onCancel={onClose}
            submitLabel={record ? "Guardar cambios" : "Crear usuario"}
          />
        </fieldset>
      </form>
    </Modal>
  );
}
