import { lazy } from "react";
import { Route, ScanLine } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";

export const productTrackingModule: ModuleDefinition = {
  id: "product-tracking",
  path: "/reporte/product-tracking",
  legacyPaths: ["/control_reporte/production_tracking"],
  title: "Production Tracking By Process",
  sectionId: "reporte",
  group: "Product Tracking",
  icon: Route,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_REPORTE",
    seccion: "Product Tracking",
    boton: "Production Tracking By Process",
  },
  component: lazy(() => import("./Page")),
};
export const pcbTraceabilityModule: ModuleDefinition = {
  id: "pcb-traceability",
  path: "/reporte/trazabilidad-pcb",
  legacyPaths: ["/control_resultados/trazabilidad_pcb"],
  title: "Trazabilidad de PCB",
  sectionId: "reporte",
  group: "Product Tracking",
  icon: ScanLine,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_REPORTE",
    seccion: "Product Tracking",
    boton: "Trazabilidad de PCB",
  },
  component: lazy(() => import("./PcbPage")),
};
