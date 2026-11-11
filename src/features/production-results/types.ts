import type { FilterField } from "@/shared/ui";

export type Row = Record<string, unknown>;
export type Filters = Record<string, string>;
export interface ColumnSpec {
  key: string;
  title: string;
  width: number;
  numeric?: boolean;
  filterable?: boolean;
  searchValue?: (row: Row) => string;
  searchLabel?: string;
}
export interface ViewSpec {
  id: string;
  title: string;
  path: string;
  exportPath?: string;
  columns: readonly ColumnSpec[];
  fields: readonly FilterField<Filters>[];
  defaults: Filters;
  minWidth: number;
  remote?: boolean;
  limit?: number;
  exportLimit?: number;
  responseKey?: "records" | "rows" | "pruebas";
  params?: Filters | ((filters: Filters) => Filters);
  exportPage?: boolean;
  manual?: boolean;
  validate?: (filters: Filters) => string;
  progressPath?: string;
  mapRows?: (items: Row[], filters: Filters) => Row[];
}
export interface Report {
  rows: Row[];
  total: number;
  page: number;
  perPage: number;
  warnings?: string[];
  meta?: Row;
  summary?: Row;
}
export interface Closure {
  batchId: number | null;
  valid: boolean;
  metadata: Row;
  rows: Row[];
  summary: Row;
  history: Row[];
  errors: string[];
}
