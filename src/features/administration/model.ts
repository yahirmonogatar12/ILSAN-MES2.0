import type {
  AuthorityContext,
  PermissionCatalog,
  RoleDraft,
  RolePayload,
  RoleRecord,
  UserContext,
  UserDraft,
  UserPayload,
  UserRecord,
} from "./types";

import { normalizeSearch } from "@/shared/lib/text";
export { normalizeSearch };
export const canManage = (superadmin: boolean, department: string | null) =>
  superadmin || !!department;
export function userEditIssue(
  user: UserRecord,
  context: UserContext,
): string | undefined {
  if (user.username === "admin")
    return "El usuario administrador está protegido.";
  if (
    !context.es_superadmin &&
    user.departamento !== context.departamento_propio
  )
    return "El usuario está fuera de tu departamento.";
  if (user.roles.some((role) => !context.roles.includes(role)))
    return "Este usuario tiene roles fuera de tu alcance. Debe editarlo un administrador con acceso a esos roles.";
}
export function userDraft(
  user: UserRecord | null,
  context: UserContext,
): UserDraft {
  return {
    username: user?.username || "",
    nombre_completo: user?.nombre_completo || "",
    email: user?.email || "",
    password: "",
    cargo: user?.cargo || "",
    activo: user?.activo ? 1 : user ? 0 : 1,
    departamento: context.es_superadmin
      ? user?.departamento || ""
      : context.departamento_propio || "",
    roles: [...(user?.roles || [])],
  };
}
export function validateUser(
  draft: UserDraft,
  record: UserRecord | null,
  context: UserContext,
  users: UserRecord[],
): string[] {
  const errors: string[] = [];
  if (!draft.username.trim()) errors.push("Escribe el usuario.");
  if (!draft.nombre_completo.trim()) errors.push("Escribe el nombre completo.");
  if (!record && !draft.password.trim())
    errors.push("La contraseña es requerida para nuevos usuarios.");
  if (draft.username.trim() === "admin")
    errors.push("El usuario administrador está protegido.");
  if (record && draft.username !== record.username)
    errors.push("No se puede cambiar el identificador del usuario.");
  if (
    !record &&
    users.some(
      (user) =>
        normalizeSearch(user.username) ===
        normalizeSearch(draft.username.trim()),
    )
  )
    errors.push("El usuario ya existe. Edítalo desde la tabla.");
  if (!canManage(context.es_superadmin, context.departamento_propio))
    errors.push("Tu usuario no tiene departamento asignado.");
  if (record) {
    const issue = userEditIssue(record, context);
    if (issue) errors.push(issue);
  }
  if (draft.roles.some((role) => !context.roles.includes(role)))
    errors.push("Hay roles fuera de tu alcance.");
  return errors;
}
export function userPayload(
  draft: UserDraft,
  context: UserContext,
): UserPayload {
  const { password, ...values } = draft;
  return {
    ...values,
    username: values.username.trim(),
    nombre_completo: values.nombre_completo.trim(),
    email: values.email.trim(),
    cargo: values.cargo.trim(),
    departamento: context.es_superadmin
      ? values.departamento.trim()
      : context.departamento_propio || "",
    roles: [...new Set(values.roles)],
    ...(password.trim() ? { password } : {}),
    activo: values.activo ? 1 : 0,
  };
}
export function validateRole(
  draft: RoleDraft,
  record: RoleRecord | null,
  context: AuthorityContext,
  roles: RoleRecord[],
): string[] {
  const errors: string[] = [];
  if (record && ["admin", "superadmin"].includes(record.nombre.toLowerCase()))
    errors.push("El rol está protegido.");
  if (!draft.nombre.trim()) errors.push("Escribe el nombre del rol.");
  if (["admin", "superadmin"].includes(draft.nombre.trim().toLowerCase()))
    errors.push("El nombre del rol está reservado.");
  if (!canManage(context.es_superadmin, context.departamento))
    errors.push("Tu usuario no tiene departamento asignado.");
  if (
    record &&
    !context.es_superadmin &&
    record.departamento !== context.departamento
  )
    errors.push("El rol está fuera de tu departamento.");
  if (
    roles.some(
      (role) =>
        role.id !== record?.id &&
        normalizeSearch(role.nombre) === normalizeSearch(draft.nombre.trim()),
    )
  )
    errors.push("Ya existe otro rol con ese nombre.");
  return errors;
}
/** Nivel is deliberately omitted: Flask uses 3 for new roles and never edits it. */
export function rolePayload(
  draft: RoleDraft,
  record: RoleRecord | null,
  context: AuthorityContext,
): RolePayload {
  return {
    nombre: draft.nombre.trim(),
    descripcion: draft.descripcion.trim(),
    departamento: context.es_superadmin
      ? draft.departamento.trim()
      : context.departamento || "",
    ...(record ? { rol_id: record.id } : {}),
  };
}
export function permissionIds(catalog: PermissionCatalog): number[] {
  return [
    ...new Set(
      Object.values(catalog).flatMap((sections) =>
        Object.values(sections).flatMap((items) =>
          items.map((item) => item.id),
        ),
      ),
    ),
  ];
}
/** Send only assignable IDs. Flask preserves out-of-area assignments for delegates. */
export function assignableSelection(
  assigned: readonly number[],
  available: PermissionCatalog,
): number[] {
  const allowed = new Set(permissionIds(available));
  return [...new Set(assigned)].filter((id) => allowed.has(id));
}
export function toggleSelection(
  selected: readonly number[],
  ids: readonly number[],
): number[] {
  const next = new Set(selected);
  const remove = ids.every((id) => next.has(id));
  ids.forEach((id) => (remove ? next.delete(id) : next.add(id)));
  return [...next];
}
