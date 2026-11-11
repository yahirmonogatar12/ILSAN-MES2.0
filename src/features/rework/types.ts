export type Origin = "EMBARQUES" | "SMD" | "PRODUCCION";
export type Material = "ASSY" | "IMD_SMD";
export type ComponentType = "ASSY" | "SMD" | "IMD";
export interface Filters {
  desde: string;
  hasta: string;
  codigo: string;
  estado: string;
}
export interface Area {
  area: string;
  nombre: string;
  hecho: number;
  total: number;
  estado: string;
}
export interface ProgrammingOption {
  ic_location: string;
  micom_part_no: string;
  programming_label: string;
}
export interface Programming extends ProgrammingOption {
  fpa_request_id: number | null;
  fpa_folio: string;
  fpa_status: string;
}
export interface Component {
  tipo: ComponentType;
  ubicacion: string;
  np_anterior: string;
  np_nuevo: string;
}
export interface Shipment {
  folio: string;
  part_number: string;
  cantidad: number;
  registrado_por: string;
  created_at: string;
  cajas: string[];
}
export interface Scan {
  etapa: string;
  qr_smd_anterior: string;
  qr_smd_nuevo: string;
  qr_assy_anterior: string;
  qr_assy_nuevo: string;
  usuario: string;
  created_at: string;
}
export interface ReworkSummary {
  id: number;
  folio: string;
  np_origen: string;
  np_destino: string;
  cantidad: number;
  tipo_material: Material;
  cambio_etiquetas: boolean;
  lote_impresion: string;
  comentarios: string;
  origenes_txt: string;
  status: string;
  estado: string;
  areas: Area[];
  emb_solicitado: number;
  emb_surtido: number;
  solicitado_por: string;
  cancelado_por: string;
  cancelado_at: string;
  created_at: string;
}
export interface ReworkDetail extends ReworkSummary {
  origenes: { origen: Origin; cantidad: number }[];
  programaciones: Programming[];
  componentes: Component[];
  salidas_embarques: Shipment[];
  escaneos: Scan[];
}
export interface RequestPayload {
  np_origen: string;
  np_destino: string;
  tipo_material: Material;
  origenes: { origen: Origin; cantidad: number }[];
  programaciones: Pick<
    ProgrammingOption,
    "ic_location" | "programming_label"
  >[];
  componentes: Component[];
  comentarios: string;
}
export interface ComponentDraft extends Component {
  key: string;
}
export interface RequestDraft {
  np_origen: string;
  np_destino: string;
  tipo_material: Material;
  cantidades: Record<Origin, string>;
  programmingEnabled: boolean;
  programmingPart: string;
  programaciones: Pick<
    ProgrammingOption,
    "ic_location" | "programming_label"
  >[];
  componentes: ComponentDraft[];
  comentarios: string;
}
export interface ReworkApi {
  list(filters: Filters, signal?: AbortSignal): Promise<ReworkSummary[]>;
  detail(id: number, signal?: AbortSignal): Promise<ReworkDetail>;
  models(signal?: AbortSignal): Promise<string[]>;
  programming(part: string, signal?: AbortSignal): Promise<ProgrammingOption[]>;
  create(payload: RequestPayload, key: string): Promise<ReworkDetail>;
  cancel(id: number): Promise<{ record: ReworkDetail; avisos: string[] }>;
  export(filters: Filters): Promise<void>;
}
