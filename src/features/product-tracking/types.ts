export type TraceView = "por_pcb" | "materiales" | "por_proveedor";
export type Filters = Record<string, string>;
export type TraceRow = Record<string, string | number | boolean | null>;

export interface Stage {
  etapa: string;
  ok: boolean;
  estado: string;
  clase: string;
  fecha: string;
  celda: string;
}
export interface Piece {
  codigo: string;
  qr: string;
  barcode: string;
  barcode_anterior: string;
  reemplazado_por: string;
  sin_barcode: boolean;
  sin_qr: boolean;
  reconstruido: boolean;
  encontrado: boolean;
  en_exceso: boolean;
  estado_global: string;
  clase_global: string;
  registradas: number;
  total: number;
  ultima_etapa: string;
  ultima_fecha: string;
  etapas: Stage[];
}
export interface ListResult<T> {
  items: T[];
  message: string;
  fecha_hoy: string;
}
export interface BatchResult extends ListResult<Piece> {
  etapas: string[];
  total: number;
  encontrados: number;
  no_encontrados: number;
}
export interface PieceStage extends Stage {
  piece: Piece;
  pieceKey: string;
  sequence: number;
}
