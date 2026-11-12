import {
  today,
  validDate,
  rangeIssue as dateRangeIssue,
} from "@/shared/lib/date";
import { number, record as object } from "@/shared/lib/parse";
import { text } from "@/shared/lib/text";

import type {
  ColumnSpec,
  HistoryConfig,
  HistoryFilters,
  HistoryKind,
  Row,
  StationDraft,
  StationFilters,
} from "./types";

export { today, number, text, object };

const col = (key: string, title: string, width: number): ColumnSpec => ({
  key,
  title,
  width,
});
const dates = [
  { key: "fecha_desde", title: "Fecha desde", type: "date" },
  { key: "fecha_hasta", title: "Fecha hasta", type: "date" },
] as const;
const line = {
  key: "linea",
  title: "Línea",
  type: "select",
  optionsKey: "linea",
} as const;
const shift = {
  key: "turno",
  title: "Turno",
  type: "select",
  optionsKey: "turno",
} as const;
const materialColumns = [
  col("fecha", "Fecha", 92),
  col("hora", "Hora", 80),
  col("linea", "Línea", 80),
  col("tipo", "Tipo", 70),
  col("contenedor", "Contenedor", 140),
  col("material", "Material", 125),
  col("posicion", "Posición", 100),
  col("lote_proveedor", "Lote proveedor", 130),
];
const materialTail = [
  col("proveedor", "Proveedor", 105),
  col("spec", "Spec", 165),
  col("qty", "Qty", 70),
  col("resultado", "Resultado", 100),
];
const materialFilters = [
  ...dates,
  line,
  { key: "material", title: "Material", type: "search" },
  {
    key: "resultado",
    title: "Resultado",
    type: "select",
    options: ["OK", "NG", "EQUIV"],
  },
  { key: "contenedor", title: "Contenedor", type: "search" },
] as const;
const toolingColumns = [
  col("fecha", "Fecha", 95),
  col("turno", "Turno", 80),
  col("linea", "Línea", 80),
];
const toolingTail = [
  col("lote", "Lote", 140),
  col("parte", "No. parte", 130),
  col("modelo", "Modelo", 125),
  col("plan", "Plan", 75),
  col("usos", "Usos planeados", 110),
  col("origen", "Origen", 90),
  col("asignado", "Asignado", 160),
];
const toolingFilters = (title: string) => [
  ...dates,
  line,
  shift,
  { key: "codigo", title, type: "search" as const },
  { key: "busqueda", title: "Lote / parte / modelo", type: "search" as const },
];

export const histories: Record<HistoryKind, HistoryConfig> = {
  smt: {
    title: "Historial de cambio de material de SMT",
    endpoint: "/api/smt-historial",
    filename: "historial_cambio_material_smt",
    minWidth: 1280,
    columns: [
      col("fecha", "Fecha", 95),
      col("hora", "Hora", 80),
      col("linea", "Línea", 75),
      col("maquina", "Máquina", 85),
      col("slot", "Slot", 65),
      col("feeder", "Feeder", 80),
      col("resultado", "Resultado", 90),
      col("parte", "Parte", 115),
      col("cantidad", "Cantidad", 85),
      col("lote", "Lote", 100),
      col("barcode", "Barcode", 175),
      col("barcode_anterior", "Barcode anterior", 175),
      col("seq", "SEQ", 75),
      col("vendor", "Vendor", 90),
      col("archivo", "Archivo", 155),
    ],
    filters: [
      ...dates,
      { ...line, optionsKey: "lineas" },
      {
        key: "maquina",
        title: "Máquina",
        type: "select",
        optionsKey: "maquinas",
      },
      { key: "parte", title: "No. parte", type: "search" },
      {
        key: "resultado",
        title: "Resultado",
        type: "select",
        options: ["OK", "NG"],
      },
      { key: "barcode_like", title: "Barcode", type: "search" },
    ],
  },
  imd: {
    title: "Historial de cambio de material de IMD",
    endpoint: "/api/historial-material/imd",
    filename: "historial_material_imd",
    minWidth: 1090,
    columns: [...materialColumns, ...materialTail],
    filters: materialFilters,
  },
  assy: {
    title: "Historial de cambio de material de ASSY",
    endpoint: "/api/historial-material/assy",
    filename: "historial_material_assy",
    minWidth: 1170,
    columns: [
      ...materialColumns,
      col("ubicacion", "Ubicación", 115),
      ...materialTail,
    ],
    filters: materialFilters,
  },
  pasta: {
    title: "Historial de uso de pegamento de soldadura",
    endpoint: "/api/historial-sub-material/pasta",
    filename: "historial_sub_material_pasta",
    minWidth: 1410,
    columns: [
      col("codigo", "Código material", 160),
      col("parte", "No. parte", 130),
      col("lote", "Lote", 110),
      col("ciclo", "Ciclo", 65),
      col("estado", "Estado", 100),
      col("linea", "Línea", 80),
      col("sacado_frio", "Sacado de frío", 165),
      col("listo_ambiente", "Listo ambiente", 165),
      col("agitado", "Agitación lista", 165),
      col("en_linea", "En línea", 165),
      col("expira", "Expira", 165),
      col("consumido", "Consumido", 165),
      col("cantidad", "Cantidad", 80),
      col("unidad", "Unidad", 70),
      col("operador", "Operador", 110),
    ],
    filters: [
      ...dates,
      line,
      { key: "estado", title: "Estado", type: "select", optionsKey: "estado" },
      { key: "codigo", title: "Código material", type: "search" },
      { key: "busqueda", title: "Código / parte / lote", type: "search" },
    ],
  },
  mask: {
    title: "Historial de uso de mask de metal",
    endpoint: "/api/historial-sub-material/mask",
    filename: "historial_sub_material_mask",
    minWidth: 1090,
    columns: [
      ...toolingColumns,
      col("mask", "Metal mask", 145),
      ...toolingTail,
    ],
    filters: toolingFilters("Código de mask"),
  },
  squeegee: {
    title: "Historial de uso de squeegee",
    endpoint: "/api/historial-sub-material/squeegee",
    filename: "historial_sub_material_squeegee",
    minWidth: 1190,
    columns: [
      ...toolingColumns,
      col("squeegee", "Squeegee", 140),
      col("squeegee_2", "Squeegee 2", 140),
      ...toolingTail,
    ],
    filters: toolingFilters("Código de squeegee"),
  },
  interlock: {
    title: "Paros de interlock",
    endpoint: "/api/process-interlock",
    filename: "process_interlock_history",
    minWidth: 1280,
    columns: [
      col("fecha", "Fecha", 95),
      col("turno", "Turno", 80),
      col("linea", "Línea", 80),
      col("modo", "Modo", 90),
      col("detectado", "Detectado", 165),
      col("liberado", "Liberado", 165),
      col("duracion", "Duración", 100),
      col("motivo", "Motivo", 140),
      col("cierre", "Cierre", 125),
      col("detalle", "Detalle", 230),
      col("lote", "Lote", 140),
      col("parte", "No. parte", 130),
      col("ciclo", "Ciclo", 110),
    ],
    filters: [
      ...dates,
      line,
      shift,
      { key: "modo", title: "Modo", type: "select", optionsKey: "modo" },
      { key: "motivo", title: "Motivo", type: "select", optionsKey: "motivo" },
      {
        key: "min_seg",
        title: "Duración mín. (s)",
        type: "number",
        min: 0,
        step: "any",
      },
      { key: "busqueda", title: "Detalle / lote / parte", type: "search" },
      {
        key: "incluir_cortos",
        title: "Incluir detecciones menores a 3 s",
        type: "checkbox",
      },
    ],
  },
  vision: {
    title: "Escáner ICT",
    endpoint: "/api/process-interlock/vision",
    filename: "rechazos_escaner_ict",
    minWidth: 1050,
    columns: [
      col("hora", "Fecha / hora", 165),
      col("estacion", "Estación", 110),
      col("linea", "Línea", 80),
      col("codigo", "Código", 180),
      col("tipo", "Tipo", 135),
      col("motivo", "Motivo", 240),
      col("maquina", "Máquina Vision", 135),
      col("inspeccion", "Última inspección", 165),
    ],
    filters: [
      ...dates,
      line,
      {
        key: "estacion",
        title: "Estación",
        type: "select",
        optionsKey: "estacion",
      },
      { key: "tipo", title: "Tipo", type: "select", optionsKey: "tipo" },
      { key: "busqueda", title: "Código / motivo", type: "search" },
    ],
  },
};

