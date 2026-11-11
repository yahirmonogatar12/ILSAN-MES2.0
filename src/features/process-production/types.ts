export type Kind = "ASSY" | "IMT" | "SMT";
export type Row = Record<string, unknown>;
export interface Filters {
  start: string;
  end: string;
  line: string;
  view: string;
  proceso: string;
  part_number: string;
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
export type Action = "create" | "update" | "status" | "order" | "reschedule";
export type Extra =
  | "scan"
  | "assign-scan"
  | "create-scan"
  | "proposals"
  | "diff"
  | "apply-diff"
  | "import-proposal"
  | "wos"
  | "import-wos";
export interface Api {
  plans(kind: Kind, filters: Filters, signal?: AbortSignal): Promise<Row[]>;
  pending(kind: Kind, filters: Filters, signal?: AbortSignal): Promise<Row[]>;
  action(kind: Kind, action: Action, payload: Row): Promise<Row>;
  revisions(part: string, signal?: AbortSignal): Promise<Row[]>;
  extra(name: Extra, payload: Row, signal?: AbortSignal): Promise<unknown>;
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
