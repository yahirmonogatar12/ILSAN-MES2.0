export type InvoiceScope = "ALMACEN" | "EMBARQUES";
export type DataRow = Record<string, unknown>;
export interface RecordList {
  records: DataRow[];
  total: number;
}
export interface RemoteList extends RecordList {
  limit: number;
  offset: number;
}
export interface InvoiceFilters {
  q: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
}
export interface PurchaseFilters extends InvoiceFilters {
  tipo: string;
}
export interface ValuationFilters {
  numero_parte: string;
  codigo_material_recibido: string;
  pallet_no: string;
  fuente_costo: string;
  include_zero_stock: string;
}
export interface InvoiceDetail {
  invoice: DataRow;
  lines: DataRow[];
  packing: DataRow[];
  links: DataRow[];
  manual_receipts: DataRow[];
}
export interface PurchaseDetail {
  numero_transaccion: string;
  tipo: string;
  transaccion: DataRow;
  lineas: DataRow[];
  links: DataRow[];
}
export interface InvoicePreview extends DataRow {
  numero_invoice: string;
  lines: DataRow[];
  warnings: string[];
  duplicado: DataRow | null;
}
export interface PurchasePreview extends DataRow {
  sample: DataRow[];
  warnings: string[];
  bloqueado_inicial: boolean;
  sync: DataRow | null;
}
export interface InvoiceUpload {
  file: File;
  numero_invoice: string;
  tipo: string;
}
export type PurchaseMode = "INICIAL" | "ACTUALIZACION" | "SINCRONIZACION";
export interface PurchaseUpload {
  file: File;
  tipo: "LG" | "OVEN";
  modo: PurchaseMode;
}
export interface LineDraft {
  line_no: string;
  raw_part_num: string;
  numero_parte_sistema: string;
  descripcion: string;
  cantidad: string;
  uom: string;
  costo_unitario: string;
  costo_total: string;
}
export type InvoiceAction = "apply" | "unapply" | "reapply" | "close";
export interface FileData {
  blob: Blob;
  name: string;
}
export interface InvoiceApi {
  list(
    scope: InvoiceScope,
    filters: InvoiceFilters,
    signal?: AbortSignal,
  ): Promise<RecordList>;
  detail(
    scope: InvoiceScope,
    id: number,
    signal?: AbortSignal,
  ): Promise<InvoiceDetail>;
  preview(
    scope: InvoiceScope,
    upload: InvoiceUpload,
    signal?: AbortSignal,
  ): Promise<InvoicePreview>;
  upload(scope: InvoiceScope, upload: InvoiceUpload): Promise<DataRow>;
  remove(scope: InvoiceScope, id: number): Promise<DataRow>;
  updateLine(
    scope: InvoiceScope,
    id: number,
    line: number,
    draft: LineDraft,
  ): Promise<DataRow>;
  removeLine(scope: InvoiceScope, id: number, line: number): Promise<DataRow>;
  action(
    scope: InvoiceScope,
    id: number,
    action: InvoiceAction,
    payload: DataRow,
  ): Promise<DataRow>;
  manual(
    scope: InvoiceScope,
    id: number,
    packing: number,
    recibido: boolean,
    comentario: string,
  ): Promise<DataRow>;
  partial(
    scope: InvoiceScope,
    id: number,
    code: string,
    signal?: AbortSignal,
  ): Promise<DataRow & { records: DataRow[] }>;
  link(
    scope: InvoiceScope,
    id: number,
    code: string,
    packing: number,
    note: string,
  ): Promise<DataRow>;
  file(
    scope: InvoiceScope,
    id: number,
    signal?: AbortSignal,
  ): Promise<FileData>;
  download(scope: InvoiceScope, id: number): Promise<void>;
}
export interface PurchaseApi {
  loads(type: string, signal?: AbortSignal): Promise<RecordList>;
  file(id: number, signal?: AbortSignal): Promise<FileData>;
  download(id: number): Promise<void>;
  list(filters: PurchaseFilters, signal?: AbortSignal): Promise<RecordList>;
  detail(
    number: string,
    type: string,
    signal?: AbortSignal,
  ): Promise<PurchaseDetail>;
  initial(signal?: AbortSignal): Promise<{ LG: boolean; OVEN: boolean }>;
  preview(
    upload: PurchaseUpload,
    signal?: AbortSignal,
  ): Promise<PurchasePreview>;
  upload(upload: PurchaseUpload): Promise<DataRow>;
  action(
    number: string,
    type: string,
    action: "close" | "unapply" | "reapply",
    payload: DataRow,
  ): Promise<DataRow>;
}
export interface ValuationApi {
  list(
    filters: ValuationFilters,
    page: number,
    size: number,
    signal?: AbortSignal,
  ): Promise<RemoteList>;
  summary(filters: ValuationFilters, signal?: AbortSignal): Promise<DataRow[]>;
  export(filters: ValuationFilters): Promise<void>;
  backfill(dryRun: boolean): Promise<DataRow>;
}
