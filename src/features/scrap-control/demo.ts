import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import { defaultFilters, scrapColumns } from "./model";
import type { ScrapRecord } from "./types";

export function demoScrap(params: URLSearchParams): ScrapRecord[] {
  const today = defaultFilters().start;
  const yesterday = new Date(today + "T12:00:00Z");
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const rows: ScrapRecord[] = [
    {
      id: 3,
      cliente: "LG",
      fecha: today,
      hora: "10:35:00",
      scanned_original: "0001/SMD-03-A",
      part_no: "EBR23966228-01-A",
      modelo: "Modelo demo A",
      area: "SMD",
      proceso: "SMT",
      motivo_scrap_texto: "Daño de tarjeta",
      cantidad: 2,
      comentarios: "Separado en inspección",
      usuario_registro: "demo",
    },
    {
      id: 2,
      cliente: "LG",
      fecha: today,
      hora: "08:22:00",
      scanned_original: "0002/IMD-08-B",
      part_no: "EBR23966229-02-B",
      modelo: "Modelo demo B",
      area: "IMD",
      proceso: "IMD",
      motivo_scrap_texto: "Daño de componente",
      cantidad: 0,
      comentarios: "Registro sin piezas",
      usuario_registro: "demo",
    },
    {
      id: 1,
      cliente: "LG",
      fecha: yesterday.toISOString().slice(0, 10),
      hora: "16:10:00",
      scanned_original: "0003/M1-07-C",
      part_no: "EBR23966229-02-B",
      modelo: "Modelo demo B",
      area: "M1",
      proceso: "ASSY",
      motivo_scrap_texto: "Daño de tarjeta",
      cantidad: 1,
      comentarios: "",
      usuario_registro: "demo",
    },
  ];
  return rows.filter(
    (row) =>
      row.fecha >= (params.get("start") ?? today) &&
      row.fecha <= (params.get("end") ?? today) &&
      (!params.get("area") || row.area === params.get("area")) &&
      scrapColumns.every(({ id, field }) =>
        String(row[field] ?? "")
          .toLocaleLowerCase("es")
          .includes((params.get("cf_" + id) ?? "").toLocaleLowerCase("es")),
      ),
  );
}

export function exportDemoScrap(params: URLSearchParams, name: string) {
  return exportSpreadsheet(name, [
    {
      name: "Scrap",
      rows: [
        scrapColumns.map(({ title }) => title),
        ...demoScrap(params).map((row) =>
          scrapColumns.map(({ field }) => row[field]),
        ),
      ],
    },
  ]);
}
