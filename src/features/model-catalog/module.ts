import { lazy } from "react";
import { Cpu, Layers } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";

/** Two screens share the catalog domain; each keeps its original Flask permission. */
export const modelCatalogModule: ModuleDefinition = {
  id: "smt-models",
  path: "/informacion-basica/modelos-smt",
  title: "Control de modelos SMT",
  sectionId: "informacion-basica",
  group: "Control de producción",
  icon: Cpu,
  permission: {
    pagina: "LISTA_INFORMACIONBASICA",
    seccion: "Control de produccion",
    boton: "Control de modelos SMT",
  },
  component: lazy(() => import("./Page")),
};
export const modelsModule: ModuleDefinition = {
  id: "models",
  path: "/informacion-basica/modelos",
  title: "Control de modelos",
  sectionId: "informacion-basica",
  group: "Control de producción",
  icon: Layers,
  permission: {
    pagina: "LISTA_INFORMACIONBASICA",
    seccion: "Control de produccion",
    boton: "Control de modelos",
  },
  component: lazy(() => import("./ModelsPage")),
};
