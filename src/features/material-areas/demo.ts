import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import { COLUMNS } from "./config";
import {
  cellText,
  effectiveView,
  EXPORT_LIMIT,
  isInventory,
  params,
  todayMexico,
} from "./model";
import type {
  AreaApi,
  AreaRow,
  ConnectedArea,
  AreaView,
  Searches,
} from "./types";
function records(
  area: ConnectedArea,
  view: AreaView,
  searches: Searches,
  start: string,
  end: string,
) {
  const filtered = Array.from({ length: 1101 }, (_, index): AreaRow => {
    const n = String(index + 1).padStart(4, "0"),
      stock = 100 + index * 1.5;
    return {
      fecha: todayMexico(),
      hora: "08:30:00",
      codigo: `${area.toUpperCase()}/26-${n}-A`,
      part_no: `${area.toUpperCase()}-PARTE-${n}-A`,
      lote: `LOTE/${n}`,
      cantidad: stock,
      unidad: "EA",
      ubicacion: `RACK-${(index % 8) + 1}`,
      cliente: "LG",
      especificacion:
        index % 2 ? "Componente SMD 1uF 50V" : "Componente de demostración",
      usuario: "demo",
      modelo: `MODELO-${(index % 3) + 1}`,
      depto: area.toUpperCase(),
      proceso: "Producción",
      linea: `LINEA-${(index % 4) + 1}`,
      entrada: stock + 25,
      salida: 25,
      stock,
      fecha_recibo: todayMexico(),
      lotes: (index % 3) + 1,
      lotes_con_stock: 1,
      lote_chamber: `CHAMBER/${n}-A`,
      lote_completo: `IPM/${n}-A`,
      programacion:
        area === "micom" ? `PROGRAMACION|${n}|A` : `92MS-IPM-${n}-A`,
    };
  });
  return filtered.filter(
    (row) =>
      (isInventory(view) ||
        ((!start || cellText(row.fecha) >= start) &&
          (!end || cellText(row.fecha) <= end))) &&
      COLUMNS[view].every(
        ([key]) =>
          !searches[key] ||
          cellText(row[key])
            .toLocaleLowerCase()
            .includes(searches[key].trim().toLocaleLowerCase()),
      ),
  );
}
export const demoAreaApi: AreaApi = {
  async list(area, filters, searches, page, size, signal) {
    params(area, filters, searches, page, size);
    signal?.throwIfAborted();
    const view = effectiveView(filters),
      all = records(area, view, searches, filters.start, filters.end),
      total_pages = Math.max(1, Math.ceil(all.length / size)),
      current = Math.min(page, total_pages);
    return {
      rows: all.slice((current - 1) * size, current * size),
      total: all.length,
      piezas: all.reduce(
        (sum, row) =>
          sum + Number(isInventory(view) ? row.stock : row.cantidad),
        0,
      ),
      page: current,
      per_page: size,
      total_pages,
    };
  },
  async export(area, filters, searches) {
    params(area, filters, searches);
    const view = effectiveView(filters),
      specs = COLUMNS[view],
      all = records(area, view, searches, filters.start, filters.end).slice(
        0,
        EXPORT_LIMIT,
      );
    await exportSpreadsheet(
      `Material_${area.toUpperCase()}_${view}_demo.xlsx`,
      [
        {
          name: area.toUpperCase(),
          rows: [
            specs.map((spec) => spec[1]),
            ...all.map((row) => specs.map((spec) => row[spec[0]] ?? null)),
          ],
        },
      ],
    );
  },
};
