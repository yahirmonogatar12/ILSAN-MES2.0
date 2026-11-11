import type { PermissionRule } from "@/core/auth/types";
export const USER_PERMISSION: PermissionRule = {
  pagina: "LISTA_INFORMACIONBASICA",
  seccion: "Administración de usuario",
  boton: "Administración de usuario",
};
export const AUTHORITY_PERMISSION: PermissionRule = {
  ...USER_PERMISSION,
  boton: "Administración de autoridad",
};
export const administrationKeys = {
  all: (scope: string) => ["administration", scope] as const,
  users: (scope: string) => ["administration", scope, "users"] as const,
  userContext: (scope: string) =>
    ["administration", scope, "user-context"] as const,
  roles: (scope: string) => ["administration", scope, "roles"] as const,
  authorityContext: (scope: string) =>
    ["administration", scope, "authority-context"] as const,
  available: (scope: string) => ["administration", scope, "available"] as const,
  assigned: (scope: string, id: number) =>
    ["administration", scope, "assigned", id] as const,
};
export const PAGE_NAMES: Record<string, string> = {
  LISTA_INFORMACIONBASICA: "Información básica",
  LISTA_DE_MATERIALES: "Control de material",
  LISTA_CONTROLDEPRODUCCION: "Control de producción",
  LISTA_CONTROL_DE_PROCESO: "Control de proceso",
  LISTA_CONTROL_DE_CALIDAD: "Control de calidad",
  LISTA_DE_CONTROL_DE_RESULTADOS: "Control de resultados",
  LISTA_DE_CONTROL_DE_REPORTE: "Control de reporte",
  LISTA_DE_CONFIGPG: "Configuración de programa",
  APP_REGISTRO_EMBARQUES: "App Registro de Embarques",
};
