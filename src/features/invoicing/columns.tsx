import type { ReactNode } from "react";
import type { TableColumn } from "@/shared/ui";
import { text } from "./model";
import type { DataRow } from "./types";
export type ColumnSpec = readonly [
  field: string,
  title: string,
  weight: number,
  numeric?: boolean,
];
/** Reserve room for separately composed action columns without exceeding 100%. */
export function reserveWidth(columns: TableColumn<DataRow>[], percent: number) {
  return columns.map((column) => ({
    ...column,
    width: `${(Number.parseFloat(String(column.width)) * (100 - percent)) / 100}%`,
  }));
}
export const INVOICES: ColumnSpec[] = [
  ["numero_invoice", "INVOICE", 160],
  ["estado", "ESTADO", 140],
  ["tipo", "TIPO", 90],
  ["total_lineas", "LÍNEAS", 65, true],
  ["total_packing", "PACKING", 65, true],
  ["links_activos", "LINKS", 65, true],
  ["fecha_carga", "FECHA DE CARGA", 130],
];
export const LINES: ColumnSpec[] = [
  ["line_no", "NO.", 45, true],
  ["raw_part_num", "PARTE RAW", 125],
  ["numero_parte_sistema", "PARTE SISTEMA", 135],
  ["descripcion", "DESCRIPCIÓN", 210],
  ["cantidad", "CANTIDAD", 90, true],
  ["uom", "UNIDAD", 60],
  ["costo_unitario", "COSTO UNIT.", 100, true],
  ["costo_total", "TOTAL", 110, true],
  ["estado_match", "ESTADO", 110],
];
export const PACKING: ColumnSpec[] = [
  ["line_no", "NO.", 45, true],
  ["pallet_no_original", "PALLET RAW", 90],
  ["pallet_no", "PALLET", 80],
  ["numero_parte_sistema", "PARTE SISTEMA", 130],
  ["cantidad_packing", "CANTIDAD", 80, true],
  ["entradas_recibidas", "ENTRADAS", 80, true],
  ["cantidad_recibida", "CANT. ENTRADA", 90, true],
  ["cantidad_pendiente_entrada", "PEND. ENTRADA", 90, true],
  ["cantidad_aplicada_activa", "APLICADO", 80, true],
  ["kg", "KG", 65, true],
  ["cbm", "CBM", 65, true],
  ["estado_match", "ESTADO", 125],
  ["mensaje_match", "CONFIRMACIÓN / MENSAJE", 230],
];
export const LINKS: ColumnSpec[] = [
  ["id", "ID", 45, true],
  ["codigo_material_recibido", "CÓDIGO RECIBIDO", 140],
  ["numero_parte_sistema", "PARTE", 130],
  ["cantidad_aplicada", "CANTIDAD", 90, true],
  ["costo_unitario", "COSTO UNIT.", 100, true],
  ["moneda", "MONEDA", 65],
  ["pallet_recibido", "PALLET RECIBIDO", 90],
  ["pallet_esperado", "PALLET ESPERADO", 90],
  ["estado", "ESTADO", 100],
  ["usuario_aplicacion", "APLICADO POR", 100],
  ["fecha_aplicacion", "FECHA APLICACIÓN", 130],
  ["usuario_desaplicado", "DESAPLICADO POR", 105],
];
export const MANUAL: ColumnSpec[] = [
  ["accion", "ACCIÓN", 90],
  ["numero_parte_sistema", "PARTE", 130],
  ["descripcion", "DESCRIPCIÓN", 180],
  ["pallet_no", "PALLET", 80],
  ["cantidad_confirmada", "CANTIDAD", 90, true],
  ["usuario", "USUARIO", 100],
  ["fecha", "FECHA", 130],
  ["comentario", "COMENTARIO", 200],
];
export const LOTS: ColumnSpec[] = [
  ["codigo_material_recibido", "CÓDIGO RECIBIDO", 170],
  ["cantidad_aplicada", "CANTIDAD APLICADA", 110, true],
  ["pallet_recibido", "PALLET RECIBIDO", 110],
  ["pallet_esperado", "PALLET ESPERADO", 110],
  ["nota_aplicacion", "NOTA DE APLICACIÓN", 260],
];
export const INVOICES_EXPORT: ColumnSpec[] = [
  ...INVOICES,
  ["archivo_nombre", "ARCHIVO", 160],
];
export const PACKING_EXPORT: ColumnSpec[] = PACKING.flatMap((spec) =>
  spec[0] === "cantidad_aplicada_activa"
    ? [spec, ["cantidad_exceso", "EXCESO", 90, true] as ColumnSpec]
    : [spec],
);
export const LINKS_EXPORT: ColumnSpec[] = [
  ...LINKS,
  ["nota_aplicacion", "NOTA PALLET", 180],
];
export const PACKING_LOTS_EXPORT: ColumnSpec[] = [
  ["packing_line_no", "NO. PACKING", 90, true],
  ["packing_pallet", "PALLET PACKING", 100],
  ["packing_part", "PARTE SISTEMA", 150],
  ["packing_quantity", "CANTIDAD PACKING", 100, true],
  ...LOTS,
];
export const PURCHASES: ColumnSpec[] = [
  ["numero_transaccion", "TRANSACCIÓN", 150],
  ["tipo", "TIPO", 65],
  ["estado", "ESTADO", 110],
  ["proveedor", "PROVEEDOR", 170],
  ["num_partes", "PARTES", 75, true],
  ["num_lineas", "LÍNEAS", 75, true],
  ["total_monto", "MONTO", 110, true],
  ["fecha_compra", "FECHA", 120],
];
export const PURCHASE_LINES: ColumnSpec[] = [
  ["numero_parte", "PARTE", 120],
  ["numero_parte_sistema", "PARTE SISTEMA", 130],
  ["descripcion", "DESCRIPCIÓN", 200],
  ["spec", "SPEC", 160],
  ["cantidad", "COMPRADO", 90, true],
  ["aplicado", "RECIBIDO", 90, true],
  ["pendiente", "PENDIENTE", 90, true],
  ["estado", "ESTADO", 95],
  ["moneda", "MONEDA", 100],
  ["costo_unitario", "PRECIO UNIT.", 95, true],
  ["costo_total", "TOTAL", 100, true],
  ["proveedor", "PROVEEDOR", 120],
  ["factura", "FACTURA", 100],
  ["modelo", "MODELO", 100],
  ["categoria", "CATEGORÍA", 90],
  ["fecha_compra", "FECHA", 110],
];
export const PURCHASE_LINKS: ColumnSpec[] = [
  ["codigo_material_recibido", "LOTE", 150],
  ["numero_parte_sistema", "PARTE SISTEMA", 150],
  ["cantidad_aplicada", "CANTIDAD", 90, true],
  ["costo_unitario", "COSTO UNIT.", 100, true],
  ["moneda", "MONEDA", 70],
  ["estado", "ESTADO", 110],
  ["usuario_aplicacion", "USUARIO", 110],
  ["fecha_aplicacion", "FECHA VINCULACIÓN", 140],
];
export const VALUATION: ColumnSpec[] = [
  ["codigo_material_recibido", "CÓDIGO RECIBIDO", 150],
  ["numero_parte_sistema", "PARTE SISTEMA", 140],
  ["numero_lote", "LOTE", 90],
  ["pallet_no", "PALLET", 70],
  ["vendedor", "VENDEDOR", 110],
  ["stock_actual", "STOCK", 90, true],
  ["unidad_medida", "UNIDAD", 60],
  ["costo_unitario", "COSTO UNIT.", 95, true],
  ["moneda", "MONEDA", 60],
  ["valor_total", "VALOR TOTAL", 100, true],
  ["fuente_costo", "FUENTE", 130],
  ["es_estimado", "ESTIMADO", 80],
  ["numero_invoice", "INVOICE", 130],
  ["numero_transaccion", "TRANSACCIÓN", 140],
];
export function makeColumns(
  specs: readonly ColumnSpec[],
  cells: Record<string, (row: DataRow) => ReactNode> = {},
  sortable = true,
): TableColumn<DataRow>[] {
  const weight = specs.reduce((total, spec) => total + spec[2], 0);
  return specs.map(([id, header, width, numeric]) => {
    const display = (row: DataRow) =>
      id === "es_estimado"
        ? Number(row[id]) === 0
          ? "No"
          : "Sí"
        : row[id] == null || row[id] === ""
          ? "—"
          : numeric && Number.isFinite(Number(row[id]))
            ? Number(row[id]).toLocaleString("en-US", {
                maximumFractionDigits: 4,
              })
            : text(row[id]);
    return {
      id,
      header,
      width: `${(width / weight) * 100}%`,
      cell: cells[id] || display,
      textValue: display,
      ...(sortable
        ? {
            sortValue: (row: DataRow) =>
              numeric ? Number(row[id]) : display(row),
          }
        : {}),
    };
  });
}
