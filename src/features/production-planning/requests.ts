import {
  isRecord,
  positiveIntegerList,
  requiredText,
  requiredNumber,
} from "@/shared/lib/parse";
import { text } from "./model";
import type { Action, ActionPayloads, Row } from "./types";

/** Dynamic form boundaries validate required fields before reaching the typed API. */
export const actionPayloads: {
  [A in Action]: (value: Row) => ActionPayloads[A];
} = {
  "create-po": (values) => ({
    ...values,
    nombre_po: requiredText(values.nombre_po, "nombre_po"),
    modelo: requiredText(values.modelo, "modelo"),
    cliente: requiredText(values.cliente, "cliente"),
    fecha_registro: requiredText(values.fecha_registro, "fecha_registro"),
    total_cantidad_entregada: requiredNumber(
      values.total_cantidad_entregada,
      "total_cantidad_entregada",
    ),
    cantidad_entregada: Number(values.cantidad_entregada ?? 0),
  }),
  "create-wo": (values) => ({
    ...values,
    modelo: requiredText(values.modelo, "modelo"),
    cantidad_planeada: requiredNumber(
      values.cantidad_planeada,
      "cantidad_planeada",
    ),
    fecha_operacion: requiredText(values.fecha_operacion, "fecha_operacion"),
  }),
  "update-wo": (values) => ({
    ...values,
    codigo_wo: requiredText(values.codigo_wo, "codigo_wo"),
    modelo: requiredText(values.modelo, "modelo"),
    cantidad_planeada: requiredNumber(
      values.cantidad_planeada,
      "cantidad_planeada",
    ),
  }),
  "delete-wo": (values) => ({
    ...values,
    codigo_wo: requiredText(values.codigo_wo, "codigo_wo"),
  }),
  "state-wo": (values) => ({
    ...values,
    codigo_wo: requiredText(values.codigo_wo, "codigo_wo"),
    estado: requiredText(values.estado, "estado"),
  }),
  "link-wo": (values) => ({
    ...values,
    codigo_wo: requiredText(values.codigo_wo, "codigo_wo"),
    codigo_po: requiredText(values.codigo_po, "codigo_po"),
  }),
  "import-wos": (values) => ({
    ...values,
    wo_ids: positiveIntegerList(
      values.wo_ids,
      "La selección de WO no es valuesálida.",
    ),
    import_date: requiredText(values.import_date, "import_date"),
  }),
  schedule: (values) => ({
    ...values,
    part_no: requiredText(values.part_no, "part_no"),
    sched_date: requiredText(values.sched_date, "sched_date"),
    sched_qty:
      values.sched_qty == null
        ? null
        : requiredNumber(values.sched_qty, "sched_qty"),
    linea: text(values.linea),
    turno: text(values.turno),
  }),
  "inventory-field": (values) => ({
    ...values,
    part_no: requiredText(values.part_no, "part_no"),
    field: requiredText(values.field, "field"),
    value: requiredNumber(values.value, "value"),
  }),
  propose: (values) => ({
    ...values,
    date_from: requiredText(values.date_from, "date_from"),
    date_to: requiredText(values.date_to, "date_to"),
  }),
  "apply-proposal": (values) => {
    if (!Array.isArray(values.items))
      throw new Error("La propuesta no contiene ítems.");
    return {
      ...values,
      proposal_id: requiredText(values.proposal_id, "proposal_id"),
      version: requiredNumber(values.version, "version"),
      items: values.items.map((item: unknown) => {
        if (!isRecord(item))
          throw new Error("La propuesta contiene un ítem inválido.");
        return {
          ...item,
          item_id: requiredText(item.item_id, "item_id"),
          included: item.included !== false,
          sched_date: requiredText(item.sched_date, "sched_date"),
          linea: text(item.linea),
          turno: text(item.turno),
          qty: requiredNumber(item.qty, "qty"),
        };
      }),
    };
  },
  "reject-proposal": (values) => ({
    ...values,
    proposal_id: requiredText(values.proposal_id, "proposal_id"),
    version: requiredNumber(values.version, "version"),
    reason_code: text(values.reason_code),
    reason_text: text(values.reason_text),
  }),
  generate: (values) => ({
    ...values,
    fecha: requiredText(values.fecha, "fecha"),
  }),
  "generate-faltantes": (values) => ({
    ...values,
    fecha: requiredText(values.fecha, "fecha"),
  }),
  "generate-schedule": (values) => ({
    ...values,
    fecha: requiredText(values.fecha, "fecha"),
  }),
  "acomodar-ia": (values) => ({
    ...values,
    fecha: requiredText(values.fecha, "fecha"),
  }),
  "confirm-lots": (values) => ({
    ...values,
    fecha: requiredText(values.fecha, "fecha"),
  }),
  "config-lines": (values) => ({
    ...values,
    lineas: requiredText(values.lineas, "lineas"),
  }),
  "add-lot": (values) => ({
    ...values,
    fecha: requiredText(values.fecha, "fecha"),
    part_no: requiredText(values.part_no, "part_no"),
    qty: requiredNumber(values.qty, "qty"),
    linea: text(values.linea),
  }),
  "update-lot": (values) => ({
    ...values,
    id: requiredNumber(values.id, "id"),
    field: requiredText(values.field, "field"),
    value: values.value,
  }),
  "delete-lot": (values) => ({
    ...values,
    id: requiredNumber(values.id, "id"),
  }),
};
