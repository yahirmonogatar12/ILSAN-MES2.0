export type Row = Record<string, unknown>;
export interface OrderFilters {
  fecha_desde: string;
  fecha_hasta: string;
  estado: string;
  cliente: string;
  modelo: string;
}
export interface PivotFilters {
  date_from: string;
  date_to: string;
  part: string;
  only_shortage: string;
}
export interface PivotResult {
  dates: string[];
  rows: Row[];
  total_parts: number;
  page: number;
  page_size: number;
  date_from: string;
  date_to: string;
}
export type Action =
  | "create-po"
  | "create-wo"
  | "update-wo"
  | "delete-wo"
  | "state-wo"
  | "link-wo"
  | "import-wos"
  | "schedule"
  | "inventory-field"
  | "propose"
  | "apply-proposal"
  | "reject-proposal"
  | "generate"
  | "generate-faltantes"
  | "generate-schedule"
  | "acomodar-ia"
  | "confirm-lots"
  | "config-lines"
  | "add-lot"
  | "update-lot"
  | "delete-lot";
export type FileAction =
  "preview-lg" | "confirm-lg" | "inventory" | "sync-schedule" | "wo-excel";
export interface Upload {
  file: File;
  plan_year?: string;
  file_sha256?: string;
  import_mode?: string;
  include_zero?: string;
  fecha_operacion?: string;
}
export interface PlanningApi {
  orders(
    kind: "po" | "wo",
    filters: OrderFilters,
    signal?: AbortSignal,
  ): Promise<Row[]>;
  models(signal?: AbortSignal): Promise<string[]>;
  pivot(
    filters: PivotFilters,
    page: number,
    size: number,
    signal?: AbortSignal,
  ): Promise<PivotResult>;
  lots(fecha: string, signal?: AbortSignal): Promise<Row>;
  history(signal?: AbortSignal): Promise<Row[]>;
  action(action: Action, payload: Row): Promise<Row>;
  upload(
    action: FileAction,
    upload: Upload,
    signal?: AbortSignal,
  ): Promise<Row>;
  exportWO(filters: OrderFilters): Promise<void>;
}
export type Spec = readonly [key: string, title: string, weight: number];
export interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "checkbox";
  required?: boolean;
  min?: number;
  step?: number;
  options?: readonly { value: string; label: string }[];
  suggestions?: readonly string[];
  readOnly?: boolean;
  hint?: string;
}
