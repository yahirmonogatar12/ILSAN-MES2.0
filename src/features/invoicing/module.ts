import { lazy } from "react";
import {
  FileSpreadsheet,
  Ship,
  BadgeDollarSign,
  ShoppingCart,
} from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";
export const invoicingModule: ModuleDefinition = {
  id: "warehouse-invoices",
  path: "/material/invoice-almacen",
  legacyPaths: ["/material/invoices", "/material/invoices/ALMACEN"],
  title: "Invoice Almacén",
  sectionId: "material",
  group: "Facturas",
  icon: FileSpreadsheet,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Control de material",
    boton: "Facturas / Invoice",
  },
  component: lazy(() => import("./Page")),
};
export const shippingInvoicesModule: ModuleDefinition = {
  id: "shipping-invoices",
  path: "/material/invoice-embarques",
  legacyPaths: ["/material/invoices/EMBARQUES"],
  title: "Invoice Embarques",
  sectionId: "material",
  group: "Facturas",
  icon: Ship,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Control de material",
    boton: "Invoice Embarques",
  },
  component: lazy(() => import("./ShippingPage")),
};
export const valuationModule: ModuleDefinition = {
  id: "inventory-valuation",
  path: "/material/valorizacion-inventario",
  legacyPaths: ["/material/inventory_valuation"],
  title: "Valorización de inventario",
  sectionId: "material",
  group: "Facturas",
  icon: BadgeDollarSign,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Control de material",
    boton: "Valorización de inventario",
  },
  component: lazy(() => import("./ValuationPage")),
};
export const purchasesModule: ModuleDefinition = {
  id: "purchases",
  path: "/material/lista-compras",
  legacyPaths: ["/material/compras"],
  title: "Lista de compras",
  sectionId: "material",
  group: "Facturas",
  icon: ShoppingCart,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Control de material",
    boton: "Lista de compras",
  },
  component: lazy(() => import("./PurchasesPage")),
};
