export type LabelType = "MICOM" | "COMP";
export interface FpaItem {
  id: number;
  labelType: LabelType;
  code: string;
  requested: number;
  consumed: number;
  confirmed: number;
  remaining: number;
}
export interface FpaRequest {
  id: number;
  folio: string;
  fpaPartNumber: string;
  requester: string;
  status: string;
  createdAt: string;
  items: FpaItem[];
}
export interface Attempt {
  id: number;
  createdAt: string;
  labelType: string;
  quantity: number;
  operator: string;
  stationId: string;
  status: string;
  error: string | null;
}
export interface FpaEvent {
  id: number;
  createdAt: string;
  type: string;
  actor: string;
  reason: string | null;
}
export interface FpaDetail extends FpaRequest {
  printAttempts: Attempt[];
  events: FpaEvent[];
}
export interface Filters {
  dateFrom: string;
  dateTo: string;
  folio: string;
  fpaPartNumber: string;
  requester: string;
  status: string;
}
export interface RequestDraft {
  fpaPartNumber: string;
  pgmMicom: string;
  micomQuantity: string;
  pgmComp: string;
  compQuantity: string;
}
export interface RequestPayload extends Omit<
  RequestDraft,
  "micomQuantity" | "compQuantity"
> {
  micomQuantity: number;
  compQuantity: number;
}
export interface Adjustment {
  reason: string;
  micomQuantity?: number;
  compQuantity?: number;
}
export interface FpaApi {
  list(
    filters: Filters,
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<{ data: FpaRequest[]; meta: { total: number } }>;
  detail(id: number, signal?: AbortSignal): Promise<FpaDetail>;
  create(payload: RequestPayload, key: string): Promise<FpaRequest>;
  adjust(id: number, payload: Adjustment): Promise<FpaRequest>;
  export(filters: Filters): Promise<void>;
}
