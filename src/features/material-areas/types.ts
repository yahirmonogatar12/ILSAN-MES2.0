export type Area = "smd" | "micom" | "imd" | "assy" | "ipm";
export type ConnectedArea = Exclude<Area, "assy">;
export type Consultation =
  | "entradas"
  | "salidas"
  | "inventario"
  | "inventario_chamber"
  | "inventario_completo";
export type InventoryView =
  | "inventario_general"
  | "inventario_chamber_general"
  | "inventario_completo_general";
export type AreaView = Consultation | InventoryView;
export type AreaRow = Record<string, string | number | boolean | null>;
export type Searches = Record<string, string>;
export type SearchesByView = Partial<Record<AreaView, Searches>>;
export interface AreaFilters {
  consulta: Consultation;
  modo: "general" | "detallado";
  start: string;
  end: string;
}
export interface AreaResult {
  rows: AreaRow[];
  total: number;
  piezas: number;
  page: number;
  per_page: number;
  total_pages: number;
}
export interface AreaApi {
  list(
    area: ConnectedArea,
    filters: AreaFilters,
    searches: Searches,
    page: number,
    size: number,
    signal?: AbortSignal,
  ): Promise<AreaResult>;
  export(
    area: ConnectedArea,
    filters: AreaFilters,
    searches: Searches,
  ): Promise<void>;
}
export type ColumnSpec = readonly [
  field: string,
  title: string,
  weight: number,
];
