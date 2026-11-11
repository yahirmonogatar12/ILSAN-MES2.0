import { lazy } from "react";
import { Building2, History, ShieldCheck, Users } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";
import { AUTHORITY_PERMISSION, USER_PERMISSION } from "./config";

/** Department administration and central administration share forms and domain contracts. */
export const administrationModule: ModuleDefinition = {
  id: "administration-users",
  path: "/informacion-basica/usuarios",
  title: "Administración de usuario",
  sectionId: "informacion-basica",
  group: "Administración de usuario",
  icon: Users,
  permission: USER_PERMISSION,
  component: lazy(() => import("./Page")),
};
export const authoritiesModule: ModuleDefinition = {
  id: "administration-authorities",
  path: "/informacion-basica/autoridades",
  title: "Administración de autoridad",
  sectionId: "informacion-basica",
  group: "Administración de usuario",
  icon: ShieldCheck,
  permission: AUTHORITY_PERMISSION,
  component: lazy(() => import("./AuthoritiesPage")),
};

export const adminPanelModule: ModuleDefinition = {
  id: "admin-panel-users",
  path: "/admin/panel",
  title: "Usuarios",
  sectionId: "administracion",
  group: "Administración del sistema",
  icon: Users,
  permission: null,
  requiredRoles: ["superadmin"],
  component: lazy(() => import("./PanelUsers")),
};
export const adminRolesModule: ModuleDefinition = {
  id: "admin-panel-roles",
  path: "/admin/roles",
  legacyPaths: ["/admin/permisos-dropdowns"],
  title: "Roles y permisos",
  sectionId: "administracion",
  group: "Administración del sistema",
  icon: ShieldCheck,
  permission: null,
  requiredRoles: ["superadmin"],
  component: lazy(() => import("./PanelRoles")),
};
export const adminDepartmentsModule: ModuleDefinition = {
  id: "admin-panel-departments",
  path: "/admin/departamentos",
  title: "Departamentos",
  sectionId: "administracion",
  group: "Administración del sistema",
  icon: Building2,
  permission: null,
  requiredRoles: ["superadmin"],
  component: lazy(() => import("./PanelDepartments")),
};
export const adminAuditModule: ModuleDefinition = {
  id: "admin-panel-audit",
  path: "/admin/auditoria",
  title: "Auditoría",
  sectionId: "administracion",
  group: "Administración del sistema",
  icon: History,
  permission: null,
  requiredRoles: ["superadmin"],
  component: lazy(() => import("./PanelAudit")),
};
