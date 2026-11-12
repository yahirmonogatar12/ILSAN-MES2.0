import type {
  AdministrationApi,
  PermissionCatalog,
  RoleRecord,
  UserRecord,
} from "./types";

// Shared only within this domain. Demo writes are transient and never use HTTP.
// Passwords are discarded immediately, never included in records or storage.
let users: UserRecord[] = [
  {
    id: 1,
    username: "operador.demo",
    nombre_completo: "Operador de materiales",
    email: "",
    departamento: "Almacén",
    cargo: "Operador",
    activo: 1,
    ultimo_acceso: "",
    roles: ["Operador de almacén"],
  },
  {
    id: 2,
    username: "supervisor.demo",
    nombre_completo: "Supervisor de calidad",
    email: "",
    departamento: "Calidad",
    cargo: "Supervisor",
    activo: 1,
    ultimo_acceso: "",
    roles: ["Supervisor de calidad"],
  },
  {
    id: 3,
    username: "consulta.demo",
    nombre_completo: "Usuario de consulta",
    email: "",
    departamento: "Producción",
    cargo: "",
    activo: 0,
    ultimo_acceso: "",
    roles: ["Consulta"],
  },
];
let roles: RoleRecord[] = [
  {
    id: 1,
    nombre: "Operador de almacén",
    descripcion: "Consulta del catálogo de materiales",
    departamento: "Almacén",
    nivel: 3,
    total_usuarios: 0,
  },
  {
    id: 2,
    nombre: "Supervisor de calidad",
    descripcion: "Responsable del área de calidad",
    departamento: "Calidad",
    nivel: 3,
    total_usuarios: 0,
  },
  {
    id: 3,
    nombre: "Consulta",
    descripcion: "Acceso de consulta",
    departamento: null,
    nivel: 3,
    total_usuarios: 0,
  },
];
const available: PermissionCatalog = {
  LISTA_INFORMACIONBASICA: {
    "Administración de usuario": [
      {
        id: 1,
        boton: "Administración de usuario",
        descripcion: "Gestionar usuarios del departamento",
      },
      {
        id: 2,
        boton: "Administración de autoridad",
        descripcion: "Gestionar roles y sus permisos",
      },
    ],
    "Control de material": [
      {
        id: 3,
        boton: "Control de material",
        descripcion: "Consultar y registrar materiales",
      },
    ],
    "Control de produccion": [
      {
        id: 6,
        boton: "Control de modelos SMT",
        descripcion: "Consultar modelos SMT",
      },
      {
        id: 7,
        boton: "Control de modelos",
        descripcion: "Consultar modelos RAW",
      },
      {
        id: 8,
        boton: "Control de BOM",
        descripcion: "Consultar componentes BOM",
      },
      {
        id: 9,
        boton: "Control de FPA",
        descripcion: "Consultar solicitudes FPA",
      },
    ],
  },
  LISTA_DE_MATERIALES: {
    "Control de material": [
      {
        id: 14,
        boton: "Facturas / Invoice",
        descripcion: "Acceso a Invoice Almacén",
      },
      {
        id: 15,
        boton: "Invoice Embarques",
        descripcion: "Acceso a invoices de embarques",
      },
      {
        id: 16,
        boton: "Valorización de inventario",
        descripcion: "Consultar valorización y costos históricos",
      },
      {
        id: 17,
        boton: "Lista de compras",
        descripcion: "Consultar y cargar compras",
      },
      {
        id: 10,
        boton: "Historial de entradas",
        descripcion: "Consultar entradas de material",
      },
      {
        id: 11,
        boton: "Historial de salidas",
        descripcion: "Consultar salidas de material",
      },
      {
        id: 12,
        boton: "Historial de retornos",
        descripcion: "Consultar retornos de material",
      },
      {
        id: 13,
        boton: "Inventario actual",
        descripcion: "Consultar inventario y lotes",
      },
    ],
  },
  LISTA_CONTROL_DE_CALIDAD: {
    "Control de calidad": [
      {
        id: 4,
        boton: "Control de inspección",
        descripcion: "Consultar inspecciones",
      },
      {
        id: 5,
        boton: "Control de defectos",
        descripcion: "Registrar defectos de calidad",
      },
    ],
  },
};
const assigned = new Map<number, number[]>([
  [1, [3]],
  [2, [4, 5]],
  [3, []],
]);

export const demoAdministration: AdministrationApi = {
  async userContext() {
    return {
      es_superadmin: true,
      departamento_propio: null,
      departamentos: ["Almacén", "Calidad", "Producción"],
      roles: roles.map((role) => role.nombre),
      cargos: ["Operador", "Supervisor", "Ingeniero"],
    };
  },
  async users() {
    return structuredClone(users);
  },
  async saveUser(payload) {
    if (payload.username === "admin")
      throw new Error("El usuario administrador está protegido.");
    const previous = users.find((user) => user.username === payload.username);
    if (!previous && !payload.password?.trim())
      throw new Error("La contraseña es requerida.");
    if (
      payload.roles.some((name) => !roles.some((role) => role.nombre === name))
    )
      throw new Error("El rol ya no está disponible. Actualiza la consulta.");
    const { password: discarded, ...record } = payload;
    void discarded;
    const saved: UserRecord = {
      ...structuredClone(record),
      id: previous?.id ?? Math.max(0, ...users.map((user) => user.id)) + 1,
      ultimo_acceso: previous?.ultimo_acceso || "",
    };
    users = previous
      ? users.map((user) => (user.id === previous.id ? saved : user))
      : [saved, ...users];
    return {
      success: true,
      mensaje: `Usuario ${payload.username} ${previous ? "actualizado" : "creado"}`,
    };
  },
  async authorityContext() {
    return { es_superadmin: true, departamento: null };
  },
  async roles() {
    return structuredClone(
      roles.map((role) => ({
        ...role,
        total_usuarios: users.filter((user) => user.roles.includes(role.nombre))
          .length,
      })),
    );
  },
  async saveRole(payload) {
    if (["admin", "superadmin"].includes(payload.nombre.toLowerCase()))
      throw new Error("Nombre de rol reservado.");
    if (
      roles.some(
        (role) => role.nombre === payload.nombre && role.id !== payload.rol_id,
      )
    )
      throw new Error("Ya existe otro rol con ese nombre.");
    const previous = roles.find((role) => role.id === payload.rol_id);
    if (payload.rol_id && !previous)
      throw new Error("El rol ya no está disponible.");
    const role: RoleRecord = {
      id: previous?.id ?? Math.max(0, ...roles.map((item) => item.id)) + 1,
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      departamento: payload.departamento || null,
      nivel: previous?.nivel ?? 3,
      total_usuarios: 0,
    };
    roles = previous
      ? roles.map((item) => (item.id === role.id ? role : item))
      : [...roles, role];
    if (previous)
      users = users.map((user) => ({
        ...user,
        roles: user.roles.map((name) =>
          name === previous.nombre ? role.nombre : name,
        ),
      }));
    if (!assigned.has(role.id)) assigned.set(role.id, []);
    return {
      success: true,
      rol_id: role.id,
      mensaje: `Rol "${role.nombre}" guardado`,
    };
  },
  async availablePermissions() {
    return structuredClone(available);
  },
  async rolePermissions(id) {
    if (!assigned.has(id)) throw new Error("El rol no existe.");
    return [...assigned.get(id)!];
  },
  async savePermissions(id, ids) {
    if (!assigned.has(id)) throw new Error("El rol no existe.");
    assigned.set(id, [...new Set(ids)]);
    return { success: true, mensaje: "Permisos actualizados" };
  },
};
