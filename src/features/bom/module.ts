import { lazy } from "react";
import { GitBranch } from "lucide-react";
import { BOM_VIEW } from "./config";
import type { ModuleDefinition } from "@/core/modules/types";

/** View permission is separate from the create/approve ECO actions. */
export const bomModule: ModuleDefinition = {
  id: "bom",
  path: "/informacion-basica/bom",
  title: "Control de BOM",
  sectionId: "informacion-basica",
  group: "Control de producción",
  icon: GitBranch,
  permission: BOM_VIEW,
  component: lazy(() => import("./Page")),
};
