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
export type Quantity = number | string | null;
export type DateQuantities = Record<string, Quantity>;
export interface Inventory extends Row {
  lgemm?: Quantity;
  isemm?: Quantity;
  svc?: Quantity;
  dif?: Quantity;
  pendiente?: Quantity;
  rework?: Quantity;
  smt?: Quantity;
  imd?: Quantity;
  i0?: Quantity;
  line?: string | null;
  ref_date?: string | null;
}
export interface PivotRow extends Row {
  part_no: string;
  qty?: DateQuantities;
  sched?: DateQuantities;
  proj?: DateQuantities;
  inv?: Inventory | null;
  total?: Quantity;
  req_lg?: Quantity;
  sched_total?: Quantity;
}
export interface PurchaseOrder extends Row {
  codigo_po: string;
  nombre_po?: string | null;
  modelo?: string | null;
  cliente?: string | null;
  estado?: string | null;
  total_cantidad_entregada?: Quantity;
  cantidad_entregada?: Quantity;
}
export interface WorkOrder extends Row {
  codigo_wo: string;
  id?: number;
  modelo?: string | null;
  codigo_modelo?: string | null;
  codigo_po?: string | null;
  estado?: string | null;
  cantidad_planeada?: Quantity;
}
export type Order = PurchaseOrder | WorkOrder;
export interface ActionPayloads {
  "create-po": Row & {
    nombre_po: string;
    modelo: string;
    cliente: string;
    fecha_registro: string;
    total_cantidad_entregada: number;
    cantidad_entregada?: number;
  };
  "create-wo": Row & {
    modelo: string;
    cantidad_planeada: number;
    fecha_operacion: string;
    codigo_po?: string;
  };
  "update-wo": Row & {
    codigo_wo: string;
    modelo: string;
    cantidad_planeada: number;
  };
  "delete-wo": Row & { codigo_wo: string };
  "state-wo": Row & { codigo_wo: string; estado: string };
  "link-wo": Row & { codigo_wo: string; codigo_po: string };
  "import-wos": Row & { wo_ids: number[]; import_date: string };
  schedule: Row & {
    part_no: string;
    sched_date: string;
    sched_qty: number | null;
    linea: string;
    turno: string;
  };
  "inventory-field": Row & { part_no: string; field: string; value: number };
  propose: Row & { date_from: string; date_to: string };
  "apply-proposal": Row & {
    proposal_id: string;
    version: number;
    items: (Row & {
      item_id: string;
      included: boolean;
      sched_date: string;
      linea: string;
      turno: string;
      qty: number;
    })[];
  };
  "reject-proposal": Row & {
    proposal_id: string;
    version: number;
    reason_code: string;
    reason_text: string;
  };
  generate: Row & { fecha: string };
  "generate-faltantes": Row & { fecha: string };
  "generate-schedule": Row & { fecha: string };
  "acomodar-ia": Row & { fecha: string };
  "confirm-lots": Row & { fecha: string };
  "config-lines": Row & { lineas: string };
  "add-lot": Row & {
    fecha: string;
    part_no: string;
    qty: number;
    linea?: string;
  };
  "update-lot": Row & { id: number; field: string; value: unknown };
  "delete-lot": Row & { id: number };
}
export interface PivotResult extends Row {
  dates: string[];
  rows: PivotRow[];
  total_parts: number;
  page: number;
  page_size: number;
  date_from: string;
  date_to: string;
}
export type Action = keyof ActionPayloads;
export interface ProjectedLot extends Row {
  id: number;
  lot_no?: string | null;
  part_no?: string | null;
  qty_plan?: Quantity;
  fisico?: Quantity;
  status?: string | null;
}
export interface ProjectedPlan extends Row {
  lotes: ProjectedLot[];
  lineas: Row[];
  lineas_activas?: string[];
}
export interface ScheduleItem extends Row {
  item_id: string;
  part_no: string;
  sched_date: string;
  linea: string;
  turno: string;
  qty: number;
}
export interface ScheduleProposal extends Row {
  proposal_id: string;
  version: number;
  proposals: ScheduleItem[];
}
export type ActionResults = {
  [A in Action]: A extends "propose" ? ScheduleProposal : Row;
};
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
  ): Promise<Order[]>;
  models(signal?: AbortSignal): Promise<string[]>;
  pivot(
    filters: PivotFilters,
    page: number,
    size: number,
    signal?: AbortSignal,
  ): Promise<PivotResult>;
  lots(fecha: string, signal?: AbortSignal): Promise<ProjectedPlan>;
  history(signal?: AbortSignal): Promise<Row[]>;
  action<A extends Action>(
    action: A,
    payload: ActionPayloads[A],
  ): Promise<ActionResults[A]>;
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
