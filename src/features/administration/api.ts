import { isRecord as object } from "@/shared/lib/parse";
import { request } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import type {
  AdministrationApi,
  PermissionCatalog,
  RoleRecord,
  UserContext,
  UserRecord,
  AuthorityContext,
} from "./types";

const USERS = "/api/admin-usuarios-depto";
const ROLES = "/api/gestion-roles-depto";

const strings = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const ids = (value: unknown) =>
  Array.isArray(value) && value.every((id) => Number.isInteger(id) && id > 0);
async function read<T>(
  path: string,
  valid: (value: unknown) => boolean,
  signal?: AbortSignal,
): Promise<T> {
  const value = await request<unknown>(path, { signal });
  if (!valid(value))
    throw new Error(
      "El servidor devolvió datos de administración incompletos. Actualiza la consulta.",
    );
  return value as T;
}
function catalog(value: unknown): boolean {
  return (
    object(value) &&
    Object.values(value).every(
      (sections) =>
        object(sections) &&
        Object.values(sections).every(
          (items) =>
            Array.isArray(items) &&
            items.every(
              (item) =>
                object(item) &&
                Number.isInteger(item.id) &&
                (item.id as number) > 0 &&
                typeof item.boton === "string",
            ),
        ),
    )
  );
}
function roleId(id: number): number {
  if (!Number.isInteger(id) || id < 1) throw new Error("El rol no es válido.");
  return id;
}
/** Uses the existing department-scoped endpoints, never the superadmin panel. */
export function createAdministrationApi(mode: RuntimeMode): AdministrationApi {
  if (mode === "demo") {
    // Load sample records only when demo is actually used. Native import caching
    // shares one domain instance across the users and authorities screens.
    const local = () =>
      import("./demo").then((module) => module.demoAdministration);
    return {
      userContext: async (signal) => (await local()).userContext(signal),
      users: async (signal) => (await local()).users(signal),
      saveUser: async (payload) => (await local()).saveUser(payload),
      authorityContext: async (signal) =>
        (await local()).authorityContext(signal),
      roles: async (signal) => (await local()).roles(signal),
      saveRole: async (payload) => (await local()).saveRole(payload),
      availablePermissions: async (signal) =>
        (await local()).availablePermissions(signal),
      rolePermissions: async (id, signal) =>
        (await local()).rolePermissions(id, signal),
      savePermissions: async (id, selected) =>
        (await local()).savePermissions(id, selected),
    };
  }
  return {
    userContext: (signal) =>
      read<UserContext>(
        `${USERS}/contexto`,
        (value) =>
          object(value) &&
          typeof value.es_superadmin === "boolean" &&
          (value.departamento_propio === null ||
            typeof value.departamento_propio === "string") &&
          strings(value.departamentos) &&
          strings(value.roles) &&
          strings(value.cargos),
        signal,
      ),
    users: (signal) =>
      read<UserRecord[]>(
        `${USERS}/usuarios`,
        (value) =>
          Array.isArray(value) &&
          value.every(
            (user) =>
              object(user) &&
              Number.isInteger(user.id) &&
              typeof user.username === "string" &&
              typeof user.nombre_completo === "string" &&
              strings(user.roles),
          ),
        signal,
      ),
    saveUser: (payload) =>
      request(`${USERS}/guardar_usuario`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    authorityContext: (signal) =>
      read<AuthorityContext>(
        `${ROLES}/contexto`,
        (value) =>
          object(value) &&
          typeof value.es_superadmin === "boolean" &&
          (value.departamento === null ||
            typeof value.departamento === "string"),
        signal,
      ),
    roles: (signal) =>
      read<RoleRecord[]>(
        `${ROLES}/roles`,
        (value) =>
          Array.isArray(value) &&
          value.every(
            (role) =>
              object(role) &&
              Number.isInteger(role.id) &&
              typeof role.nombre === "string" &&
              typeof role.nivel === "number" &&
              typeof role.total_usuarios === "number",
          ),
        signal,
      ),
    saveRole: (payload) =>
      request(`${ROLES}/guardar-rol`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    availablePermissions: (signal) =>
      read<PermissionCatalog>(`${ROLES}/permisos-disponibles`, catalog, signal),
    rolePermissions: (id, signal) =>
      read<number[]>(`${ROLES}/permisos-rol/${roleId(id)}`, ids, signal),
    savePermissions: (id, selected) =>
      request(`${ROLES}/guardar-permisos`, {
        method: "POST",
        body: JSON.stringify({
          rol_id: roleId(id),
          permisos_ids: [...new Set(selected)],
        }),
      }),
  };
}
