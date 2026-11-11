import { lazy } from "react";
import { Warehouse } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";

export const shippingWarehouseModule: ModuleDefinition = {
  id: "shipping-warehouse",
  path: "/proceso/embarques/entradas",
  legacyPaths: [
    "/almacen-embarques-entradas-ajax",
    "/control_proceso/almacen_embarques_entradas",
  ],
  title: "Entradas almacen embarques",
  sectionId: "proceso",
  group: "Almacén de Embarques",
  icon: Warehouse,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Almacén de Embarques",
    boton: "Entradas almacen embarques",
  },
  component: lazy(() => import("./Page")),
};

export const shippingExitsModule: ModuleDefinition = {
  id: "shipping-warehouse-exits",
  path: "/proceso/embarques/salidas",
  legacyPaths: [
    "/almacen-embarques-salidas-ajax",
    "/control_proceso/almacen_embarques_salidas",
  ],
  title: "Salidas almacen embarques",
  sectionId: "proceso",
  group: "Almacén de Embarques",
  icon: Warehouse,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Almacén de Embarques",
    boton: "Salidas almacen embarques",
  },
  component: lazy(() => import("./ExitsPage")),
};

export const shippingReturnsModule: ModuleDefinition = {
  id: "shipping-warehouse-returns",
  path: "/proceso/embarques/retorno",
  legacyPaths: [
    "/almacen-embarques-retorno-ajax",
    "/control_proceso/almacen_embarques_retorno",
  ],
  title: "Retorno almacen embarques",
  sectionId: "proceso",
  group: "Almacén de Embarques",
  icon: Warehouse,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Almacén de Embarques",
    boton: "Retorno almacen embarques",
  },
  component: lazy(() => import("./ReturnsPage")),
};

export const shippingMovementsModule: ModuleDefinition = {
  id: "shipping-warehouse-movements",
  path: "/proceso/embarques/movimientos",
  legacyPaths: [
    "/almacen-embarques-movimientos-ajax",
    "/control_proceso/almacen_embarques_movimientos",
  ],
  title: "Modificar movimientos embarques",
  sectionId: "proceso",
  group: "Almacén de Embarques",
  icon: Warehouse,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Almacén de Embarques",
    boton: "Modificar movimientos embarques",
  },
  component: lazy(() => import("./MovementsPage")),
};

export const shippingInventoryModule: ModuleDefinition = {
  id: "shipping-warehouse-inventory",
  path: "/proceso/embarques/inventario",
  legacyPaths: [
    "/almacen-embarques-inventario-general-ajax",
    "/control_proceso/almacen_embarques_inventario_general",
  ],
  title: "Inventario general embarques",
  sectionId: "proceso",
  group: "Almacén de Embarques",
  icon: Warehouse,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Almacén de Embarques",
    boton: "Inventario general embarques",
  },
  component: lazy(() => import("./InventoryPage")),
};

export const shippingCatalogModule: ModuleDefinition = {
  id: "shipping-warehouse-catalog",
  path: "/proceso/embarques/catalogo",
  legacyPaths: [
    "/almacen-embarques-catalogo-ajax",
    "/control_proceso/almacen_embarques_catalogo",
  ],
  title: "Catálogo números de parte embarques",
  sectionId: "proceso",
  group: "Almacén de Embarques",
  icon: Warehouse,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Almacén de Embarques",
    boton: "Catálogo números de parte embarques",
  },
  component: lazy(() => import("./CatalogPage")),
};

export const shippingQaModule: ModuleDefinition = {
  id: "shipping-warehouse-qa",
  path: "/proceso/embarques/pendientes-qa",
  legacyPaths: [
    "/almacen-embarques-qa-pendientes-ajax",
    "/almacen-embarques-oqc-pendientes-ajax",
  ],
  title: "Pendientes QA Embarques",
  sectionId: "proceso",
  group: "Almacén de Embarques",
  icon: Warehouse,
  permission: {
    pagina: "LISTA_CONTROL_DE_PROCESO",
    seccion: "Almacén de Embarques",
    boton: "Pendientes QA Embarques",
  },
  component: lazy(() => import("./QaPage")),
};