export function rows(value: unknown): Row[] {
  if (!Array.isArray(value))
    throw new Error("El servidor no devolvió una lista válida.");
  return value.map(object);
}

export function id(value: unknown) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1)
    throw new Error("El identificador del registro no es válido.");
  return result;
}

export function defaultFilters(kind: HistoryKind): HistoryFilters {
  const date = today();
  return Object.fromEntries(
    histories[kind].filters.map(({ key }) => [
      key,
      key === "fecha_desde" || key === "fecha_hasta"
        ? date
        : key === "incluir_cortos"
          ? "0"
          : "",
    ]),
  );
}

export function filterIssue(filters: HistoryFilters) {
  if (!validDate(filters.fecha_desde) || !validDate(filters.fecha_hasta))
    return "Selecciona ambas fechas.";
  const issue = dateRangeIssue(filters.fecha_desde, filters.fecha_hasta);
  if (issue) return issue;
  if (
    filters.min_seg?.trim() &&
    (!Number.isFinite(Number(filters.min_seg)) || Number(filters.min_seg) < 0)
  )
    return "La duración mínima debe ser un número mayor o igual a cero.";
  return "";
}
export function decodeSearches(
  kind: HistoryKind,
  value: unknown,
): HistoryFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Row;
  return Object.fromEntries(
    histories[kind].columns.flatMap(({ key }) =>
      typeof source[key] === "string" && source[key].trim()
        ? [[key, source[key].trim()]]
        : [],
    ),
  );
}
export function historyParams(
  kind: HistoryKind,
  filters: HistoryFilters,
  searches: HistoryFilters,
) {
  const issue = filterIssue(filters);
  if (issue) throw new Error(issue);
  const params = new URLSearchParams();
  for (const { key } of histories[kind].filters) {
    if (filters[key]?.trim()) params.set(key, filters[key].trim());
  }
  for (const [key, value] of Object.entries(decodeSearches(kind, searches)))
    params.set("cf_" + key, value);
  return params;
}
export const stationTypes = ["ICT", "FCT", "Packing"] as const;
export function stationParams(filters: StationFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim().slice(0, 80));
  if (stationTypes.some((type) => type === filters.station_type))
    params.set("station_type", filters.station_type);
  return params;
}
export function stationIssues(draft: StationDraft) {
  return [
    ...(!draft.station_code.trim()
      ? ["El código de estación es obligatorio."]
      : []),
    ...(!draft.station_name.trim()
      ? ["El nombre de estación es obligatorio."]
      : []),
    ...(!stationTypes.includes(draft.station_type)
      ? ["Selecciona ICT, FCT o Packing."]
      : []),
    ...(draft.station_code.length > 32 ||
    draft.station_name.length > 128 ||
    draft.host_name.length > 128
      ? ["El código admite 32 caracteres. El nombre y la línea admiten 128."]
      : []),
  ];
}
