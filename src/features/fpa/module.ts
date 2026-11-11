import { lazy } from "react";
import { Tags } from "lucide-react";
import { FPA_VIEW } from "./config";
import type { ModuleDefinition } from "@/core/modules/types";

/** Uses the MES proxy to MICOM and the original view permission. */
export const fpaModule: ModuleDefinition = {
  id: "fpa",
  path: "/informacion-basica/fpa",
  title: "Control de FPA",
  sectionId: "informacion-basica",
  group: "Control de producción",
  icon: Tags,
  permission: FPA_VIEW,
  component: lazy(() => import("./Page")),
};
