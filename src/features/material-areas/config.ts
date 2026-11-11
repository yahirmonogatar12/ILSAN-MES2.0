import type { Area, AreaView, ColumnSpec } from "./types";
export const AREA_CONFIG: Record<
  Area,
  { title: string; inventories: readonly { value: string; label: string }[] }
> = {
  smd: {
    title: "SMD",
    inventories: [{ value: "inventario", label: "Inventario" }],
  },
  micom: {
    title: "Micom",
    inventories: [
      { value: "inventario", label: "Inventario virgen" },
      { value: "inventario_chamber", label: "Inventario chamber" },
    ],
  },
  imd: {
    title: "IMD",
    inventories: [{ value: "inventario", label: "Inventario" }],
  },
  assy: { title: "ASSY", inventories: [] },
  ipm: {
    title: "IPM",
    inventories: [
      { value: "inventario", label: "Inventario virgen" },
      { value: "inventario_completo", label: "Inventario completo" },
    ],
  },
};
export const NUMERIC_COLUMNS = new Set([
  "cantidad",
  "entrada",
  "salida",
  "stock",
  "lotes",
  "lotes_con_stock",
]);
export const COLUMNS: Record<AreaView, readonly ColumnSpec[]> = {
  entradas: [
    ["fecha", "FECHA", 95],
    ["hora", "HORA", 75],
    ["codigo", "CÓDIGO", 170],
    ["part_no", "PART NO", 135],
    ["lote", "LOTE", 130],
    ["cantidad", "CANTIDAD", 85],
    ["unidad", "UNIDAD", 65],
    ["ubicacion", "UBICACIÓN", 95],
    ["cliente", "CLIENTE", 80],
    ["especificacion", "ESPECIFICACIÓN", 240],
    ["usuario", "USUARIO", 125],
  ],
  salidas: [
    ["fecha", "FECHA", 95],
    ["hora", "HORA", 75],
    ["codigo", "CÓDIGO", 170],
    ["part_no", "PART NO", 135],
    ["lote", "LOTE", 130],
    ["cantidad", "CANTIDAD", 85],
    ["unidad", "UNIDAD", 65],
    ["modelo", "MODELO", 100],
    ["depto", "DEPTO", 85],
    ["proceso", "PROCESO", 100],
    ["linea", "LÍNEA", 70],
    ["usuario", "USUARIO", 125],
  ],
  inventario: [
    ["part_no", "PART NO", 135],
    ["lote", "LOTE", 130],
    ["codigo", "CÓDIGO", 170],
    ["entrada", "ENTRADA", 85],
    ["salida", "SALIDA", 85],
    ["stock", "STOCK", 100],
    ["unidad", "UNIDAD", 65],
    ["ubicacion", "UBICACIÓN", 95],
    ["fecha_recibo", "FECHA RECIBO", 110],
    ["especificacion", "ESPECIFICACIÓN", 240],
  ],
  inventario_general: [
    ["part_no", "PART NO", 135],
    ["especificacion", "ESPECIFICACIÓN", 240],
    ["unidad", "UNIDAD", 65],
    ["stock", "STOCK TOTAL", 100],
    ["lotes", "LOTES DISTINTOS", 100],
    ["lotes_con_stock", "ETIQUETAS CON STOCK", 145],
  ],
  inventario_chamber: [
    ["lote_chamber", "LOTE CHAMBER", 200],
    ["programacion", "PROGRAMACIÓN", 180],
    ["part_no", "PART NO", 135],
    ["especificacion", "ESPECIFICACIÓN", 240],
    ["stock", "STOCK", 100],
    ["fecha_recibo", "FECHA CREACIÓN", 110],
    ["usuario", "USUARIO", 125],
  ],
  inventario_chamber_general: [
    ["programacion", "PROGRAMACIÓN", 180],
    ["part_no", "PART NO", 135],
    ["especificacion", "ESPECIFICACIÓN", 240],
    ["stock", "STOCK TOTAL", 100],
    ["lotes", "LOTES DISTINTOS", 100],
    ["lotes_con_stock", "LOTES CON STOCK", 145],
  ],
  inventario_completo: [
    ["lote_completo", "LOTE COMPLETO", 200],
    ["programacion", "PART NO IPM", 180],
    ["especificacion", "ESPECIFICACIÓN", 240],
    ["stock", "STOCK", 100],
    ["fecha_recibo", "FECHA CREACIÓN", 110],
    ["usuario", "USUARIO", 125],
  ],
  inventario_completo_general: [
    ["programacion", "PART NO IPM", 180],
    ["especificacion", "ESPECIFICACIÓN", 240],
    ["stock", "STOCK TOTAL", 100],
    ["lotes", "LOTES DISTINTOS", 100],
    ["lotes_con_stock", "LOTES CON STOCK", 145],
  ],
};
