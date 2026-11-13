import { createContext, useContext } from "react";
import type { PermissionRule } from "../auth/types";

export interface ModulePermission {
  id: string;
  title: string;
  section: string;
  group: string;
  permission: PermissionRule;
}

export const ModuleCatalogContext = createContext<readonly ModulePermission[]>(
  [],
);

export const useModuleCatalog = () => useContext(ModuleCatalogContext);
