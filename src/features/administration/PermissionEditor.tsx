import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import { useModuleCatalog } from "@/core/modules/ModuleCatalog";
import {
  Alert,
  Button,
  CheckboxField,
  DialogBody,
  DialogFooter,
  EmptyState,
  ErrorState,
  FormActions,
  FormMessages,
  Loading,
  Modal,
  SelectField,
  TextField,
} from "@/shared/ui";
import { administrationKeys as keys, PAGE_NAMES } from "./config";
import {
  assignableSelection,
  normalizeSearch,
  permissionIds,
  toggleSelection,
} from "./model";
import type {
  AdministrationApi,
  AuthorityContext,
  PermissionCatalog,
  RoleRecord,
} from "./types";

interface Props {
  record: RoleRecord;
  context: AuthorityContext;
  api: Pick<
    AdministrationApi,
    "availablePermissions" | "rolePermissions" | "savePermissions"
  >;
  scope: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}
export function PermissionEditor(props: Props) {
  const available = useQuery({
    queryKey: keys.available(props.scope),
    queryFn: ({ signal }) => props.api.availablePermissions(signal),
    staleTime: 0,
  });
  const assigned = useQuery({
    queryKey: keys.assigned(props.scope, props.record.id),
    queryFn: ({ signal }) => props.api.rolePermissions(props.record.id, signal),
    staleTime: 0,
  });
  // Wait for the current role and catalog. A failed/stale load must never become
  // an empty editable selection that could overwrite assignments.
  if (
    available.isFetching ||
    assigned.isFetching ||
    available.isPending ||
    assigned.isPending ||
    available.isError ||
    assigned.isError
  ) {
    return (
      <Modal
        title={`Permisos de ${props.record.nombre}`}
        onClose={props.onClose}
        size="lg"
      >
        <DialogBody>
          {available.error || assigned.error ? (
            <ErrorState
              error={available.error || assigned.error}
              onRetry={() => {
                void available.refetch();
                void assigned.refetch();
              }}
            />
          ) : (
            <Loading text="Cargando permisos del rol…" />
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={props.onClose}>Cerrar</Button>
        </DialogFooter>
      </Modal>
    );
  }
  return (
    <PermissionForm
      {...props}
      available={available.data}
      assigned={assigned.data}
    />
  );
}
function PermissionForm({
  record,
  context,
  api,
  onClose,
  onSaved,
  available,
  assigned,
}: Props & { available: PermissionCatalog; assigned: number[] }) {
  const [search, setSearch] = useState("");
  const catalog = useModuleCatalog();
  const [view, setView] = useState(catalog.length ? "modules" : "all");
  const allIds = useMemo(() => permissionIds(available), [available]);
  const allowed = useMemo(() => new Set(allIds), [allIds]);
  const initial = useMemo(
    () => assignableSelection(assigned, available),
    [assigned, available],
  );
  const form = useForm<number[]>({
    initialValues: initial,
    validate: (values) =>
      values.some((id) => !allowed.has(id))
        ? ["Hay permisos fuera de tu alcance. Actualiza la consulta."]
        : [],
    onSubmit: async (values) => {
      const result = await api.savePermissions(
        record.id,
        assignableSelection(values, available),
      );
      onSaved(result.mensaje);
    },
  });
  const selected = new Set(form.values);
  const outside = useMemo(
    () => new Set(assigned.filter((id) => !allowed.has(id))).size,
    [assigned, allowed],
  );
  const needle = normalizeSearch(search.trim());
  const moduleOptions = catalog
    .filter(
      (module) =>
        !needle ||
        normalizeSearch(
          `${module.title} ${module.section} ${module.group}`,
        ).includes(needle),
    )
    .map((module) => ({
      ...module,
      option: available[module.permission.pagina]?.[
        module.permission.seccion
      ]?.find((option) => option.boton === module.permission.boton),
    }))
    .filter((module) => module.option);
  const visibleIds = moduleOptions.flatMap((module) =>
    module.option ? [module.option.id] : [],
  );
  const pages = Object.keys(available).sort((a, b) => {
    const order = Object.keys(PAGE_NAMES);
    return (
      (order.includes(a) ? order.indexOf(a) : 999) -
        (order.includes(b) ? order.indexOf(b) : 999) || a.localeCompare(b)
    );
  });
  let visible = 0;
  const groups = pages.map((page) => {
    const sections = Object.entries(available[page])
      .map(([name, options]) => ({
        name,
        options: options.filter(
          (option) =>
            !needle ||
            normalizeSearch(
              `${PAGE_NAMES[page] || page} ${name} ${option.boton} ${option.descripcion || ""}`,
            ).includes(needle),
        ),
      }))
      .filter((section) => section.options.length);
    if (!sections.length) return null;
    const groupIds = sections.flatMap((section) =>
      section.options.map((option) => option.id),
    );
    visible += groupIds.length;
    return (
      <details
        className="administration-permission-page"
        key={`${page}:${!!needle}`}
        open={needle ? true : undefined}
      >
        <summary>
          {PAGE_NAMES[page] || page}
          <span>
            {groupIds.filter((id) => selected.has(id)).length}/{groupIds.length}
          </span>
        </summary>
        <div className="administration-permission-section">
          <Button
            size="sm"
            onClick={() =>
              form.setValues(toggleSelection(form.values, groupIds))
            }
          >
            Alternar página
          </Button>
        </div>
        {sections.map((section) => (
          <section
            className="administration-permission-section"
            key={section.name}
          >
            <div className="administration-section-heading">
              <h3>{section.name}</h3>
              <Button
                size="sm"
                onClick={() =>
                  form.setValues(
                    toggleSelection(
                      form.values,
                      section.options.map((option) => option.id),
                    ),
                  )
                }
              >
                Alternar sección
              </Button>
            </div>
            <div className="administration-checks">
              {section.options.map((option) => (
                <CheckboxField
                  key={option.id}
                  label={option.boton}
                  hint={option.descripcion || undefined}
                  checked={selected.has(option.id)}
                  onChange={() =>
                    form.setValues(toggleSelection(form.values, [option.id]))
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </details>
    );
  });
  return (
    <Modal
      className="administration-permissions"
      title={`Permisos de ${record.nombre}`}
      subtitle={`${record.departamento || "Transversal"} · ${selected.size}/${allIds.length} permisos seleccionados`}
      size="lg"
      busy={form.pending}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            {!context.es_superadmin && outside > 0 && (
              <Alert tone="info">
                El rol tiene {outside} permiso(s) de otras áreas. Se conservarán
                al guardar.
              </Alert>
            )}
            <p>
              Los usuarios reciben los módulos de sus roles. Si tienen varios
              roles, se suman sus accesos.
            </p>
            {!!catalog.length && (
              <SelectField
                label="Mostrar permisos"
                value={view}
                options={[
                  { value: "modules", label: "Módulos migrados" },
                  { value: "all", label: "Todos los permisos" },
                ]}
                onChange={(event) => setView(event.target.value)}
              />
            )}
            {allIds.length ? (
              <>
                <div className="administration-toolbar">
                  <TextField
                    type="search"
                    label="Buscar permiso"
                    initialFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Página, sección o permiso…"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      form.setValues(
                        view === "modules"
                          ? [...new Set([...form.values, ...visibleIds])]
                          : [...allIds],
                      )
                    }
                  >
                    {view === "modules" ? "Marcar visibles" : "Marcar todo"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      form.setValues(
                        view === "modules"
                          ? form.values.filter((id) => !visibleIds.includes(id))
                          : [],
                      )
                    }
                  >
                    {view === "modules" ? "Limpiar visibles" : "Limpiar todo"}
                  </Button>
                </div>
                {view === "modules" ? (
                  <div className="administration-module-permissions">
                    {moduleOptions.map((module) => (
                      <CheckboxField
                        key={module.id}
                        label={module.title}
                        hint={`${module.section} · ${module.group}${module.option ? "" : " · No disponible para asignar en tu alcance"}`}
                        disabled={!module.option}
                        checked={
                          !!module.option && selected.has(module.option.id)
                        }
                        onChange={() => {
                          if (module.option)
                            form.setValues(
                              toggleSelection(form.values, [module.option.id]),
                            );
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  groups
                )}
                {!(view === "modules" ? moduleOptions.length : visible) && (
                  <EmptyState
                    title="Sin coincidencias"
                    message="Prueba con otro nombre de página, sección o permiso."
                  />
                )}
              </>
            ) : (
              <EmptyState
                title="Sin permisos disponibles"
                message="No hay permisos asignables dentro de tu alcance."
              />
            )}
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          {allIds.length ? (
            <FormActions
              pending={form.pending}
              onCancel={onClose}
              submitLabel="Guardar permisos"
            />
          ) : (
            <DialogFooter>
              <Button onClick={onClose}>Cerrar</Button>
            </DialogFooter>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
