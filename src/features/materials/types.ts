export interface VendorCost {
  vendedor: string;
  costo: string | null;
  moneda: string;
  usuario_registro?: string;
  fecha_registro?: string;
}
export interface Material {
  numero_parte: string;
  propiedad_material: string;
  clasificacion: string;
  especificacion_material: string;
  unidad_empaque: string;
  unidad_medida: string;
  vendedor: string;
  vendedores: string[];
  costos: VendorCost[];
  fecha_registro: string;
  usuario_registro: string;
  fecha_modificacion?: string;
  usuario_modificacion?: string;
}
export interface MaterialPayload {
  numero_parte: string;
  propiedad_material: string;
  clasificacion: string;
  especificacion_material: string;
  unidad_empaque: string;
  unidad_medida: string;
  vendedores: VendorCost[];
}
export interface Catalogs {
  clasificaciones: string[];
  propiedades: string[];
  unidades_empaque: string[];
  unidades_medida: string[];
  monedas: string[];
}
export interface Filters {
  q: string;
  clasificacion: string;
}
export interface MaterialsResponse {
  success: boolean;
  records: Material[];
  total: number;
}
export const EMPTY_CATALOGS: Catalogs = {
  clasificaciones: [],
  propiedades: [],
  unidades_empaque: [],
  unidades_medida: [],
  monedas: ["USD", "MXN", "KRW"],
};

/** Backend adapter contract; consumers do not depend on HTTP or demo internals. */
export interface MaterialsApi {
  catalogs(signal?: AbortSignal): Promise<Catalogs>;
  list(filters: Filters, signal?: AbortSignal): Promise<MaterialsResponse>;
  detail(code: string): Promise<Material>;
  history(
    code: string,
    vendor: string,
    signal?: AbortSignal,
  ): Promise<VendorCost[]>;
  save(payload: MaterialPayload, editing: boolean): Promise<Material>;
  remove(code: string): Promise<void>;
  export(filters: Filters): Promise<void>;
}
