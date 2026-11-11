import { lazy } from "react";
import { List } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";

export const productionResultsModule: ModuleDefinition = {
  id: "production-results",
  path: "/resultados/imd-smd-terminado",
  legacyPaths: ["/control_resultados/inventario_imd_terminado"],
  title: "IMD-SMD TERMINADO",
  sectionId: "resultados",
  group: "Control de inventario",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Control de inventario",
    boton: "IMD-SMD TERMINADO",
  },
  component: lazy(() => import("./Page")),
};

export const resultsRepairSmdModule: ModuleDefinition = {
  id: "results-repair-smd",
  path: "/resultados/reparacion-smd",
  legacyPaths: ["/control_resultados/inventario_reparacion_smd"],
  title: "Inventario reparacion SMD",
  sectionId: "resultados",
  group: "Control de inventario",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Control de inventario",
    boton: "Inventario reparacion SMD",
  },
  component: lazy(() => import("./RepairSmdPage")),
};

export const resultsRepairAssyModule: ModuleDefinition = {
  id: "results-repair-assy",
  path: "/resultados/reparacion-assy",
  legacyPaths: ["/control_resultados/inventario_reparacion_assy"],
  title: "Inventario reparacion ASSY",
  sectionId: "resultados",
  group: "Control de inventario",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Control de inventario",
    boton: "Inventario reparacion ASSY",
  },
  component: lazy(() => import("./RepairAssyPage")),
};

export const resultsExcessModule: ModuleDefinition = {
  id: "results-excess",
  path: "/resultados/inventario-exceso",
  legacyPaths: ["/control_resultados/inventario_exceso"],
  title: "Inventario Exceso",
  sectionId: "resultados",
  group: "Control de inventario",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Control de inventario",
    boton: "Inventario Exceso",
  },
  component: lazy(() => import("./ExcessPage")),
};

export const resultsExcessEntriesModule: ModuleDefinition = {
  id: "results-excess-entries",
  path: "/resultados/entradas-exceso",
  legacyPaths: ["/control_resultados/inventario_exceso/entradas"],
  title: "Entradas Exceso",
  sectionId: "resultados",
  group: "Control de inventario",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Control de inventario",
    boton: "Entradas Exceso",
  },
  component: lazy(() => import("./ExcessEntriesPage")),
};

export const resultsExcessExitsModule: ModuleDefinition = {
  id: "results-excess-exits",
  path: "/resultados/salidas-exceso",
  legacyPaths: ["/control_resultados/inventario_exceso/salidas"],
  title: "Salidas Exceso",
  sectionId: "resultados",
  group: "Control de inventario",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Control de inventario",
    boton: "Salidas Exceso",
  },
  component: lazy(() => import("./ExcessExitsPage")),
};

export const resultsInputSmtModule: ModuleDefinition = {
  id: "results-input-smt",
  path: "/resultados/input-smt",
  legacyPaths: ["/control_resultados/historial_produccion_smt"],
  title: "Historial de input SMT",
  sectionId: "resultados",
  group: "Consultar resultados",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Consultar resultados",
    boton: "Historial de produccion SMT",
  },
  component: lazy(() => import("./InputSmtPage")),
};

export const resultsInputImdModule: ModuleDefinition = {
  id: "results-input-imd",
  path: "/resultados/input-imd",
  legacyPaths: ["/control_resultados/historial_produccion_imd"],
  title: "Historial de input IMD",
  sectionId: "resultados",
  group: "Consultar resultados",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Consultar resultados",
    boton: "Historial de produccion IMD",
  },
  component: lazy(() => import("./InputImdPage")),
};

export const resultsInputAssyModule: ModuleDefinition = {
  id: "results-input-assy",
  path: "/resultados/input-ensamble",
  legacyPaths: ["/control_resultados/historial_produccion_ensamble"],
  title: "Historial de input ensamble",
  sectionId: "resultados",
  group: "Consultar resultados",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Consultar resultados",
    boton: "Historial de produccion ensamble",
  },
  component: lazy(() => import("./InputAssyPage")),
};

export const resultsDisplayModule: ModuleDefinition = {
  id: "results-display",
  path: "/resultados/verificacion-display",
  legacyPaths: ["/control_resultados/historial_verificacion_display"],
  title: "Historial de verificacion display",
  sectionId: "resultados",
  group: "Consultar resultados",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Consultar resultados",
    boton: "Historial de verificacion display",
  },
  component: lazy(() => import("./DisplayPage")),
};

export const resultsMachineOperatorsModule: ModuleDefinition = {
  id: "results-machine-operators",
  path: "/resultados/operadores-maquina",
  title: "Historial de Operadores por Máquina",
  legacyPaths: ["/control_resultados/historial_operadores_maquina"],
  sectionId: "resultados",
  group: "Historial de maquinas calidad",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Historial de maquinas calidad",
    boton: "Historial de Operadores por Maquina",
  },
  component: lazy(() => import("./MachineOperatorsPage")),
};

