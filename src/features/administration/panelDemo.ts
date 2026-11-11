import type { RoleRecord, Saved, UserPayload } from "./types";
import type {
  AuditRecord,
  Department,
  PanelApi,
  PanelRolePayload,
  PanelUser,
  PermissionArea,
} from "./panelTypes";

let users: PanelUser[] = [
  {
    id: 1,
    username: "admin",
    nombre_completo: "Administrador del sistema",
    email: "",
    departamento: "Sistemas",
    cargo: "Administrador",
    activo: 1,
    ultimo_acceso: "",
    roles: ["superadmin"],
    bloqueado: false,
    intentos_fallidos: 0,
    bloqueado_hasta: null,
    fecha_creacion: "",
  },
  {
    id: 2,
    username: "operador.demo",
    nombre_completo: "Operador de materiales",
    email: "operador@ilsan.local",
    departamento: "Almacén",
    cargo: "Operador",
    activo: 1,
    ultimo_acceso: "",
    roles: ["Operador de almacén"],
    bloqueado: false,
    intentos_fallidos: 0,
    bloqueado_hasta: null,
    fecha_creacion: "",
  },
  {
    id: 3,
    username: "calidad.demo",
    nombre_completo: "Supervisor de calidad",
    email: "",
    departamento: "Calidad",
    cargo: "Supervisor",
    activo: 1,
    ultimo_acceso: "",
    roles: ["Calidad"],
    bloqueado: true,
    intentos_fallidos: 5,
    bloqueado_hasta: null,
    fecha_creacion: "",
  },
];
let roles: RoleRecord[] = [
  {
    id: 1,
    nombre: "superadmin",
    descripcion: "Administración del sistema",
    nivel: 10,
    departamento: null,
    total_usuarios: 1,
  },
  {
    id: 2,
    nombre: "Operador de almacén",
    descripcion: "Consulta de materiales",
    nivel: 2,
    departamento: "Almacén",
    total_usuarios: 1,
  },
  {
    id: 3,
    nombre: "Calidad",
    descripcion: "Inspección y trazabilidad",
    nivel: 3,
    departamento: "Calidad",
    total_usuarios: 1,
  },
];
let departments: Department[] = [
  "Sistemas",
  "Almacén",
  "Calidad",
  "Producción",
].map((nombre, index) => ({
  id: index + 1,
  nombre,
  activo: 1,
  total_usuarios: 0,
}));
let areas: PermissionArea[] = [
  {
    id: 1,
    pagina: "LISTA_CONTROL_MATERIAL",
    seccion: "Control de material",
    boton: "Control de material",
    departamentos: ["Almacén"],
  },
  {
    id: 2,
    pagina: "LISTA_INFORMACIONBASICA",
    seccion: "Administración de usuario",
    boton: "Administración de usuario",
    departamentos: ["Sistemas"],
  },
  {
    id: 3,
    pagina: "LISTA_INFORMACIONBASICA",
    seccion: "Administración de usuario",
    boton: "Administración de autoridad",
    departamentos: ["Sistemas"],
  },
];
const assigned = new Map<number, number[]>([
  [1, [1, 2, 3]],
  [2, [1]],
  [3, []],
]);
const audit: AuditRecord[] = [
  {
    id: 1,
    fecha_hora: new Date().toISOString(),
    usuario: "admin",
    modulo: "sistema",
    accion: "actualizar_permisos_dropdowns",
    descripcion: "Permisos del rol actualizados",
    resultado: "EXITOSO",
    ip_address: "127.0.0.1",
    endpoint: "/admin/actualizar_permisos_dropdowns_rol",
    duracion_ms: 28,
    datos_antes: { permisos: [] },
    datos_despues: { permisos: [1] },
  },
];
function copy<T>(value: T): T {
  return structuredClone(value);
}
const saved = (): Saved => ({
  success: true,
  mensaje: "Cambios guardados en demostración.",
});
async function saveUser(payload: UserPayload) {
  if (payload.username === "admin")
    throw new Error("El administrador está protegido.");
  const { password: _password, ...values } = payload;
  const record = users.find((row) => row.username === payload.username);
  if (record) Object.assign(record, copy(values));
  else
    users.push({
      ...copy(values),
      id: Math.max(0, ...users.map((row) => row.id)) + 1,
      ultimo_acceso: "",
      bloqueado: false,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      fecha_creacion: "",
    });
  return saved();
}
async function saveRole(payload: PanelRolePayload) {
  const record = roles.find((row) => row.id === payload.rol_id);
  if (record) {
    const old = record.nombre;
    Object.assign(record, {
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      departamento: payload.departamento || null,
      nivel: payload.nivel,
    });
    users = users.map((row) => ({
      ...row,
      roles: row.roles.map((name) => (name === old ? record.nombre : name)),
    }));
    return record.id;
  }
  const id = Math.max(0, ...roles.map((row) => row.id)) + 1;
  roles.push({
    id,
    nombre: payload.nombre,
    descripcion: payload.descripcion,
    departamento: payload.departamento || null,
    nivel: payload.nivel,
    total_usuarios: 0,
  });
  return id;
}
/** Separate transient global sandbox. Passwords are discarded and never stored. */
export const panelDemo: PanelApi = {
  userContext: async () => ({
    es_superadmin: true,
    departamento_propio: null,
    departamentos: departments
      .filter((row) => row.activo)
      .map((row) => row.nombre),
    roles: roles.map((row) => row.nombre),
    cargos: ["Operador", "Supervisor", "Administrador"],
  }),
  users: async () => copy(users),
  saveUser,
  roles: async () =>
    copy(
      roles.map((row) => ({
        ...row,
        total_usuarios: users.filter((user) => user.roles.includes(row.nombre))
          .length,
      })),
    ),
  savePanelRole: async (payload) => {
    await saveRole(payload);
  },
  deleteRole: async (id) => {
    const record = roles.find((row) => row.id === id);
    if (
      !record ||
      record.nivel >= 8 ||
      users.some((row) => row.roles.includes(record.nombre))
    )
      throw new Error("Este rol está protegido o tiene usuarios asignados.");
    roles = roles.filter((row) => row.id !== id);
    assigned.delete(id);
  },
  changeState: async (username, activo) => {
    if (username === "admin")
      throw new Error("El administrador está protegido.");
    const record = users.find((row) => row.username === username);
    if (!record) throw new Error("Usuario no encontrado.");
    record.activo = activo ? 1 : 0;
  },
  unlock: async (username) => {
    const record = users.find((row) => row.username === username);
    if (!record) throw new Error("Usuario no encontrado.");
    Object.assign(record, {
      bloqueado: false,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    });
  },
  availablePermissions: async () => {
    const { demoAdministration } = await import("./demo");
    return demoAdministration.availablePermissions();
  },
  rolePermissions: async (id) => [...(assigned.get(id) || [])],
  savePermissions: async (id, ids) => {
    assigned.set(id, [...new Set(ids)]);
    return saved();
  },
  synchronize: async () => "Catálogo actualizado en demostración.",
  departments: async () =>
    copy(
      departments.map((row) => ({
        ...row,
        total_usuarios: users.filter((user) => user.departamento === row.nombre)
          .length,
      })),
    ),
  saveDepartment: async (record, nombre, activo) => {
    if (record) {
      const current = departments.find((row) => row.id === record.id);
      if (!current) throw new Error("Departamento no encontrado.");
      const old = current.nombre;
      Object.assign(current, { nombre, activo });
      users = users.map((row) => ({
        ...row,
        departamento: row.departamento === old ? nombre : row.departamento,
      }));
      roles = roles.map((row) => ({
        ...row,
        departamento: row.departamento === old ? nombre : row.departamento,
      }));
      return;
    }
    departments.push({
      id: Math.max(0, ...departments.map((row) => row.id)) + 1,
      nombre,
      activo: 1,
      total_usuarios: 0,
    });
  },
  deleteDepartment: async (id) => {
    const record = departments.find((row) => row.id === id);
    if (!record || users.some((row) => row.departamento === record.nombre))
      throw new Error("Hay usuarios asignados al departamento.");
    departments = departments.filter((row) => row.id !== id);
  },
  areas: async () => copy(areas),
  assignAreas: async (ids, department, action) => {
    areas = areas.map((row) =>
      !ids.includes(row.id)
        ? row
        : {
            ...row,
            departamentos:
              action === "add"
                ? [...new Set([...row.departamentos, department])]
                : row.departamentos.filter((value) => value !== department),
          },
    );
  },
  audit: async (filters) => {
    const records = audit
      .filter(
        (row) =>
          (!filters.usuario || row.usuario.includes(filters.usuario)) &&
          (!filters.modulo || row.modulo === filters.modulo) &&
          (!filters.resultado || row.resultado === filters.resultado) &&
          (!filters.accion || row.accion.includes(filters.accion)) &&
          (!filters.fecha_inicio ||
            row.fecha_hora.slice(0, 10) >= filters.fecha_inicio) &&
          (!filters.fecha_fin ||
            row.fecha_hora.slice(0, 10) <= filters.fecha_fin),
      )
      .slice(0, Number(filters.limite));
    return { registros: copy(records), total_encontrados: records.length };
  },
  auditDetail: async (id) => {
    const row = audit.find((record) => record.id === id);
    if (!row) throw new Error("Registro no encontrado.");
    return copy(row);
  },
  recent: async () => ({
    usuarios_activos: [
      { usuario: "admin", ultima_accion: "consulta", hace: "5s" },
    ],
    ultimas_acciones: copy(audit),
  }),
};
