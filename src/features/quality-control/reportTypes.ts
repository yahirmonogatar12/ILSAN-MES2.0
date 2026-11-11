import type { Row } from "./types";
export type PpmStage = "lqc" | "oqc";
export interface LqcFilters {
  fecha_inicio: string;
  fecha_fin: string;
  linea: string;
  turno: string;
  search: string;
}
export interface OqcFilters {
  search: string;
  fecha_desde: string;
  fecha_hasta: string;
}
export interface PpmFilters {
  fecha_inicio: string;
  fecha_fin: string;
  linea: string;
  q: string;
  group_by: string;
}
export interface LqcOverview {
  date: string;
  updated: string;
  lines: Row[];
  uph: Record<string, Row>;
  slots: Row[];
}
export interface OqcReport {
  rows: Row[];
  summary: Row;
  truncated: boolean;
  limit: number;
}
export interface PpmMetric {
  inspected: number;
  defects: number;
  ppm: number;
  target: number;
}
export interface PpmPeriod extends PpmMetric {
  key: string;
  label: string;
}
export interface PpmPart extends PpmMetric {
  part_number: string;
  model: string;
  line: string;
}
export interface PpmReport {
  stage: string;
  target: number;
  dateFrom: string;
  dateTo: string;
  trendYear: number;
  summary: PpmMetric;
  periods: PpmPeriod[];
  trend: PpmPeriod[];
  lines: string[];
  byLine: (PpmMetric & { line: string })[];
  topParts: PpmPart[];
  topDetails: PpmPart[];
  byPart: PpmPart[];
  weekly: {
    periods: { key: string; label: string }[];
    rows: { line: string; weeks: PpmPeriod[] }[];
  };
}
