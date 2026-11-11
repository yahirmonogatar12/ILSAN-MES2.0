export interface ScrapRecord {
  id: number | string;
  cliente: string | null;
  fecha: string;
  hora: string;
  scanned_original: string;
  part_no: string | null;
  modelo: string | null;
  area: string | null;
  proceso: string | null;
  motivo_scrap_texto: string | null;
  cantidad: number | string | null;
  comentarios: string | null;
  usuario_registro: string | null;
}

export interface ScrapFilters {
  start: string;
  end: string;
  area: string;
}

export type ColumnSearches = Record<string, string>;
