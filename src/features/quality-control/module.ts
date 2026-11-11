import { lazy } from "react";
import { List } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";

export const qualityControlModule: ModuleDefinition = {
  id: "quality-control",
  path: "/calidad/maquinas",
  legacyPaths: ["/control_calidad/stations_qa"],
  title: "Control de maquinas de calidad",
  sectionId: "calidad",
  group: "Control de maquinas",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Control de maquinas",
    boton: "Control de maquinas de calidad",
  },
  component: lazy(() => import("./Page")),
};

export const qualitySmtModule: ModuleDefinition = {
  id: "quality-smt",
  path: "/calidad/material-smt",
  legacyPaths: [
    "/historial-cambio-material-smt-ajax",
    "/historial-cambio-material-smt",
    "/smt/historial",
  ],
  title: "Historial de cambio de material de SMT",
  sectionId: "calidad",
  group: "Historial de material",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Historial de material",
    boton: "Historial de cambio de material de SMT",
  },
  component: lazy(() => import("./SmtPage")),
};

export const qualityImdModule: ModuleDefinition = {
  id: "quality-imd",
  path: "/calidad/material-imd",
  legacyPaths: ["/historial-material/imd/ajax"],
  title: "Historial de cambio de material de IMD",
  sectionId: "calidad",
  group: "Historial de material",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Historial de material",
    boton: "Historial de cambio de material de IMD",
  },
  component: lazy(() => import("./ImdPage")),
};

export const qualityAssyModule: ModuleDefinition = {
  id: "quality-assy",
  path: "/calidad/material-assy",
  legacyPaths: ["/historial-material/assy/ajax"],
  title: "Historial de cambio de material de ASSY",
  sectionId: "calidad",
  group: "Historial de material",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Historial de material",
    boton: "Historial de cambio de material de ASSY",
  },
  component: lazy(() => import("./AssyPage")),
};

export const qualityPasteModule: ModuleDefinition = {
  id: "quality-paste",
  path: "/calidad/uso-pasta",
  legacyPaths: ["/historial-uso-pegamento-soldadura-ajax"],
  title: "Historial de uso de pegamento de soldadura",
  sectionId: "calidad",
  group: "Historial de Sub Material",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Historial de Sub Material",
    boton: "Historial de uso de pegamento de soldadura",
  },
  component: lazy(() => import("./PastePage")),
};

export const qualityMaskModule: ModuleDefinition = {
  id: "quality-mask",
  path: "/calidad/uso-mask",
  legacyPaths: ["/historial-uso-mask-metal-ajax"],
  title: "Historial de uso de mask de metal",
  sectionId: "calidad",
  group: "Historial de Sub Material",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Historial de Sub Material",
    boton: "Historial de uso de mask de metal",
  },
  component: lazy(() => import("./MaskPage")),
};

export const qualitySqueegeeModule: ModuleDefinition = {
  id: "quality-squeegee",
  path: "/calidad/uso-squeegee",
  legacyPaths: ["/historial-uso-squeegee-ajax"],
  title: "Historial de uso de squeegee",
  sectionId: "calidad",
  group: "Historial de Sub Material",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Historial de Sub Material",
    boton: "Historial de uso de squeegee",
  },
  component: lazy(() => import("./SqueegeePage")),
};

export const qualityInterlockModule: ModuleDefinition = {
  id: "quality-interlock",
  path: "/calidad/interlock",
  legacyPaths: ["/process-interlock-history-ajax"],
  title: "Process interlock History",
  sectionId: "calidad",
  group: "Interlock History",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Interlock History",
    boton: "Process interlock History",
  },
  component: lazy(() => import("./InterlockPage")),
};

export const qualityLqcReleaseModule: ModuleDefinition = {
  id: "quality-lqc-release",
  path: "/calidad/liberacion-lqc",
  legacyPaths: [
    "/historial_liberacion_lqc/ajax",
    "/historial-liberacion-lqc-ajax",
  ],
  title: "Historial de liberacion LQC",
  sectionId: "calidad",
  group: "Inspeccion de calidad",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Inspeccion de calidad",
    boton: "Historial de liberacion LQC",
  },
  component: lazy(() => import("./LqcReleasePage")),
};

export const qualityOqcReleaseModule: ModuleDefinition = {
  id: "quality-oqc-release",
  path: "/calidad/liberacion-oqc",
  legacyPaths: [
    "/historial_liberacion_oqc/ajax",
    "/historial-liberacion-oqc-ajax",
  ],
  title: "Historial de liberacion OQC",
  sectionId: "calidad",
  group: "Inspeccion de calidad",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "Inspeccion de calidad",
    boton: "Historial de liberacion OQC",
  },
  component: lazy(() => import("./OqcReleasePage")),
};

export const qualityLqcPpmModule: ModuleDefinition = {
  id: "quality-lqc-ppm",
  path: "/calidad/ppm-lqc",
  legacyPaths: ["/control_calidad/ppms/lqc"],
  title: "PPM's LQC",
  sectionId: "calidad",
  group: "PPM's",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "PPM's",
    boton: "PPM's LQC",
  },
  component: lazy(() => import("./LqcPpmPage")),
};

export const qualityOqcPpmModule: ModuleDefinition = {
  id: "quality-oqc-ppm",
  path: "/calidad/ppm-oqc",
  legacyPaths: ["/control_calidad/ppms/oqc"],
  title: "PPM's OQC",
  sectionId: "calidad",
  group: "PPM's",
  icon: List,
  permission: {
    pagina: "LISTA_CONTROL_DE_CALIDAD",
    seccion: "PPM's",
    boton: "PPM's OQC",
  },
  component: lazy(() => import("./OqcPpmPage")),
};
