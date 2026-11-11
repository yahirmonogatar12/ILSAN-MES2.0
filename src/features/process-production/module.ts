import { lazy } from "react";
import { List } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";

/** Original process-production permissions; SMT Plan differs from machine control SMT. */
export const processProductionModule: ModuleDefinition = {
  id: "process-production",
  path: "/proceso/produccion-assy",
  legacyPaths: ["/plan-main", "/plan-main-assy-ajax"],
  title: "Control de produccion ASSY",
  sectionId: "proceso",
  group: "Control de producción",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Control de produccion",
    boton: "Control de produccion ASSY",
  },
  component: lazy(() => import("./Page")),
};
export const imtProductionModule: ModuleDefinition = {
  id: "process-imt",
  path: "/proceso/produccion-imt",
  legacyPaths: ["/plan-imd", "/plan-main-imd-ajax"],
  title: "Control de produccion IMT",
  sectionId: "proceso",
  group: "Control de producción",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Control de produccion",
    boton: "Control de produccion IMT",
  },
  component: lazy(() => import("./ImtPage")),
};
export const smtProductionModule: ModuleDefinition = {
  id: "process-smt",
  path: "/proceso/produccion-smt",
  legacyPaths: ["/plan-smt", "/plan-main-smt-ajax"],
  title: "Control de produccion SMT",
  sectionId: "proceso",
  group: "Control de producción",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Control de produccion",
    boton: "Control de produccion SMT Plan",
  },
  component: lazy(() => import("./SmtPage")),
};
export const processOperationsModule: ModuleDefinition = {
  id: "process-operations",
  path: "/proceso/historial-operacion",
  legacyPaths: [
    "/historial-operacion-proceso-ajax",
    "/control_proceso/historial_operacion_proceso",
  ],
  title: "Historial de operacion por proceso",
  sectionId: "proceso",
  group: "Control de producción",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Control de produccion",
    boton: "Historial de operacion por proceso",
  },
  component: lazy(() => import("./OperationsPage")),
};
export const lineOutputsModule: ModuleDefinition = {
  id: "line-outputs",
  path: "/proceso/salida-lineas",
  legacyPaths: ["/control-salida-lineas-ajax"],
  title: "Control de salida de lineas",
  sectionId: "proceso",
  group: "Control de producción",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Control de produccion",
    boton: "Control de salida de lineas",
  },
  component: lazy(() => import("./OutputsPage")),
};
