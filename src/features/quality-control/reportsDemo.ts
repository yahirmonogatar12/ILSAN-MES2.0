import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import { number, object, text, today } from "./model";
import { operationalDate } from "./reportModel";
import type { PpmStage } from "./reportTypes";
import type { Row } from "./types";

const day = operationalDate();
const lqc: Row[] = [
  {
    linea: "M1",
    fecha: day,
    part: "0001/LQC-01-A",
    model_code: "Modelo A",
    lot_no: "LOT-01/A",
    box_code: "BOX-01/A",
    serial: "0001/LQC+01-A",
    status: "OK",
    duplicado_historico: false,
    es_original: true,
    total_repeticiones: 2,
    fechas_repetidas: day,
    escaneos_repetidos: day + " 18:10:00",
    first_scan: day + " 08:00:00",
    last_scan: day + " 08:01:00",
    turno: "DIA",
  },
  {
    linea: "M1",
    fecha: day,
    part: "0001/LQC-01-A",
    model_code: "Modelo A",
    lot_no: "LOT-02/B",
    box_code: "BOX-02/B",
    serial: "0002/LQC+02-B",
    status: "OK",
    duplicado_historico: false,
    es_original: true,
    total_repeticiones: 1,
    fechas_repetidas: "",
    escaneos_repetidos: "",
    first_scan: day + " 09:00:00",
    last_scan: day + " 09:01:00",
    turno: "DIA",
  },
  {
    linea: "M2",
    fecha: day,
    part: "0001/LQC-01-A",
    model_code: "Modelo A",
    lot_no: "LOT-03/C",
    box_code: "BOX-03/C",
    serial: "0001/LQC+01-A",
    status: "Duplicado",
    duplicado_historico: true,
    es_original: false,
    total_repeticiones: 2,
    fechas_repetidas: day,
    escaneos_repetidos: day + " 08:01:00",
    first_scan: day + " 18:00:00",
    last_scan: day + " 18:10:00",
    turno: "TIEMPO EXTRA",
  },
  {
    linea: "SIN PLAN",
    fecha: day,
    part: "0004/LQC-04-D",
    model_code: "",
    lot_no: "",
    box_code: "BOX-04/D",
    serial: "0004/LQC+04-D",
    status: "OK",
    duplicado_historico: false,
    es_original: true,
    total_repeticiones: 1,
    fechas_repetidas: "",
    escaneos_repetidos: "",
    first_scan: day + " 23:00:00",
    last_scan: day + " 23:01:00",
    turno: "NOCHE",
  },
];
const oqc: Row[] = [
  {
    id: 1,
    fecha: today(),
    hora: "09:00:00",
    oqc_folio: "OQC-0001/A",
    box_code: "BOX-0001/A",
    part_number: "0001/OQC-01-A",
    quantity: 120,
    product_model: "Modelo A",
    customer: "LG",
    released_by_name: "QA Demo",
  },
  {
    id: 2,
    fecha: today(),
    hora: "08:30:00",
    oqc_folio: "OQC-0002/B",
    box_code: "BOX-0002/B",
    part_number: "0002/OQC-02-B",
    quantity: 0,
    product_model: "Modelo B",
    customer: "LG",
    released_by_name: "QA Demo",
  },
];
const targets: Record<PpmStage, number> = { lqc: 20000, oqc: 20000 };
function oqcRows(params: URLSearchParams) {
  const search = (params.get("search") || "").toLocaleLowerCase("es");
  return oqc.filter(
    (row) =>
      (!params.get("fecha_desde") ||
        text(row.fecha) >= params.get("fecha_desde")!) &&
      (!params.get("fecha_hasta") ||
        text(row.fecha) <= params.get("fecha_hasta")!) &&
      Object.values(row).some((value) =>
        text(value).toLocaleLowerCase("es").includes(search),
      ),
  );
}
const metric = (inspected: number, defects: number, target: number) => ({
  inspected,
  defects,
  ppm: inspected > 0 ? Math.round((defects / inspected) * 1_000_000) : 0,
  target,
});
function weekKey(date: string) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const start = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((value.getTime() - start.getTime()) / 86400000 + 1) / 7,
  );
  return value.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}
