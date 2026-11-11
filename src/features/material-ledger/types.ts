export type HistoryKind = "entradas" | "salidas" | "retornos";
export type InventoryView = "summary" | "detail";
export type CellValue = string | number | boolean | null;
export type LedgerRow = Record<string, CellValue>;
export type Searches = Readonly<Record<string, string>>;
export interface HistoryFilters {
  fecha_inicio: string;
  fecha_fin: string;
  texto: string;
}
export interface InventoryFilters {
  numero_parte: string;
  codigo_material_recibido: string;
  ubicacion: string;
  include_zero_stock: string;
  only_na: string;
  use_dates: string;
  fecha_inicio: string;
  fecha_fin: string;
}
export interface LedgerPage {
  data: LedgerRow[];
  total: number;
  limit: number;
  offset: number;
}
export interface LedgerApi {
  history(
    kind: HistoryKind,
    filters: HistoryFilters,
    searches: Searches,
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<LedgerPage>;
  summary(
    filters: InventoryFilters,
    signal?: AbortSignal,
  ): Promise<LedgerRow[]>;
  lots(
    filters: InventoryFilters,
    searches: Searches,
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<LedgerPage>;
  exportHistory(
    kind: HistoryKind,
    filters: HistoryFilters,
    searches: Searches,
  ): Promise<void>;
  exportInventory(
    view: InventoryView,
    filters: InventoryFilters,
    searches: Searches,
  ): Promise<void>;
}
