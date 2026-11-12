import { today, rangeIssue as dateRangeIssue } from "@/shared/lib/date";
import { text } from "@/shared/lib/text";
import { number as numeric, record } from "@/shared/lib/parse";

import type {
  BatchResult,
  Filters,
  ListResult,
  Piece,
  Stage,
  TraceRow,
  TraceView,
} from "./types";

export { today, text, numeric, record };

export const stageNames = [
  "SMT",
  "IMD",
  "Assy",
  "Vision",
  "ICT",
  "FCT",
  "Packing QA",
  "Reparacion SMD",
  "Reparacion Assy",
  "Releases OQC",
  "Embarques",
  "Scrap",
  "Entrada Exceso",
  "ICT retorno",
  "FCT retorno",
  "Packing retorno",
  "Salida Exceso (OQC)",
];
export const traceKeys: Record<TraceView, readonly string[]> = {
  por_pcb: ["pcb", "proceso"],
  materiales: [
    "proceso",
    "lot_no",
    "part_no",
    "material",
    "fecha_inicio",
    "fecha_fin",
  ],
  por_proveedor: ["proceso", "material", "fecha_inicio", "fecha_fin"],
};

function string(data: Record<string, unknown>, key: string) {
  const value = data[key];
  if (value == null) return "";
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error("El servidor devolvió un campo inválido.");
  return String(value);
}
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value))
    throw new Error("El servidor devolvió una lista inválida.");
  return value.map(parse);
}
function stage(value: unknown): Stage {
  const data = record(value);
  return {
    etapa: string(data, "etapa"),
    estado: string(data, "estado"),
    clase: string(data, "clase"),
    fecha: string(data, "fecha"),
    celda: string(data, "celda"),
    ok: data.ok === true,
  };
}
export function piece(value: unknown): Piece {
  const data = record(value);
  return {
    codigo: string(data, "codigo"),
    qr: string(data, "qr"),
    barcode: string(data, "barcode"),
    barcode_anterior: string(data, "barcode_anterior"),
    reemplazado_por: string(data, "reemplazado_por"),
    sin_barcode: data.sin_barcode === true,
    sin_qr: data.sin_qr === true,
    reconstruido: data.reconstruido === true,
    encontrado: data.encontrado !== false,
    en_exceso: data.en_exceso === true,
    estado_global: string(data, "estado_global"),
    clase_global: string(data, "clase_global"),
    registradas: numeric(data.registradas),
    total: numeric(data.total),
    ultima_etapa: string(data, "ultima_etapa"),
    ultima_fecha: string(data, "ultima_fecha"),
    etapas: list(data.etapas, stage),
  };
}
function traceRow(value: unknown): TraceRow {
  const data = record(value);
  if (
    Object.values(data).some(
      (item) =>
        item != null && !["string", "number", "boolean"].includes(typeof item),
    )
  )
    throw new Error("El servidor devolvió una celda inválida.");
  return data as TraceRow;
}
export function readList<T>(
  value: unknown,
  parse: (item: unknown) => T,
): ListResult<T> {
  const data = record(value);
  if (data.status === "error")
    throw new Error(text(data.message) || "No se pudo completar la consulta.");
  return {
    items: list(data.items, parse),
    message: string(data, "message"),
    fecha_hoy: string(data, "fecha_hoy"),
  };
}
export const traceResult = (value: unknown) => readList(value, traceRow);
export const pieceResult = (value: unknown) => readList(value, piece);
export function batchResult(value: unknown): BatchResult {
  const data = record(value);
  const parsed = readList(data, piece);
  if (
    !Array.isArray(data.etapas) ||
    data.etapas.some((item) => typeof item !== "string")
  )
    throw new Error("El servidor devolvió etapas inválidas.");
  return {
    ...parsed,
    etapas: data.etapas as string[],
    total: numeric(data.total),
    encontrados: numeric(data.encontrados),
    no_encontrados: numeric(data.no_encontrados),
  };
}
export function traceParams(view: TraceView, filters: Filters) {
  const params = new URLSearchParams();
  traceKeys[view].forEach((key) => {
    const value = (filters[key] || "").trim();
    if (value) params.set(key, value);
  });
  return params;
}
export function validateTrace(view: TraceView, filters: Filters) {
  if (view === "por_pcb" && !filters.pcb?.trim())
    return "Escanea o escribe un QR / barcode.";
  if (view === "por_proveedor" && !filters.material?.trim())
    return "Ingresa un lote de proveedor o material.";
  return dateRangeIssue(filters.fecha_inicio, filters.fecha_fin);
}
export function validateFile(file: File | null) {
  if (!file) return "Selecciona un archivo Excel.";
  if (!/\.(xlsx|xlsm)$/i.test(file.name))
    return "Selecciona un archivo .xlsx o .xlsm.";
  if (!file.size) return "El archivo está vacío.";
  if (file.size > 10 * 1024 * 1024) return "El archivo supera 10 MB.";
  return "";
}

export function pieceNotice(item: Piece) {
  if (item.reemplazado_por)
    return (
      "Este barcode fue reemplazado por " +
      item.reemplazado_por +
      ". Aquí se presenta el historial propio del barcode anterior."
    );
  if (item.barcode_anterior && !item.barcode)
    return (
      "El barcode " +
      item.barcode_anterior +
      " se reasignó a otra pieza. Consulta ese código para ver su historial. La vinculación de esta pieza está pendiente."
    );
  if (item.barcode_anterior)
    return (
      "Cambio de barcode de " +
      item.barcode_anterior +
      " a " +
      item.barcode +
      ". El historial del barcode anterior aparece en una tarjeta independiente."
    );
  if (item.sin_barcode)
    return "El QR de esta pieza está pendiente de vincular con su barcode. Las etapas identificadas por barcode figuran como indeterminadas.";
  if (item.reconstruido)
    return "Historial reconstruido desde las tablas de origen. La vinculación del barcode con su QR está pendiente.";
  return "";
}
