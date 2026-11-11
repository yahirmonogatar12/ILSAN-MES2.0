import type { FilterField } from "@/shared/ui";
import { today } from "./model";
import type { ColumnSpec, Filters, ViewSpec } from "./types";

export const col = (
  key: string,
  title: string,
  width = 100,
  numeric = false,
): ColumnSpec => ({ key, title, width, numeric });
export const field = (
  key: string,
  label: string,
  type: FilterField<Filters>["type"] = "text",
): FilterField<Filters> => ({ key, label, type });
export const select = (
  key: string,
  label: string,
  values: string[],
): FilterField<Filters> => ({
  key,
  label,
  type: "select",
  options: [
    { value: "", label: "Todos" },
    ...values.map((value) => ({ value, label: value })),
  ],
});
const process = select("proceso", "Proceso", ["SMD", "IMD", "ASSY"]);
const part = field("numero_parte", "Parte o modelo", "search");
const repairDates = [
  field("fecha_inicio", "Fecha desde", "date"),
  field("fecha_fin", "Fecha hasta", "date"),
];
const stockColumns = [
  col("pcb_part_no", "No. parte", 150),
  col("modelo", "Modelo", 170),
  col("proceso", "Proceso", 80),
  col("total_entrada", "Entrada", 90, true),
  col("total_salida", "Salida", 90, true),
  col("total_scrap", "Scrap", 90, true),
  col("stock_actual", "Stock actual", 100, true),
];
const movementColumns = [
  col("inventory_date", "Fecha", 105),
  col("hora", "Hora", 85),
  col("tipo_movimiento", "Tipo", 95),
  col("scanned_original", "QR escaneado", 230),
  col("pcb_part_no", "No. parte", 140),
  col("modelo", "Modelo", 140),
  col("proceso", "Proceso", 80),
  col("defect_type", "Defecto", 130),
  col("component_location", "Ubic. componente", 110),
  col("etapa_deteccion", "Etapa detección", 105),
  col("qty", "Cantidad", 75, true),
  col("array_count", "Array", 65, true),
  col("scanned_by", "Usuario", 105),
  col("comentarios", "Comentarios", 200),
];
export function view(
  id: string,
  title: string,
  path: string,
  columns: ColumnSpec[],
  fields: FilterField<Filters>[],
  options: Partial<ViewSpec> = {},
): ViewSpec {
  return {
    id,
    title,
    path,
    columns,
    fields,
    minWidth: 760,
    defaults: Object.fromEntries(
      fields.map((item) => [item.key, item.type === "checkbox" ? "0" : ""]),
    ),
    ...options,
  };
}
export function repairViews(area: "smd" | "assy"): ViewSpec[] {
  const root = "/api/reparacion_" + area;
  const title = "Reparación " + area.toUpperCase();
  const stock = view(
    area + "-stock",
    title + " · Stock actual",
    root + "/stock",
    stockColumns,
    [part, process, field("include_zero", "Incluir stock cero", "checkbox")],
    { limit: 2000, exportLimit: 10000 },
  );
  const movements = view(
    area + "-movimientos",
    title + " · Detalle de movimientos",
    root + "/movimientos",
    area === "assy"
      ? [
          ...movementColumns.slice(0, 10),
          col("linea_salida_pcb", "Línea salida PCB", 110),
          ...movementColumns.slice(10),
        ]
      : movementColumns,
    [
      ...repairDates,
      part,
      process,
      select("tipo_movimiento", "Tipo de movimiento", [
        "ENTRADA",
        "SALIDA",
        "SCRAP",
      ]),
    ],
    { minWidth: 1470 },
  );
  const defects = view(
    area + "-defectos",
    title + " · Resumen por defecto",
    root + "/defectos",
    [
      col("defect_type", "Defecto", 220),
      col("etapa_deteccion", "Etapa detección", 160),
      col("registros", "Registros", 95, true),
      col("qty_total", "Cantidad total", 110, true),
    ],
    [...repairDates, process],
    { limit: 2000, exportLimit: 10000 },
  );
  return [stock, movements, defects].map((spec) => ({
    ...spec,
    exportPath: spec.path + "/export",
  }));
}
export const finishedViews = [
  view(
    "finished-general",
    "IMD-SMD TERMINADO · Inventario general",
    "/api/inventario_general",
    [
      col("modelo", "Modelo", 160),
      col("nparte", "No. parte", 150),
      col("stock_total", "Stock total", 95, true),
      col("ubicaciones", "Ubicaciones", 130),
      col("ultima_entrada", "Última entrada", 155),
      col("ultima_salida", "Última salida", 155),
      col("tipo_inventario", "Tipo inventario", 95),
    ],
    [
      field("q", "Parte o modelo", "search"),
      {
        ...select("stock", "Stock", [">0", "=0"]),
        options: [
          { value: "", label: "Todos" },
          { value: ">0", label: "Con stock" },
          { value: "=0", label: "Sin stock" },
        ],
      },
    ],
    { limit: 2000 },
  ),
  view(
    "finished-location",
    "IMD-SMD TERMINADO · Ubicación",
    "/api/ubicacion",
    [
      col("fecha", "Fecha", 110),
      col("modelo", "Modelo", 140),
      col("nparte", "No. parte", 140),
      col("ubicacion", "Ubicación", 100),
      col("cantidad", "Cantidad", 85, true),
      col("tipo_inventario", "Tipo inventario", 95),
      col("comentario", "Comentario", 180),
      col("carro", "Carro", 80),
    ],
    [
      field("q", "Buscar", "search"),
      field("ubicacion", "Ubicación"),
      field("carro", "Carro"),
    ],
    { limit: 5000 },
  ),
  view(
    "finished-movements",
    "IMD-SMD TERMINADO · Movimientos",
    "/api/movimientos",
    [
      col("fecha_hora", "Fecha / hora", 160),
      col("tipo", "Tipo", 95),
      col("nparte", "No. parte", 140),
      col("modelo", "Modelo", 140),
      col("cantidad", "Cantidad", 85, true),
      col("ubicacion", "Ubicación", 95),
      col("tipo_inventario", "Tipo inventario", 90),
      col("comentario", "Comentario", 180),
      col("carro", "Carro", 80),
    ],
    [
      field("desde", "Fecha desde", "date"),
      field("hasta", "Fecha hasta", "date"),
      field("q", "Buscar", "search"),
      select("tipo", "Tipo", ["ENTRADA", "SALIDA", "AJUSTE"]),
    ],
    { limit: 5000, defaults: { desde: today(), hasta: "", q: "", tipo: "" } },
  ),
];
export const excessInventory = view(
  "excess-inventory",
  "Inventario Exceso",
  "/api/inventario_exceso/inventory",
  [
    col("part_number", "No. parte", 160),
    col("product_model", "Modelo", 170),
    col("customer", "Cliente", 105),
    col("initial_quantity", "Inv. inicial", 100, true),
    col("entries_qty", "Entradas", 95, true),
    col("exits_qty", "Salidas", 95, true),
    col("current_quantity", "Cantidad total", 110, true),
  ],
  [field("q", "Buscar", "search")],
  { exportPath: "/api/inventario_exceso/inventory/export", limit: 2000 },
);
export function excessHistory(kind: "entradas" | "salidas"): ViewSpec {
  return view(
    "excess-" + kind,
    kind === "entradas" ? "Entradas Exceso" : "Salidas Exceso",
    "/api/inventario_exceso/" + kind,
    [
      col("fecha", "Fecha", 100),
      col("hora", "Hora", 85),
      col("part_number", "No. parte", 150),
      col("scan_code", "Código escaneado", 270),
      ...(kind === "entradas"
        ? [
            col("product_model", "Modelo", 150),
            col("registered_by", "Usuario", 100),
          ]
        : [col("box_code", "Caja", 180), col("oqc_folio", "Folio OQC", 120)]),
    ],
    [
      field("fecha_desde", "Fecha desde", "date"),
      field("fecha_hasta", "Fecha hasta", "date"),
      field("search", "Buscar", "search"),
    ],
    { exportPath: "/api/inventario_exceso/" + kind + "/export", limit: 300 },
  );
}
export type InputKind = "smt" | "imd" | "ensamble" | "display";
export function inputHistory(kind: InputKind): ViewSpec {
  const paired = kind === "ensamble" || kind === "display";
  const name =
    kind === "display"
      ? "historial_verificacion_display"
      : "historial_produccion_" + kind;
  const fields = [
    field("fecha_desde", "Fecha desde", "date"),
    field("fecha_hasta", "Fecha hasta", "date"),
    { ...field("hora_desde", "Hora desde"), placeholder: "HH:mm" },
    { ...field("hora_hasta", "Hora hasta"), placeholder: "HH:mm" },
    field("linea", "Línea"),
    field("qr", "QR"),
    ...(paired ? [field("barcode", "Barcode")] : []),
    field("lote", "Lote"),
  ];
  return view(
    "input-" + kind,
    kind === "display"
      ? "Historial de verificación display"
      : "Historial de input " +
          (kind === "ensamble" ? "ensamble" : kind.toUpperCase()),
    "/api/control_resultados/" + name,
    [
      col("numero", "#", 48, true),
      col("linea", "Línea", 80),
      col("fecha", "Fecha", 105),
      col("hora", "Hora", 90),
      col("qr", "QR", 260),
      ...(paired ? [col("barcode", "Barcode", 260)] : []),
      col("lote", "Lote", 180),
    ],
    fields,
    {
      remote: true,
      exportPath: "/api/control_resultados/" + name + "/export",
      minWidth: paired ? 1020 : 800,
      defaults: Object.fromEntries(
        fields.map((item) => [item.key, item.type === "date" ? today() : ""]),
      ),
    },
  );
}
export const closureColumns = [
  col("part_number", "No. parte", 150),
  col("product_model", "Modelo", 160),
  col("customer", "Cliente", 95),
  col("system_quantity", "Sistema", 90, true),
  col("physical_quantity", "Físico CSV", 90, true),
  col("difference_quantity", "Diferencia", 90, true),
  col("status", "Estado", 100),
];
