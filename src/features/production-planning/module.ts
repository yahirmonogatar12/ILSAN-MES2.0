import { lazy } from "react";
import {
  CalendarDays,
  Truck,
  ChartNoAxesCombined,
  ClipboardList,
} from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";
export const productionPlanningModule: ModuleDefinition = {
  id: "production-shipments",
  path: "/produccion/embarques",
  legacyPaths: ["/control_produccion/control_embarque", "/Control de embarque"],
  title: "Control de embarque",
  sectionId: "produccion",
  group: "Control de plan de producción",
  icon: Truck,
  permission: {
    pagina: "LISTA_CONTROLDEPRODUCCION",
    seccion: "Control de plan de produccion",
    boton: "Control de embarque",
  },
  component: lazy(() => import("./Page")),
};
export const partPlanningModule: ModuleDefinition = {
  id: "part-planning",
  path: "/produccion/part-planning",
  legacyPaths: ["/part-planning-ajax"],
  title: "Part Planning LG",
  sectionId: "produccion",
  group: "Control de plan de producción",
  icon: CalendarDays,
  permission: {
    pagina: "LISTA_CONTROLDEPRODUCCION",
    seccion: "Control de plan de produccion",
    boton: "Part Planning LG",
  },
  component: lazy(() => import("./PivotPage")),
};
export const productionProjectionModule: ModuleDefinition = {
  id: "production-projection",
  path: "/produccion/proyeccion",
  legacyPaths: ["/proyeccion-ajax"],
  title: "Proyeccion",
  sectionId: "produccion",
  group: "Control de plan de producción",
  icon: ChartNoAxesCombined,
  permission: {
    pagina: "LISTA_CONTROLDEPRODUCCION",
    seccion: "Control de plan de produccion",
    boton: "Proyeccion",
  },
  component: lazy(() => import("./ProjectionPage")),
};
export const projectedPlanModule: ModuleDefinition = {
  id: "projected-plan",
  path: "/produccion/plan-proyectado",
  legacyPaths: ["/plan-proyectado-ajax"],
  title: "Plan Proyectado",
  sectionId: "produccion",
  group: "Control de plan de producción",
  icon: CalendarDays,
  permission: {
    pagina: "LISTA_CONTROLDEPRODUCCION",
    seccion: "Control de plan de produccion",
    boton: "Plan Proyectado",
  },
  component: lazy(() => import("./ProjectedPage")),
};
export const workOrdersModule: ModuleDefinition = {
  id: "work-orders",
  path: "/produccion/crear-plan",
  legacyPaths: ["/control_produccion/crear_plan"],
  title: "Crear Plan de produccion",
  sectionId: "produccion",
  group: "Control de plan de producción",
  icon: ClipboardList,
  permission: {
    pagina: "LISTA_CONTROLDEPRODUCCION",
    seccion: "Control de plan de produccion",
    boton: "Crear Plan de produccion",
  },
  component: lazy(() => import("./WorkOrdersPage")),
};
