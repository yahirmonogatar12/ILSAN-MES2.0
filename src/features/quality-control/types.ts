export type Row = Record<string, unknown>;
export type HistoryKind =
  | "smt"
  | "imd"
  | "assy"
  | "pasta"
  | "mask"
  | "squeegee"
  | "interlock"
  | "vision";
export type HistoryFilters = Record<string, string>;
export interface ColumnSpec {
  key: string;
  title: string;
  width: number;
}
export interface HistoryFilter {
  key: string;
  title: string;
  type?: "search" | "select" | "text" | "date" | "number" | "checkbox";
  min?: number;
  step?: number | "any";
  optionsKey?: string;
  options?: readonly string[];
}
export interface HistoryConfig {
  title: string;
  endpoint: string;
  filename: string;
  minWidth: number;
  columns: readonly ColumnSpec[];
  filters: readonly HistoryFilter[];
}
export interface HistoryResult {
  rows: Row[];
  page: number;
  perPage: number;
  total: number;
  stopped?: string;
}
export interface Station {
  id: number;
  station_code: string;
  station_name: string;
  station_type: "ICT" | "FCT" | "Packing";
  host_name: string;
  is_active: boolean;
  created_at_utc: string;
  updated_at_utc: string;
}
export type StationDraft = Pick<
  Station,
  "station_code" | "station_name" | "station_type" | "host_name" | "is_active"
>;
export interface StationFilters {
  q: string;
  station_type: string;
}
