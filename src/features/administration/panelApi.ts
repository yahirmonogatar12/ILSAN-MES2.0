import { request } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import { createAdministrationApi } from "./api";
import type { PermissionCatalog, RoleRecord } from "./types";
import type {
  AuditFilters,
  AuditRecord,
  AuditResult,
  Department,
  PanelApi,
  PanelUser,
  PermissionArea,
  RecentActivity,
} from "./panelTypes";

const BASE = "/admin";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const records = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(object);
function validId(id: number) {
  if (!Number.isInteger(id) || id < 1)
    throw new Error("Identificador inválido.");
  return id;
}
async function read<T>(
  path: string,
  valid: (value: unknown) => boolean,
  signal?: AbortSignal,
): Promise<T> {
  const value = await request<unknown>(BASE + path, { signal });
  if (!valid(value))
    throw new Error(
      "El servidor devolvió datos de administración incompletos.",
    );
  return value as T;
}
async function write(path: string, body?: unknown, method = "POST") {
  return request<Record<string, unknown>>(BASE + path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
export function auditQuery(filters: AuditFilters) {
  return new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value.trim()),
  ).toString();
}
/** Central administration uses native /admin contracts. The department screens retain their own adapter. */
export function createPanelApi(mode: RuntimeMode): PanelApi {
  if (mode === "demo") {
    const local = () =>
      import("./panelDemo").then((module) => module.panelDemo);
    return {
      userContext: async (...args) => (await local()).userContext(...args),
      users: async (...args) => (await local()).users(...args),
      saveUser: async (...args) => (await local()).saveUser(...args),
      roles: async (...args) => (await local()).roles(...args),
      availablePermissions: async (...args) =>
        (await local()).availablePermissions(...args),
      rolePermissions: async (...args) =>
        (await local()).rolePermissions(...args),
      savePermissions: async (...args) =>
        (await local()).savePermissions(...args),
      changeState: async (...args) => (await local()).changeState(...args),
      unlock: async (...args) => (await local()).unlock(...args),
      savePanelRole: async (...args) => (await local()).savePanelRole(...args),
      deleteRole: async (...args) => (await local()).deleteRole(...args),
      synchronize: async (...args) => (await local()).synchronize(...args),
      departments: async (...args) => (await local()).departments(...args),
      saveDepartment: async (...args) =>
        (await local()).saveDepartment(...args),
      deleteDepartment: async (...args) =>
        (await local()).deleteDepartment(...args),
      areas: async (...args) => (await local()).areas(...args),
      assignAreas: async (...args) => (await local()).assignAreas(...args),
      audit: async (...args) => (await local()).audit(...args),
      auditDetail: async (...args) => (await local()).auditDetail(...args),
      recent: async (...args) => (await local()).recent(...args),
    };
  }
  const scoped = createAdministrationApi(mode);
  return {
    userContext: scoped.userContext,
    users: (signal) =>
      read<PanelUser[]>(
        "/listar_usuarios",
        (value) =>
          records(value) &&
          value.every(
            (row) =>
              Number.isInteger(row.id) &&
              typeof row.username === "string" &&
              typeof row.nombre_completo === "string" &&
              Array.isArray(row.roles) &&
              row.roles.every((role) => typeof role === "string") &&
              typeof row.bloqueado === "boolean",
          ),
        signal,
      ),
    saveUser: (payload) =>
      request(BASE + "/guardar_usuario", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    roles: (signal) =>
      read<RoleRecord[]>(
        "/listar_roles",
        (value) =>
          records(value) &&
          value.every(
            (row) =>
              Number.isInteger(row.id) &&
              typeof row.nombre === "string" &&
              typeof row.nivel === "number" &&
              typeof row.total_usuarios === "number",
          ),
        signal,
      ),
    savePanelRole: async ({ rol_id, ...payload }) => {
      await write(
        rol_id ? "/actualizar_rol/" + validId(rol_id) : "/crear_rol",
        payload,
        rol_id ? "PUT" : "POST",
      );
    },
    changeState: async (username, activo) => {
      await write("/cambiar_estado_usuario", { username, activo });
    },
    unlock: async (username) => {
      await write("/desbloquear_usuario", { username });
    },
    deleteRole: async (id) => {
      await write("/eliminar_rol/" + validId(id), undefined, "DELETE");
    },
    availablePermissions: (signal) =>
      read<PermissionCatalog>(
        "/listar_permisos_dropdowns",
        (value) =>
          object(value) &&
          Object.values(value).every(
            (sections) =>
              object(sections) &&
              Object.values(sections).every(
                (items) =>
                  records(items) &&
                  items.every(
                    (item) =>
                      Number.isInteger(item.id) &&
                      typeof item.boton === "string",
                  ),
              ),
          ),
        signal,
      ),
    rolePermissions: async (id, signal) => {
      const rows = await read<{ id: number }[]>(
        "/obtener_permisos_dropdowns_rol/" + validId(id),
        (value) =>
          records(value) && value.every((row) => Number.isInteger(row.id)),
        signal,
      );
      return rows.map((row) => row.id);
    },
    savePermissions: (id, ids) =>
      request(BASE + "/actualizar_permisos_dropdowns_rol", {
        method: "POST",
        body: JSON.stringify({
          rol_id: validId(id),
          permisos_ids: [...new Set(ids)],
        }),
      }),
    synchronize: async () => {
      const result = await write("/sincronizar_permisos_dropdowns");
      return `${result.nuevos_agregados ?? 0} permisos agregados · ${result.desactivados ?? 0} desactivados.`;
    },
    departments: (signal) =>
      read<Department[]>(
        "/listar_departamentos",
        (value) =>
          records(value) &&
          value.every(
            (row) =>
              Number.isInteger(row.id) &&
              typeof row.nombre === "string" &&
              typeof row.activo === "number" &&
              typeof row.total_usuarios === "number",
          ),
        signal,
      ),
    saveDepartment: async (record, nombre, activo) => {
      await write(
        record
          ? "/actualizar_departamento/" + validId(record.id)
          : "/crear_departamento",
        { nombre: nombre.trim(), activo },
        record ? "PUT" : "POST",
      );
    },
    deleteDepartment: async (id) => {
      await write("/eliminar_departamento/" + validId(id), undefined, "DELETE");
    },
    areas: (signal) =>
      read<PermissionArea[]>(
        "/api/permisos-departamentos",
        (value) =>
          records(value) &&
          value.every(
            (row) =>
              Number.isInteger(row.id) &&
              ["pagina", "seccion", "boton"].every(
                (key) => typeof row[key] === "string",
              ) &&
              Array.isArray(row.departamentos) &&
              row.departamentos.every((item) => typeof item === "string"),
          ),
        signal,
      ),
    assignAreas: async (ids, departamento, accion) => {
      if (!ids.length || !departamento.trim())
        throw new Error("Selecciona permisos y un departamento.");
      await write("/api/permiso-departamentos-masivo", {
        permiso_ids: [...new Set(ids)].map(validId),
        departamento,
        accion,
      });
    },
    audit: (filters, signal) =>
      read<AuditResult>(
        "/buscar_auditoria?" + auditQuery(filters),
        (value) =>
          object(value) &&
          records(value.registros) &&
          value.registros.every(
            (row) =>
              Number.isInteger(row.id) &&
              typeof row.usuario === "string" &&
              typeof row.fecha_hora === "string",
          ) &&
          typeof value.total_encontrados === "number",
        signal,
      ),
    auditDetail: (id, signal) =>
      read<AuditRecord>(
        "/detalle_auditoria/" + validId(id),
        (value) =>
          object(value) &&
          Number.isInteger(value.id) &&
          typeof value.usuario === "string",
        signal,
      ),
    recent: (signal) =>
      read<RecentActivity>(
        "/actividad_reciente",
        (value) =>
          object(value) &&
          records(value.usuarios_activos) &&
          records(value.ultimas_acciones),
        signal,
      ),
  };
}
