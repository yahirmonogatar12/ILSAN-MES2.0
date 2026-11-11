import { saveDownload } from "@/core/http";
import { todayIso } from "./config";
import { csvCell, displayValue } from "./model";
import type {
  HistoryFilters,
  HistoryKind,
  InventoryFilters,
  LedgerApi,
  LedgerRow,
  Searches,
} from "./types";
const today = todayIso();
const yesterdayDate = new Date();
yesterdayDate.setDate(yesterdayDate.getDate() - 1);
const yesterday = todayIso(yesterdayDate);
const lots: LedgerRow[] = Array.from({ length: 12 }, (_, index) => {
  const first = index < 6;
  const incoming = 1000 + index * 100;
  const outgoing = index === 0 ? incoming : index * 20;
  return {
    numero_parte: first ? "0CE105VK6DC-01-A" : "EAH61515501",
    numero_parte_base: first ? "0CE105VK6DC" : "EAH61515501",
    version: first ? "01-A" : "N/A",
    numero_lote: index % 4 === 0 ? "N/A" : `LOTE-${index + 1}`,
    codigo_material_recibido: `MAT/26-${String(index + 1).padStart(4, "0")}`,
    codigo_material: `MAT-${index + 1}`,
    especificacion: first ? "Capacitor 1uF 50V SMD" : "Regulador 12V 225mA",
    ubicacion: first ? "RACK-A" : "RACK-B",
    in_quarantine: index === 3 ? 1 : 0,
    unidad_medida: "EA",
    total_entrada: incoming,
    total_salida: outgoing,
    stock_actual: incoming - outgoing,
    fecha_recibo: `${index % 3 === 0 ? yesterday : today} 08:15:00`,
    fecha_salida: `${today} 10:20:00`,
    usuario_entrada: "Demostración",
    usuario_salida: "Operador demo",
  };
});
function contains(value: unknown, query: string) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());
}
function bySearches(rows: LedgerRow[], searches: Searches) {
  return rows.filter((row) =>
    Object.entries(searches).every(([key, value]) =>
      contains(
        ["in_quarantine", "cancelado"].includes(key)
          ? displayValue(row[key], key).replace("Sí", "Si")
          : row[key],
        value.replace("Sí", "Si"),
      ),
    ),
  );
}
function historyRows(
  kind: HistoryKind,
  filters: HistoryFilters,
  searches: Searches,
) {
  const rows = Array.from({ length: 24 }, (_, index): LedgerRow => {
    const lot = lots[index % lots.length];
    const date = `${index % 5 === 0 ? yesterday : today} 09:${String(index).padStart(2, "0")}:00`;
    if (kind === "entradas")
      return {
        numero_parte: lot.numero_parte,
        especificacion: lot.especificacion,
        codigo_material: lot.codigo_material,
        codigo_material_recibido: lot.codigo_material_recibido,
        numero_lote_material: lot.numero_lote,
        numero_invoice: `INV-${index + 1}`,
        numero_transaccion: `TRX-${index + 1}`,
        propiedad_material: "SMD",
        iqc_status: "Released",
        in_quarantine: lot.in_quarantine,
        cantidad_actual: index === 1 ? 0 : lot.total_entrada,
        cantidad_estandarizada: 1000,
        location: lot.ubicacion,
        fecha_recibo: date,
        fecha_recibo_hora: date.slice(11),
        material_importacion_local: "Importación",
        estado_desecho: 0,
        vendedor: "SAMWHA",
        cancelado: index === 2 ? 1 : 0,
        usuario_registro: "Demostración",
        costo_unitario: index === 1 ? 0 : 0.0157,
        costo_total: index === 1 ? 0 : Number(lot.total_entrada) * 0.0157,
        moneda_costo: "USD",
      };
    if (kind === "salidas")
      return {
        fecha_salida: date,
        fecha_salida_hora: date.slice(11),
        proceso_salida: "SMT",
        codigo_material_recibido: lot.codigo_material_recibido,
        material_code: lot.numero_parte,
        numero_parte: lot.numero_parte,
        cantidad_salida: 20,
        modelo: "MODELO-DEMO",
        numero_lote: lot.numero_lote,
        especificacion_material: lot.especificacion,
        depto_salida: "Producción",
        vendedor: "SAMWHA",
        usuario_registro: "Demostración",
      };
    return {
      fecha_creacion: date,
      warehousing_code: lot.codigo_material_recibido,
      material_code: lot.codigo_material,
      numero_parte: lot.numero_parte,
      numero_lote_material: lot.numero_lote,
      packaging_unit: 1000,
      cantidad_devuelta: 10,
      material_spec: lot.especificacion,
      descripcion_motivo:
        index % 2 ? "Sobrante de producción" : "Cambio de modelo",
    };
  });
  const dateKey =
    kind === "entradas"
      ? "fecha_recibo"
      : kind === "salidas"
        ? "fecha_salida"
        : "fecha_creacion";
  return bySearches(
    rows.filter((row) => {
      const date = String(row[dateKey]).slice(0, 10);
      return (
        (!filters.fecha_inicio || date >= filters.fecha_inicio) &&
        (!filters.fecha_fin || date <= filters.fecha_fin) &&
        (!filters.texto ||
          Object.values(row).some((value) => contains(value, filters.texto)))
      );
    }),
    searches,
  );
}
function lotRows(
  filters: InventoryFilters,
  searches: Searches,
  summary = false,
) {
  let rows = lots.map((row) => ({ ...row }));
  if (filters.use_dates === "true")
    rows = rows
      .filter((row) => {
        const received = String(row.fecha_recibo).slice(0, 10),
          shipped = String(row.fecha_salida).slice(0, 10);
        return (
          (received >= filters.fecha_inicio && received <= filters.fecha_fin) ||
          (shipped >= filters.fecha_inicio && shipped <= filters.fecha_fin)
        );
      })
      .map((row) => {
        const received = String(row.fecha_recibo).slice(0, 10),
          shipped = String(row.fecha_salida).slice(0, 10);
        const incoming = Number(row.total_entrada),
          outgoing = Number(row.total_salida);
        return {
          ...row,
          total_entrada:
            received >= filters.fecha_inicio && received <= filters.fecha_fin
              ? incoming
              : 0,
          total_salida:
            shipped >= filters.fecha_inicio && shipped <= filters.fecha_fin
              ? outgoing
              : 0,
          stock_actual:
            (received <= filters.fecha_fin ? incoming : 0) -
            (shipped <= filters.fecha_fin ? outgoing : 0),
        };
      });
  return bySearches(
    rows.filter(
      (row) =>
        contains(row.numero_parte, filters.numero_parte) &&
        contains(row.ubicacion, filters.ubicacion) &&
        (summary ||
          contains(
            row.codigo_material_recibido,
            filters.codigo_material_recibido,
          )) &&
        (summary ||
          filters.only_na !== "true" ||
          !row.numero_lote ||
          row.numero_lote === "N/A") &&
        (summary ||
          filters.include_zero_stock === "true" ||
          Number(row.stock_actual) > 0),
    ),
    searches,
  );
}
function slice(rows: LedgerRow[], page: number, size: number) {
  return {
    data: structuredClone(rows.slice((page - 1) * size, page * size)),
    total: rows.length,
    limit: size,
    offset: (page - 1) * size,
  };
}
function csv(name: string, rows: LedgerRow[]) {
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  saveDownload(
    new Blob(
      [
        "\ufeff",
        fields.map(csvCell).join(","),
        "\r\n",
        rows
          .map((row) => fields.map((field) => csvCell(row[field])).join(","))
          .join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    `${name}_demostracion.csv`,
  );
}
export const demoApi: LedgerApi = {
  async history(kind, filters, searches, page, size) {
    return slice(historyRows(kind, filters, searches), page, size);
  },
  async summary(filters) {
    const grouped = new Map<string, LedgerRow>();
    const lotNames = new Map<string, Set<string>>();
    for (const lot of lotRows(filters, {}, true)) {
      const key = String(lot.numero_parte);
      const row = grouped.get(key) || {
        numero_parte: lot.numero_parte,
        numero_parte_base: lot.numero_parte_base,
        version: lot.version,
        especificacion: lot.especificacion,
        ubicacion: lot.ubicacion,
        unidad_medida: lot.unidad_medida,
        stock_total: 0,
        total_entrada: 0,
        total_salida: 0,
        lotes_distintos: 0,
        lotes_con_stock: 0,
      };
      for (const [target, source] of [
        ["stock_total", "stock_actual"],
        ["total_entrada", "total_entrada"],
        ["total_salida", "total_salida"],
      ])
        row[target] = Number(row[target]) + Number(lot[source]);
      const names = lotNames.get(key) || new Set<string>();
      if (lot.numero_lote !== null) names.add(String(lot.numero_lote));
      lotNames.set(key, names);
      row.lotes_distintos = names.size;
      row.lotes_con_stock =
        Number(row.lotes_con_stock) + (Number(lot.stock_actual) > 0 ? 1 : 0);
      grouped.set(key, row);
    }
    return [...grouped.values()].filter(
      (row) =>
        filters.include_zero_stock === "true" || Number(row.stock_total) > 0,
    );
  },
  async lots(filters, searches, page, size) {
    return slice(lotRows(filters, searches), page, size);
  },
  async exportHistory(kind, filters, searches) {
    csv(`historial_${kind}`, historyRows(kind, filters, searches));
  },
  async exportInventory(view, filters, searches) {
    csv(
      `inventario_${view}`,
      view === "summary"
        ? await this.summary(filters)
        : lotRows(filters, searches),
    );
  },
};
