import { lazy } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  Warehouse,
} from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";
export const materialLedgerModule: ModuleDefinition = {
  id: "material-entries",
  path: "/material/historial-entradas",
  legacyPaths: ["/material/historial_admin/entradas"],
  title: "Historial de entradas",
  sectionId: "material",
  group: "Control de material",
  icon: ArrowDownToLine,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Control de material",
    boton: "Historial de entradas",
  },
  component: lazy(() => import("./Page")),
};
export const materialExitsModule: ModuleDefinition = {
  id: "material-exits",
  path: "/material/historial-salidas",
  legacyPaths: ["/material/historial_admin/salidas"],
  title: "Historial de salidas",
  sectionId: "material",
  group: "Control de material",
  icon: ArrowUpFromLine,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Control de material",
    boton: "Historial de salidas",
  },
  component: lazy(() => import("./ExitsPage")),
};
export const materialReturnsModule: ModuleDefinition = {
  id: "material-returns",
  path: "/material/historial-retornos",
  legacyPaths: ["/material/historial_admin/retornos"],
  title: "Historial de retornos",
  sectionId: "material",
  group: "Control de material",
  icon: RotateCcw,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Control de material",
    boton: "Historial de retornos",
  },
  component: lazy(() => import("./ReturnsPage")),
};
export const currentInventoryModule: ModuleDefinition = {
  id: "current-inventory",
  path: "/material/inventario-actual",
  legacyPaths: ["/material/inventario_actual"],
  title: "Inventario actual",
  sectionId: "material",
  group: "Control de material",
  icon: Warehouse,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Control de material",
    boton: "Inventario actual",
  },
  component: lazy(() => import("./InventoryPage")),
};
