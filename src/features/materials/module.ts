import { lazy } from "react";
import { Package } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";
import { MATERIAL_PERMISSION } from "./config";
export const materialsModule: ModuleDefinition = {
  id: "materials",
  path: "/material/materiales",
  legacyPaths: ["/informacion-basica/materiales"],
  title: "Control de material",
  sectionId: "material",
  group: "Control de material",
  icon: Package,
  permission: MATERIAL_PERMISSION,
  component: lazy(() => import("./MaterialsPage")),
};
