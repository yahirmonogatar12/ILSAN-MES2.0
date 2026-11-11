import type { PermissionRule } from "@/core/auth/types";
import type { BomFilters, EcoFilters } from "./types";
export const BOM_VIEW: PermissionRule = {
  pagina: "LISTA_INFORMACIONBASICA",
  seccion: "Control de produccion",
  boton: "Control de BOM",
};
export const ECO_CREATE: PermissionRule = { ...BOM_VIEW, boton: "Crear ECO" };
export const ECO_APPROVE: PermissionRule = {
  ...BOM_VIEW,
  boton: "Aprobar ECO",
};
export const DEFAULT_FILTERS: BomFilters = {
  modelo: "",
  classification: "TODOS",
  bom_revision: "",
};
export const ECO_FILTERS: EcoFilters = {
  status: "",
  part_no: "",
  origen: "",
  eco_no: "",
  date_from: "",
  date_to: "",
};
