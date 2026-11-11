export type CatalogKind = "smt" | "models";
export type Cell = string | number | boolean | null;
export type ModelRow = Record<string, Cell>;
export interface CatalogData {
  columns: string[];
  rows: ModelRow[];
  total: number;
}
export interface CatalogApi {
  list(search: string, signal?: AbortSignal): Promise<CatalogData>;
  save(
    values: ModelRow,
    original: ModelRow | null,
    columns: string[],
    actor: string,
  ): Promise<void>;
  remove(record: ModelRow): Promise<void>;
  familyLines(
    familia: string,
    lineas: string,
  ): Promise<{ partes: number; lineas: string | null }>;
}
