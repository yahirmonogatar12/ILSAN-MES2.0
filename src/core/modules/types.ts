import type { ComponentType, LazyExoticComponent } from "react";
import type { LucideIcon } from "lucide-react";
import type { PermissionRule } from "../auth/types";
export type SectionId =
  | "informacion-basica"
  | "material"
  | "produccion"
  | "proceso"
  | "calidad"
  | "resultados"
  | "reporte"
  | "configuracion"
  | "administracion";
/** One descriptor supplies route, navigation, access control and lazy loading. */
export interface ModuleDefinition {
  id: string;
  path: string;
  /** Previous frontend URLs redirect to path; they do not duplicate module screens. */
  legacyPaths?: readonly string[];
  title: string;
  sectionId: SectionId;
  group: string;
  icon: LucideIcon;
  permission: PermissionRule | null;
  /** Additional role gate for system administration, including secondary roles. */
  requiredRoles?: readonly string[];
  component: LazyExoticComponent<ComponentType>;
  /** Generated examples stay isolated from live MES until their API is integrated. */
  demoOnly?: boolean;
}
export interface SectionDefinition {
  id: SectionId;
  title: string;
  image: string;
}
