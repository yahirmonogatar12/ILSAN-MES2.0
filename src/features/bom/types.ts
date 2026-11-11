export interface BomFilters {
  modelo: string;
  classification: string;
  bom_revision: string;
}
export interface BomItem {
  id: string | number;
  modelo: string;
  numeroParte: string;
  tipoMaterial: string;
  classification: string;
  especificacionMaterial: string;
  vender: string;
  cantidadTotal: number | string;
  ubicacion: string;
  materialSustituto: string;
  materialOriginal: string | null;
  registrador: string;
  fechaRegistro: string;
  bomRevision?: string;
}
export interface Revision {
  bom_rev: string;
  is_current: boolean;
  eco_no?: string;
}
export interface EcoRow {
  id: string | number;
  eco_no: string;
  part_no: string;
  bom_revision: string;
  effective_at: string;
  status: string;
  origen: string;
  approved_by?: string;
  scope_parts?: string;
  scope_count?: number;
  notes?: string;
  item_name?: string;
  created_by?: string;
  [key: string]: unknown;
}
export type ItemData = Record<string, unknown>;
export interface EcoDetail extends EcoRow {
  items: ItemData[];
  scope?: ItemData[];
}
export interface Diff {
  added: ItemData[];
  modified: ItemData[];
  modified_admin: ItemData[];
  removed: ItemData[];
  counts: {
    added: number;
    modified: number;
    modified_admin: number;
    removed: number;
  };
  warning?: { message?: string } | null;
}
export interface EcoFilters {
  status: string;
  part_no: string;
  origen: string;
  eco_no: string;
  date_from: string;
  date_to: string;
}
export interface EcoList {
  data: EcoRow[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    filters_active: boolean;
    has_more: boolean;
  };
}
export interface Family {
  family: string;
  parts: { part_no: string; item_name?: string }[];
  missing: string[];
}
export interface EcoDraft {
  kind: "SINGLE" | "FAMILY" | "NEW_BOM";
  eco_no: string;
  part_no: string;
  family: string;
  suffixes: string;
  effective_at: string;
  item_name: string;
  notes: string;
}
export interface FileRecord {
  id: number;
  nombre_original: string;
  extension: string;
  created_by?: string;
  created_at?: string;
}
export interface BomApi {
  models(signal?: AbortSignal): Promise<string[]>;
  revisions(model: string, signal?: AbortSignal): Promise<Revision[]>;
  list(filters: BomFilters, signal?: AbortSignal): Promise<BomItem[]>;
  export(filters: BomFilters): Promise<void>;
  history(
    filters: EcoFilters,
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<EcoList>;
  exportHistory(filters: EcoFilters): Promise<void>;
  detail(row: EcoRow, signal?: AbortSignal): Promise<EcoDetail>;
  diff(id: number, signal?: AbortSignal): Promise<Diff>;
  family(family: string, suffixes: string): Promise<Family>;
  nextRevision(parts: string[], signal?: AbortSignal): Promise<string>;
  template(draft: EcoDraft): Promise<void>;
  importEco(
    draft: EcoDraft,
    parts: string[],
    file: File,
  ): Promise<{ eco_id: number; bom_revision?: string }>;
  importItems(id: number, file: File): Promise<void>;
  action(id: number, action: "approve" | "cancel" | "delete"): Promise<void>;
  files(id: number, signal?: AbortSignal): Promise<FileRecord[]>;
  paperwork(
    part: string,
    signal?: AbortSignal,
  ): Promise<{ eco: EcoRow | null; files: FileRecord[] }>;
  upload(id: number, file: File): Promise<void>;
  removeFile(id: number, fileId: number): Promise<void>;
  fileBlob(id: number, file: FileRecord, signal?: AbortSignal): Promise<Blob>;
  download(id: number, file: FileRecord): Promise<void>;
}
