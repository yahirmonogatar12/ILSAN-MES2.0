import { lazy } from "react";
import { Boxes } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";
export const materialAreasModule: ModuleDefinition = {
  id: "area-material-smd",
  path: "/material/smd",
  title: "Control de material SMD",
  sectionId: "material",
  group: "Material por áreas",
  icon: Boxes,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Material por áreas",
    boton: "Control de material SMD",
  },
  component: lazy(() => import("./Page")),
};
export const micomMaterialsModule: ModuleDefinition = {
  id: "area-material-micom",
  path: "/material/micom",
  title: "Control de material Micom",
  sectionId: "material",
  group: "Material por áreas",
  icon: Boxes,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Material por áreas",
    boton: "Control de material Micom",
  },
  component: lazy(() => import("./MicomPage")),
};
export const imdMaterialsModule: ModuleDefinition = {
  id: "area-material-imd",
  path: "/material/imd",
  title: "Control de material IMD",
  sectionId: "material",
  group: "Material por áreas",
  icon: Boxes,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Material por áreas",
    boton: "Control de material IMD",
  },
  component: lazy(() => import("./ImdPage")),
};
export const assyMaterialsModule: ModuleDefinition = {
  id: "area-material-assy",
  path: "/material/assy",
  title: "Control de material ASSY",
  sectionId: "material",
  group: "Material por áreas",
  icon: Boxes,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Material por áreas",
    boton: "Control de material ASSY",
  },
  component: lazy(() => import("./AssyPage")),
};
export const ipmMaterialsModule: ModuleDefinition = {
  id: "area-material-ipm",
  path: "/material/ipm",
  title: "Control de material IPM",
  sectionId: "material",
  group: "Material por áreas",
  icon: Boxes,
  permission: {
    pagina: "LISTA_DE_MATERIALES",
    seccion: "Material por áreas",
    boton: "Control de material IPM",
  },
  component: lazy(() => import("./IpmPage")),
};
