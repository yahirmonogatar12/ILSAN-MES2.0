export interface Profile {
  username: string;
  nombre_completo: string;
  rol: string;
  roles?: string[];
  email?: string;
  editable?: boolean;
}
export interface ProfileUpdate {
  nombre_completo: string;
  email: string;
  current_password: string;
  new_password: string;
  confirm_password: string;
}
/** Exact permission contract of the existing MES; evaluated again by Flask. */
export interface PermissionRule {
  pagina: string;
  seccion: string;
  boton: string;
}
export interface PermissionSnapshot {
  usuario: string;
  rol: string;
  permisos: Record<string, Record<string, string[]>>;
}
export interface AuthGateway {
  profile: (signal?: AbortSignal) => Promise<Profile | null>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  saveProfile: (values: ProfileUpdate) => Promise<Profile>;
  permission: (rule: PermissionRule, signal?: AbortSignal) => Promise<boolean>;
  permissions: (signal?: AbortSignal) => Promise<PermissionSnapshot>;
}