function periodKey(date: string, group: string) {
  return group === "month"
    ? date.slice(0, 7)
    : group === "week"
      ? weekKey(date)
      : date;
}
function periodLabels(from: string, to: string, group: string) {
  const result = new Map<string, string>();
  const date = new Date(from + "T12:00:00Z"),
    end = new Date(to + "T12:00:00Z");
  while (date <= end) {
    const key = periodKey(date.toISOString().slice(0, 10), group);
    const label =
      group === "month"
        ? new Intl.DateTimeFormat("en", {
            month: "short",
            timeZone: "UTC",
          }).format(date)
        : group === "week"
          ? key.slice(5)
          : key.slice(5);
    result.set(key, label);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return [...result].map(([key, label]) => ({ key, label }));
}
function ppmData(stage: PpmStage, params: URLSearchParams) {
  const from = params.get("fecha_inicio")!,
    to = params.get("fecha_fin")!,
    group = params.get("group_by") || "month";
  const target = targets[stage] || 20000,
    factor = stage === "lqc" ? 1 : 2;
  const records = [
    {
      date: today(),
      line: "M1",
      part_number: "0001/PPM-01-A",
      model: "Modelo A",
      inspected: 1000,
      defects: 25 * factor,
    },
    {
      date: today().slice(0, 7) + "-01",
      line: "M2",
      part_number: "0002/PPM-02-B",
      model: "Modelo B",
      inspected: 2000,
      defects: 5 * factor,
    },
  ];
  const matches = (row: (typeof records)[number]) =>
    (!params.getAll("lineas").length ||
      params.getAll("lineas").includes(row.line)) &&
    [row.part_number, row.model].some((value) =>
      value.toLowerCase().includes((params.get("q") || "").toLowerCase()),
    );
  const filtered = records.filter(
    (row) => row.date >= from && row.date <= to && matches(row),
  );
  const combine = (items: typeof records) =>
    metric(
      items.reduce((sum, row) => sum + row.inspected, 0),
      items.reduce((sum, row) => sum + row.defects, 0),
      target,
    );
  const periods = (start: string, end: string, grouping: string) =>
    periodLabels(start, end, grouping).map((period) => ({
      ...period,
      ...combine(
        records.filter(
          (row) => matches(row) && periodKey(row.date, grouping) === period.key,
        ),
      ),
    }));
  const year = to.slice(0, 4);
  const top = filtered
    .map((row) => ({ ...row, ...metric(row.inspected, row.defects, target) }))
    .sort((a, b) => b.ppm - a.ppm);
  const last = new Date(to + "T12:00:00Z");
  if (last.getUTCDay() !== 0)
    last.setUTCDate(last.getUTCDate() - (last.getUTCDay() || 7));
  const first = new Date(last);
  first.setUTCDate(first.getUTCDate() - 83);
  const weekly = periods(
    first.toISOString().slice(0, 10),
    last.toISOString().slice(0, 10),
    "week",
  );
  return {
    stage: stage.toUpperCase(),
    target,
    dateFrom: from,
    dateTo: to,
    trendYear: Number(year),
    groupBy: group,
    summary: combine(filtered),
    periods: periods(from, to, group),
    trendPeriods: periods(year + "-01-01", year + "-12-31", "month"),
    lines: [...new Set(filtered.map((row) => row.line))],
    byLine: [...new Set(filtered.map((row) => row.line))].map((line) => ({
      line,
      ...combine(filtered.filter((row) => row.line === line)),
    })),
    topParts: top.slice(0, 5),
    topPartDetails: top.slice(0, 5),
    byPart: top,
    lineWeeklyDetails: {
      periods: weekly.map(({ key, label }) => ({ key, label })),
      rows: [...new Set(records.filter(matches).map((row) => row.line))].map(
        (line) => ({
          line,
          weeks: weekly.map((period) => ({
            ...period,
            ...combine(
              records.filter(
                (row) =>
                  matches(row) &&
                  row.line === line &&
                  weekKey(row.date) === period.key,
              ),
            ),
          })),
        }),
      ),
    },
  };
}
export function reportDemoRequest(path: string, init?: RequestInit): unknown {
  const url = new URL(path, "http://demo"),
    params = url.searchParams;
  if (url.pathname === "/api/lqc/lineas") {
    const slots = [7, 8, 9, 18, 23].map((hour) => ({
      key: day + " " + String(hour).padStart(2, "0") + ":30:00",
      label: String(hour).padStart(2, "0") + ":30",
      hour,
    }));
    return {
      fecha_consulta: day,
      actualizado: day + " 23:30:00",
      lineas: [
        "M1",
        "M2",
        "M3",
        "M4",
        "DP1",
        "DP2",
        "DP3",
        "H1",
        "SIN PLAN",
      ].map((linea) => ({
        linea,
        total_hoy: lqc.filter((row) => row.linea === linea).length,
      })),
      uph_hoy: {
        M1: { [slots[1].key]: 1, [slots[2].key]: 1 },
        M2: { [slots[3].key]: 1 },
        "SIN PLAN": { [slots[4].key]: 1 },
      },
      uph_slots: slots,
    };
  }
  if (url.pathname === "/api/lqc/datos")
    return {
      records: structuredClone(
        lqc.filter(
          (row) =>
            text(row.fecha) >= params.get("fecha_inicio")! &&
            text(row.fecha) <= params.get("fecha_fin")! &&
            (!params.getAll("lineas").length ||
              params.getAll("lineas").includes(text(row.linea))) &&
            (!params.get("turno") || row.turno === params.get("turno")),
        ),
      ),
    };
  if (url.pathname === "/api/oqc/liberaciones") {
    const records = oqcRows(params);
    return {
      records: structuredClone(records),
      limit: params.size ? 5000 : 300,
      truncated: false,
      summary: {
        total_boxes: records.length,
        total_quantity: records.reduce(
          (sum, row) => sum + number(row.quantity),
          0,
        ),
      },
    };
  }
  const route = /^\/api\/control_calidad\/ppms\/(lqc|oqc)(\/target)?$/.exec(
    url.pathname,
  );
  if (!route) throw new Error("Consulta de calidad demo no disponible.");
  const stage = route[1] as PpmStage;
  if (route[2]) {
    if (init?.method === "POST")
      targets[stage] = number(object(JSON.parse(String(init.body))).target);
    return { success: true, target: targets[stage] || 20000 };
  }
  return ppmData(stage, params);
}
export function exportOqcDemo(path: string, name: string) {
  const records = oqcRows(new URL(path, "http://demo").searchParams);
  const fields = [
    "fecha",
    "hora",
    "oqc_folio",
    "box_code",
    "part_number",
    "quantity",
    "product_model",
    "customer",
    "released_by_name",
  ];
  return exportSpreadsheet(name, [
    {
      name: "Liberación OQC",
      rows: [
        [
          "Fecha",
          "Hora",
          "Folio OQC",
          "Box ID",
          "No. parte",
          "Cantidad",
          "Modelo",
          "Cliente",
          "Liberado por",
        ],
        ...records.map((row) =>
          fields.map((key) =>
            typeof row[key] === "number" ? number(row[key]) : text(row[key]),
          ),
        ),
      ],
    },
  ]);
}
