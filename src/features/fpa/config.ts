import type { PermissionRule } from "@/core/auth/types";
import type { Filters } from "./types";
export const FPA_VIEW: PermissionRule = {
  pagina: "LISTA_INFORMACIONBASICA",
  seccion: "Control de produccion",
  boton: "Control de FPA",
};
export const FPA_CREATE: PermissionRule = {
  ...FPA_VIEW,
  boton: "Solicitar etiquetas FPA",
};
export const FPA_ADJUST: PermissionRule = {
  ...FPA_VIEW,
  boton: "Ajustar cantidades FPA",
};
export const DEFAULT_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  folio: "",
  fpaPartNumber: "",
  requester: "",
  status: "",
};
export const STATUSES = ["PENDIENTE", "PARCIAL", "COMPLETADA", "CANCELADA"];
