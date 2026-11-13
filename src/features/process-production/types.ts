export type Kind = "ASSY" | "IMT" | "SMT";
/** Extensible display/form records preserve fields returned by the legacy API. */
export type Row = Record<string, unknown>;
export type Quantity = number | string | null;
export interface Plan extends Row {
  lot_no: string;
  working_date?: string | null;
  line?: string | null;
  part_no?: string | null;
  sub_assy?: string | null;
  wo_code?: string | null;
  po_code?: string | null;
  model_code?: string | null;
  project?: string | null;
  process?: string | null;
  status?: string | null;
  shift?: string | null;
  turno?: string | null;
  lado?: string | null;
  lote_padre?: string | null;
  assigned_bom_rev?: string | null;
  plan_count?: Quantity;
  input?: Quantity;
  output?: Quantity;
  produced?: Quantity;
  produced_count?: Quantity;
  ct?: Quantity;
  uph?: Quantity;
  routing?: Quantity;
  group_no?: Quantity;
  sequence?: Quantity;
  qr_required_count?: Quantity;
  array_size?: Quantity;
}
export type PlanDialog =
  | { type: "new" }
  | { type: "edit" | "cancel" | "group"; row: Plan }
  | { type: "import" | "reschedule" | "wos" | "scan" | "proposals" }
  | null;
export interface PlanValues extends Row {
  working_date: string;
  line: string;
  part_no: string;
  plan_count: number;
}
export interface PlanUpdate extends Row {
  lot_no: string;
  plan_count?: number;
  status?: string;
  assigned_bom_rev?: string;
}
export interface PlanSequence extends Row {
  lot_no: string;
  sequence: number;
  group_no?: number;
  plan_start_date?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  effective_minutes?: Quantity;
  breaks_minutes?: Quantity;
}
export interface ActionPayloads {
  create: PlanValues;
  update: PlanUpdate;
  status: Row & {
    lot_no: string;
    status: string;
    pause_reason?: string;
    end_reason?: string;
  };
  order: Row & { sequences: PlanSequence[] };
  reschedule: Row & { lot_nos: string[]; new_working_date: string };
}
export type Action = keyof ActionPayloads;
export interface WorkOrder extends Row {
  id: number;
  wo_code?: string | null;
  codigo_wo?: string | null;
  modelo?: string | null;
  cantidad_planeada?: Quantity;
  ya_importado?: boolean | number | null;
}
export interface ScanLot extends Row {
  linea: string;
  nparte: string;
  cantidad_total?: Quantity;
}
export interface ScanResult extends Row {
  scan_lots: ScanLot[];
  plan_options: Plan[];
}
export interface Proposal extends Row {
  proposal_id: string;
  version?: number;
}
export interface ProposalChange extends Row {
  lot_no: string;
  antes: Row;
  despues: Row;
  campos?: string[];
  aplicables?: string[];
}
export interface ProposalDiff extends Row {
  proposal_id?: string;
  version?: number;
  cambios: ProposalChange[];
  nuevos: Row[];
  sobran: Row[];
}
export interface ExtraPayloads {
  wos: Row & { desde?: string; hasta?: string; include_import_status?: number };
  scan: Row & {
    date_from: string;
    date_to: string;
    line?: string;
    part_no?: string;
    limit?: number;
  };
  proposals: Row;
  diff: Row & { proposal_id: string };
  "assign-scan": Row & {
    linea: string;
    nparte: string;
    target_lot_no: string;
    allow_extend: boolean;
  };
  "create-scan": Row & { linea: string; nparte: string; working_date: string };
  "import-wos": Row & { wo_ids: number[]; import_date: string };
  "apply-diff": Row & {
    proposal_id: string;
    cambios: (Row & { lot_no: string })[];
  };
  "import-proposal": Row & { proposal_id: string };
}
export interface ExtraResults {
  wos: WorkOrder[];
  scan: ScanResult;
  proposals: Proposal[];
  diff: ProposalDiff;
  "assign-scan": Row;
  "create-scan": Row;
  "import-wos": Row;
  "apply-diff": Row;
  "import-proposal": Row;
}
export type Extra = keyof ExtraPayloads;
export interface Filters {
  start: string;
  end: string;
  line: string;
  view: string;
  proceso: string;
  part_number: string;
}
export interface AssyToolProps {
  initial: Filters;
  onClose: () => void;
  onDone: (result: Row) => void;
}
export type Spec = readonly [string, string, number];
export interface Field {
  key: string;
  label: string;
  type?: "number" | "date" | "select" | "checkbox" | "textarea";
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  options?: { value: string; label: string }[];
}
export interface Api {
  plans(kind: Kind, filters: Filters, signal?: AbortSignal): Promise<Plan[]>;
  pending(kind: Kind, filters: Filters, signal?: AbortSignal): Promise<Plan[]>;
  action<A extends Action>(
    kind: Kind,
    action: A,
    payload: ActionPayloads[A],
  ): Promise<Row>;
  revisions(part: string, signal?: AbortSignal): Promise<Row[]>;
  extra<A extends Extra>(
    name: A,
    payload: ExtraPayloads[A],
    signal?: AbortSignal,
  ): Promise<ExtraResults[A]>;
  upload(kind: Kind, file: File, workingDate: string): Promise<Row>;
  export(kind: Kind, rows: Row[]): Promise<void>;
  report(
    kind: "operations" | "outputs",
    filters: Filters,
    searches: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ rows: Row[]; summary: Row }>;
  exportReport(
    kind: "operations" | "outputs",
    filters: Filters,
    searches: Record<string, string>,
  ): Promise<void>;
}
