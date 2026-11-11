import { lazy } from "react";
import { List } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";

export const scrapControlModule: ModuleDefinition = {
  id: "scrap-control",
  path: "/proceso/scrap",
  legacyPaths: ["/control-scrap-ajax", "/control_proceso/control_scrap"],
  title: "Control de Scrap",
  sectionId: "proceso",
  group: "Control de material Scrap",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Control de material Scrap",
    boton: "Control de Scrap",
  },
  component: lazy(() => import("./Page")),
};
