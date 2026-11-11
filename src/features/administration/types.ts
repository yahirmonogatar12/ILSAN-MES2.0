/** Contracts of admin_usuarios_depto.py and gestion_roles_depto.py. */
export interface UserRecord {
  id: number;
  username: string;
  nombre_completo: string;
  email: string | null;
  departamento: string | null;
  cargo: string | null;
  activo: number;
  ultimo_acceso: string;
  roles: string[];
}
export interface UserContext {
  es_superadmin: boolean;
  departamento_propio: string | null;
  departamentos: string[];
  roles: string[];
  cargos: string[];
}
export interface UserDraft {
  username: string;
  nombre_completo: string;
  email: string;
  password: string;
  departamento: string;
  cargo: string;
  activo: number;
  roles: string[];
}
export type UserPayload = Omit<UserDraft, "password"> & { password?: string };
export interface RoleRecord {
  id: number;
  nombre: string;
  descripcion: string | null;
  departamento: string | null;
  nivel: number;
  total_usuarios: number;
}
export interface AuthorityContext {
  es_superadmin: boolean;
  departamento: string | null;
}
export interface RoleDraft {
  nombre: string;
  descripcion: string;
  departamento: string;
}
export interface RolePayload extends RoleDraft {
  rol_id?: number;
}
export interface PermissionOption {
  id: number;
  boton: string;
  descripcion: string | null;
}
export type PermissionCatalog = Record<
  string,
  Record<string, PermissionOption[]>
>;
export interface Saved {
  success: true;
  mensaje: string;
}
export interface AdministrationApi {
  userContext(signal?: AbortSignal): Promise<UserContext>;
  users(signal?: AbortSignal): Promise<UserRecord[]>;
  saveUser(payload: UserPayload): Promise<Saved>;
  authorityContext(signal?: AbortSignal): Promise<AuthorityContext>;
  roles(signal?: AbortSignal): Promise<RoleRecord[]>;
  saveRole(payload: RolePayload): Promise<Saved & { rol_id: number }>;
  availablePermissions(signal?: AbortSignal): Promise<PermissionCatalog>;
  rolePermissions(id: number, signal?: AbortSignal): Promise<number[]>;
  savePermissions(id: number, ids: number[]): Promise<Saved>;
}
