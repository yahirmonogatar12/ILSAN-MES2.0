import { lazy } from "react";
import { Wrench } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";

/** Same permission as the Flask view, creation and cancellation endpoints. */
export const reworkModule: ModuleDefinition = {
  id: "rework",
  path: "/produccion/retrabajo",
  legacyPaths: ["/control_produccion/retrabajo"],
  title: "Solicitud de retrabajo",
  sectionId: "produccion",
  group: "Retrabajo",
  icon: Wrench,
  permission: {
    pagina: "LISTA_CONTROLDEPRODUCCION",
    seccion: "Retrabajo",
    boton: "Solicitud de retrabajo",
  },
  component: lazy(() => import("./Page")),
};
