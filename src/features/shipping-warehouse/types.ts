export type Row = Record<string, unknown>;
export type HistoryKind = "entries" | "exits" | "returns";
export type ListKind =
  HistoryKind | "movements" | "audit" | "inventory" | "catalog";
export type MovementType = "entry" | "exit" | "return";
export type QaKind = "entrada" | "liberacion";

export interface Filters {
  search: string;
  fecha_desde: string;
  fecha_hasta: string;
  tipo: string;
  status: string;
  accion: string;
}
export interface Listing {
  rows: Row[];
  summary: Row;
  metadata: Row;
}
export interface BatchPreview extends Listing {
  valid: boolean;
  batchId: number | null;
  batchCode: string;
  errors: string[];
  closureImpact: Row;
  history: Row[];
}
export interface Adjustment {
  partNumber: string;
  quantity: number;
  movementAt: string;
  reason: string;
}
export interface ReceiptLine {
  part_number: string;
  packing_line_ids: number[];
  cantidad_confirmada: number;
}
export interface ReturnPayload {
  partNumber: string;
  returnQty: number;
  lossQty: number;
  movementType: "entry" | "exit";
  reason: string;
  location: string;
  remarks: string;
  registeredBy: string;
}
export interface Attachment {
  blob: Blob;
  name: string;
}