export const resultsMachineIctModule: ModuleDefinition = {
  id: "results-machine-ict",
  path: "/resultados/maquina-ict",
  title: "Historial de maquina ICT",
  legacyPaths: [
    "/historial_ict/ajax",
    "/historial-ict",
    "/historial-ict-ajax",
    "/ict/front-full-defects2",
  ],
  sectionId: "resultados",
  group: "Historial de maquinas calidad",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Historial de maquinas calidad",
    boton: "Historial de maquina ICT",
  },
  component: lazy(() => import("./MachineIctPage")),
};

export const resultsMachineIctPassModule: ModuleDefinition = {
  id: "results-machine-ict-pass",
  path: "/resultados/ict-pass-fail",
  title: "Historial de maquina ICT % Pass/Fail",
  legacyPaths: [
    "/historial_ict_pass_fail/ajax",
    "/historial-maquina-ict-pass-fail",
    "/historial-maquina-ict-pass-fail-ajax",
  ],
  sectionId: "resultados",
  group: "Historial de maquinas calidad",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Historial de maquinas calidad",
    boton: "Historial de maquina ICT % Pass/Fail",
  },
  component: lazy(() => import("./MachineIctPassPage")),
};

export const resultsMachineFctModule: ModuleDefinition = {
  id: "results-machine-fct",
  path: "/resultados/maquina-fct",
  title: "Historial de maquina FCT",
  legacyPaths: ["/historial_fct/ajax", "/historial-fct", "/historial-fct-ajax"],
  sectionId: "resultados",
  group: "Historial de maquinas calidad",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Historial de maquinas calidad",
    boton: "Historial de maquina FCT",
  },
  component: lazy(() => import("./MachineFctPage")),
};

export const resultsMachineFctPassModule: ModuleDefinition = {
  id: "results-machine-fct-pass",
  path: "/resultados/fct-pass-fail",
  title: "Historial de maquina FCT % Pass/Fail",
  legacyPaths: [
    "/historial_fct_pass_fail/ajax",
    "/historial-maquina-fct-pass-fail",
    "/historial-maquina-fct-pass-fail-ajax",
  ],
  sectionId: "resultados",
  group: "Historial de maquinas calidad",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Historial de maquinas calidad",
    boton: "Historial de maquina FCT % Pass/Fail",
  },
  component: lazy(() => import("./MachineFctPassPage")),
};

export const resultsMachineChangesModule: ModuleDefinition = {
  id: "results-machine-changes",
  path: "/resultados/cambios-parametros-ict",
  title: "Historial de cambios de parametros ICT",
  legacyPaths: [
    "/historial_cambios_parametros_ict/ajax",
    "/historial-cambios-parametros-ict-ajax",
  ],
  sectionId: "resultados",
  group: "Historial de maquinas calidad",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Historial de maquinas calidad",
    boton: "Historial de cambios de parametros ICT",
  },
  component: lazy(() => import("./MachineChangesPage")),
};

export const resultsMachineVisionModule: ModuleDefinition = {
  id: "results-machine-vision",
  path: "/resultados/maquina-vision",
  title: "Historial de maquina vision",
  legacyPaths: [
    "/historial_vision/ajax",
    "/historial-vision",
    "/historial-vision-ajax",
  ],
  sectionId: "resultados",
  group: "Historial de maquinas calidad",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Historial de maquinas calidad",
    boton: "Historial de maquina vision",
  },
  component: lazy(() => import("./MachineVisionPage")),
};

export const resultsMachineVisionPassModule: ModuleDefinition = {
  id: "results-machine-vision-pass",
  path: "/resultados/vision-pass-fail",
  title: "Historial de maquina Vision % Pass/Fail",
  legacyPaths: [
    "/historial_vision_pass_fail/ajax",
    "/historial-vision-pass-fail",
    "/historial-vision-pass-fail-ajax",
  ],
  sectionId: "resultados",
  group: "Historial de maquinas calidad",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Historial de maquinas calidad",
    boton: "Historial de maquina Vision % Pass/Fail",
  },
  component: lazy(() => import("./MachineVisionPassPage")),
};

export const resultsMachineElectricalModule: ModuleDefinition = {
  id: "results-machine-electrical",
  path: "/resultados/prueba-electrica",
  title: "Historial de prueba electrica",
  legacyPaths: ["/control_resultados/historial_prueba_electrica"],
  sectionId: "resultados",
  group: "Historial de maquinas calidad",
  icon: List,
  permission: {
    pagina: "LISTA_DE_CONTROL_DE_RESULTADOS",
    seccion: "Historial de maquinas calidad",
    boton: "Historial de prueba electrica",
  },
  component: lazy(() => import("./MachineElectricalPage")),
};
