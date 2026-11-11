import { Button, type TableColumn } from "@/shared/ui";
import { displayValue } from "./model";
import type { HistoryKind, LedgerRow } from "./types";
type Field = readonly [id: string, title: string, weight: number];
const historyFields: Record<HistoryKind, Field[]> = {
  entradas: [
    ["numero_parte", "NÚMERO DE PARTE", 120],
    ["especificacion", "ESPECIFICACIÓN", 180],
    ["codigo_material_recibido", "CÓDIGO RECIBIDO", 150],
    ["numero_lote_material", "LOTE", 100],
    ["numero_invoice", "INVOICE", 100],
    ["numero_transaccion", "TRANSACCIÓN", 100],
    ["iqc_status", "IQC STATUS", 90],
    ["in_quarantine", "CUARENTENA", 90],
    ["cantidad_actual", "CANTIDAD", 90],
    ["cantidad_estandarizada", "UNIDAD EMPAQUE", 100],
    ["location", "UBICACIÓN", 100],
    ["fecha_recibo", "FECHA RECIBO", 110],
    ["fecha_recibo_hora", "HORA", 90],
    ["vendedor", "VENDEDOR", 100],
    ["costo_unitario", "COSTO UNIT.", 90],
    ["costo_total", "COSTO TOTAL", 90],
    ["moneda_costo", "MONEDA", 70],
    ["cancelado", "CANCELADO", 90],
    ["usuario_registro", "REGISTRADO POR", 110],
  ],
  salidas: [
    ["fecha_salida", "FECHA SALIDA", 110],
    ["fecha_salida_hora", "HORA", 90],
    ["proceso_salida", "PROCESO SALIDA", 100],
    ["codigo_material_recibido", "CÓDIGO RECIBIDO", 150],
    ["material_code", "CÓDIGO MATERIAL", 120],
    ["numero_parte", "NÚMERO DE PARTE", 120],
    ["cantidad_salida", "CANTIDAD", 90],
    ["numero_lote", "LOTE", 100],
    ["especificacion_material", "ESPECIFICACIÓN", 180],
    ["depto_salida", "DEPARTAMENTO", 100],
    ["vendedor", "VENDEDOR", 100],
    ["usuario_registro", "REGISTRADO POR", 100],
  ],
  retornos: [
    ["fecha_creacion", "FECHA RETORNO", 130],
    ["warehousing_code", "CÓDIGO RECIBIDO", 150],
    ["material_code", "CÓDIGO MATERIAL", 120],
    ["numero_parte", "NÚMERO DE PARTE", 120],
    ["numero_lote_material", "LOTE", 100],
    ["packaging_unit", "UNIDAD EMPAQUE", 100],
    ["cantidad_devuelta", "CANTIDAD", 90],
    ["material_spec", "ESPECIFICACIÓN", 180],
    ["descripcion_motivo", "MOTIVO", 170],
  ],
};
const summaryFields: Field[] = [
  ["numero_parte_base", "NÚMERO DE PARTE", 120],
  ["version", "VERSIÓN", 65],
  ["especificacion", "ESPECIFICACIÓN", 220],
  ["ubicacion", "UBICACIÓN", 110],
  ["unidad_medida", "UNIDAD", 65],
];
const movements: Field[] = [
  ["total_entrada", "ENTRADAS", 100],
  ["total_salida", "SALIDAS", 100],
];
const totals: Field[] = [
  ["stock_total", "STOCK TOTAL", 100],
  ["lotes_distintos", "LOTES", 65],
  ["lotes_con_stock", "LOTES CON STOCK", 110],
];
const lotFields: Field[] = [
  ["numero_parte_base", "NÚMERO DE PARTE", 120],
  ["version", "VERSIÓN", 65],
  ["numero_lote", "LOTE", 100],
  ["codigo_material_recibido", "CÓDIGO RECIBIDO", 160],
  ["especificacion", "ESPECIFICACIÓN", 200],
  ["ubicacion", "UBICACIÓN", 100],
  ["in_quarantine", "CUARENTENA", 90],
  ["unidad_medida", "UNIDAD", 65],
  ["total_entrada", "TOTAL ENTRADA", 100],
  ["total_salida", "TOTAL SALIDA", 100],
  ["stock_actual", "STOCK ACTUAL", 100],
  ["fecha_recibo", "FECHA RECIBO", 120],
  ["fecha_salida", "FECHA SALIDA", 120],
  ["usuario_entrada", "USUARIO ENTRADA", 110],
  ["usuario_salida", "USUARIO SALIDA", 110],
];
function columns(fields: Field[], sort = false): TableColumn<LedgerRow>[] {
  const total = fields.reduce((sum, field) => sum + field[2], 0);
  return fields.map(([id, header, weight]) => {
    const separateTime = fields.some(([field]) => field === `${id}_hora`);
    const value = (row: LedgerRow) => {
      const raw = row[id];
      return displayValue(
        separateTime &&
          typeof raw === "string" &&
          /^\d{4}-\d{2}-\d{2}[ T]/.test(raw)
          ? raw.slice(0, 10)
          : raw,
        id,
      );
    };
    return {
      id,
      header,
      width: `${(weight / total) * 100}%`,
      cell: value,
      textValue: value,
      ...(sort
        ? {
            sortValue: (row: LedgerRow) =>
              [
                "stock_total",
                "total_entrada",
                "total_salida",
                "lotes_distintos",
                "lotes_con_stock",
              ].includes(id)
                ? Number(row[id])
                : String(row[id] ?? ""),
          }
        : {}),
    };
  });
}
export const HISTORY_COLUMNS: Record<HistoryKind, TableColumn<LedgerRow>[]> = {
  entradas: columns(historyFields.entradas),
  salidas: columns(historyFields.salidas),
  retornos: columns(historyFields.retornos),
};
export const LOT_COLUMNS = columns(lotFields);
export function summaryColumns(
  period: boolean,
  openLots: (part: string) => void,
): TableColumn<LedgerRow>[] {
  return columns(
    [...summaryFields, ...(period ? movements : []), ...totals],
    true,
  ).map((column) =>
    column.id !== "numero_parte_base"
      ? column
      : {
          ...column,
          cell: (row) => (
            <Button
              variant="plain"
              className="text-button"
              title="Ver detalle por lote"
              onClick={() =>
                openLots(
                  String(row.numero_parte || row.numero_parte_base || ""),
                )
              }
            >
              {displayValue(row.numero_parte_base, "numero_parte_base")}
            </Button>
          ),
        },
  );
}
