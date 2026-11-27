import {
  rangeIssue as dateRangeIssue,
  validDate,
  PLANT_TIME_ZONE,
} from "@/shared/lib/date";
import { number, object, rows, text, today } from "./model";
import type {
  LqcFilters,
  OqcFilters,
  PpmFilters,
  PpmMetric,
  PpmPeriod,
  PpmReport,
  PpmStage,
} from "./reportTypes";
import type { Row } from "./types";

/** LQC's operating day starts at 07:30 Mexico time and ends at the next day's cutoff. */
export function operationalDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PLANT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (key: string) => parts.find((part) => part.type === key)!.value;
  const date = [value("year"), value("month"), value("day")].join("-");
  if (Number(value("hour")) * 60 + Number(value("minute")) >= 450) return date;
  const previous = new Date(date + "T12:00:00Z");
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}
export const lqcDefaults = (date = operationalDate()): LqcFilters => ({
  fecha_inicio: date,
  fecha_fin: date,
  linea: "",
  turno: "Todos",
  search: "",
});
export const oqcDefaults: OqcFilters = {
  search: "",
  fecha_desde: "",
  fecha_hasta: "",
};
export function ppmDefaults(): PpmFilters {
  const date = today();
  return {
    fecha_inicio: date.slice(0, 7) + "-01",
    fecha_fin: date,
    linea: "",
    q: "",
    group_by: "month",
  };
}

export function reportDateIssue(from: string, to: string, required = true) {
  if (
    (required && (!from || !to)) ||
    (from && !validDate(from)) ||
    (to && !validDate(to))
  )
    return "Selecciona fechas válidas.";
  return dateRangeIssue(from, to);
}
export function lqcParams(filters: LqcFilters) {
  const issue = reportDateIssue(filters.fecha_inicio, filters.fecha_fin);
  if (issue) throw new Error(issue);
  const params = new URLSearchParams({
    fecha_inicio: filters.fecha_inicio,
    fecha_fin: filters.fecha_fin,
  });
  if (filters.linea) params.append("lineas", filters.linea);
  if (filters.turno !== "Todos") params.set("turno", filters.turno);
  return params;
}
export function oqcParams(filters: OqcFilters) {
  const issue = reportDateIssue(
    filters.fecha_desde,
    filters.fecha_hasta,
    false,
  );
  if (issue) throw new Error(issue);
  const params = new URLSearchParams();
  if (filters.search.trim())
    params.set("search", filters.search.trim().slice(0, 160));
  if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
  if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
  return params;
}
export function ppmParams(stage: PpmStage, filters: PpmFilters) {
  const issue = reportDateIssue(filters.fecha_inicio, filters.fecha_fin);
  if (issue) throw new Error(issue);
  const params = new URLSearchParams({
    fecha_inicio: filters.fecha_inicio,
    fecha_fin: filters.fecha_fin,
  });
  if (stage === "oqc") {
    if (!["day", "week", "month"].includes(filters.group_by))
      throw new Error("Selecciona un periodo válido.");
    params.set("group_by", filters.group_by);
  }
  if (filters.linea) params.append("lineas", filters.linea);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return params;
}
export function lqcFiltered(records: Row[], search: string) {
  const term = search.trim().toLocaleLowerCase("es");
  const fields = [
    "linea",
    "part",
    "model_code",
    "lot_no",
    "box_code",
    "serial",
    "status",
    "turno",
    "fecha",
    "last_scan",
    "fechas_repetidas",
    "escaneos_repetidos",
  ];
  return records.filter((row) =>
    fields.some((field) =>
      text(row[field]).toLocaleLowerCase("es").includes(term),
    ),
  );
}
export function lqcSummary(records: Row[], allLines: boolean) {
  const groups = new Map<string, Row>();
  for (const row of records) {
    const key = JSON.stringify(
      allLines
        ? [row.fecha, row.part]
        : [row.linea, row.fecha, row.part, row.lot_no],
    );
    let group = groups.get(key);
    if (!group) {
      group = {
        linea: row.linea,
        fecha: row.fecha,
        part: row.part,
        lot_no: allLines ? "" : row.lot_no,
        total: 0,
        unicas: 0,
        repetidas: 0,
        DIA: 0,
        "TIEMPO EXTRA": 0,
        NOCHE: 0,
      };
      groups.set(key, group);
    }
    const repeated =
      row.duplicado_historico === true ||
      text(row.status).toLocaleLowerCase("es").includes("duplic");
    group.total = number(group.total) + 1;
    group.repetidas = number(group.repetidas) + Number(repeated);
    group.unicas = number(group.total) - number(group.repetidas);
    const shift = text(row.turno);
    group[shift] = number(group[shift]) + 1;
  }
  return [...groups.values()].sort((a, b) => number(b.total) - number(a.total));
}
function metric(value: unknown): PpmMetric {
  const data = object(value);
  for (const field of ["inspected", "defects", "ppm", "target"]) {
    if (!Number.isSafeInteger(data[field]) || number(data[field]) < 0)
      throw new Error("El servidor devolvió una métrica PPM inválida.");
  }
  return {
    inspected: number(data.inspected),
    defects: number(data.defects),
    ppm: number(data.ppm),
    target: number(data.target),
  };
}
function periods(value: unknown): PpmPeriod[] {
  return rows(value).map((row) => ({
    ...metric(row),
    key: text(row.key),
    label: text(row.label),
  }));
}
function parts(value: unknown) {
  return rows(value).map((row) => ({
    ...metric(row),
    part_number: text(row.part_number),
    model: text(row.model),
    line: text(row.line),
  }));
}
export function ppmReport(value: unknown): PpmReport {
  const data = object(value);
  const weekly = object(data.lineWeeklyDetails);
  return {
    stage: text(data.stage),
    target: number(data.target),
    dateFrom: text(data.dateFrom),
    dateTo: text(data.dateTo),
    trendYear: number(data.trendYear),
    summary: metric(data.summary),
    periods: periods(data.periods),
    trend: periods(data.trendPeriods ?? data.periods),
    lines: Array.isArray(data.lines) ? data.lines.map(text) : [],
    topParts: parts(data.topParts),
    topDetails: parts(data.topPartDetails ?? data.topParts),
    byPart: parts(data.byPart),
    byLine: rows(data.byLine).map((row) => ({
      ...metric(row),
      line: text(row.line),
    })),
    weekly: {
      periods: rows(weekly.periods).map((row) => ({
        key: text(row.key),
        label: text(row.label),
      })),
      rows: rows(weekly.rows).map((row) => ({
        line: text(row.line),
        weeks: periods(row.weeks),
      })),
    },
  };
}
