import type { AdministrationApi, RolePayload, UserRecord } from "./types";

export interface PanelUser extends UserRecord {
  bloqueado: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
  fecha_creacion: string;
}
export interface Department {
  id: number;
  nombre: string;
  activo: number;
  total_usuarios: number;
}
export interface PermissionArea {
  id: number;
  pagina: string;
  seccion: string;
  boton: string;
  departamentos: string[];
}
export interface PanelRolePayload extends RolePayload {
  nivel: number;
}
export interface AuditFilters {
  fecha_inicio: string;
  fecha_fin: string;
  usuario: string;
  modulo: string;
  accion: string;
  resultado: string;
  limite: string;
}
export interface AuditRecord {
  id: number;
  fecha_hora: string;
  usuario: string;
  modulo: string;
  accion: string;
  descripcion: string | null;
  resultado: string;
  ip_address: string | null;
  endpoint: string | null;
  duracion_ms: number | null;
  datos_antes?: unknown;
  datos_despues?: unknown;
  datos_antes_json?: unknown;
  datos_despues_json?: unknown;
}
export interface AuditResult {
  registros: AuditRecord[];
  total_encontrados: number;
}
export interface RecentActivity {
  usuarios_activos: { usuario: string; ultima_accion: string; hace: string }[];
  ultimas_acciones: Omit<
    AuditRecord,
    "id" | "resultado" | "ip_address" | "endpoint" | "duracion_ms"
  >[];
}
export interface PanelApi extends Pick<
  AdministrationApi,
  | "userContext"
  | "saveUser"
  | "roles"
  | "availablePermissions"
  | "rolePermissions"
  | "savePermissions"
> {
  users(signal?: AbortSignal): Promise<PanelUser[]>;
  changeState(username: string, activo: boolean): Promise<void>;
  unlock(username: string): Promise<void>;
  savePanelRole(payload: PanelRolePayload): Promise<void>;
  deleteRole(id: number): Promise<void>;
  synchronize(): Promise<string>;
  departments(signal?: AbortSignal): Promise<Department[]>;
  saveDepartment(
    record: Department | null,
    nombre: string,
    activo: number,
  ): Promise<void>;
  deleteDepartment(id: number): Promise<void>;
  areas(signal?: AbortSignal): Promise<PermissionArea[]>;
  assignAreas(
    ids: number[],
    department: string,
    action: "add" | "remove",
  ): Promise<void>;
  audit(filters: AuditFilters, signal?: AbortSignal): Promise<AuditResult>;
  auditDetail(id: number, signal?: AbortSignal): Promise<AuditRecord>;
  recent(signal?: AbortSignal): Promise<RecentActivity>;
}
