import type { Material, MaterialPayload, VendorCost } from "./types";

export const EMPTY_MATERIAL: MaterialPayload = {
  numero_parte: "",
  propiedad_material: "",
  clasificacion: "",
  especificacion_material: "",
  unidad_empaque: "",
  unidad_medida: "EA",
  vendedores: [],
};

export function materialToPayload(record: Material): MaterialPayload {
  return {
    numero_parte: record.numero_parte,
    propiedad_material: record.propiedad_material,
    clasificacion: record.clasificacion,
    especificacion_material: record.especificacion_material,
    unidad_empaque: record.unidad_empaque,
    unidad_medida: record.unidad_medida,
    vendedores: record.vendedores.map((name) => {
      const cost = record.costos.find(
        (c) => c.vendedor.toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      return {
        vendedor: name,
        costo: cost?.costo ?? "",
        moneda: cost?.moneda || "USD",
      };
    }),
  };
}

export function validateMaterial(payload: MaterialPayload): string[] {
  const errors: string[] = [];
  if (!payload.numero_parte.trim()) errors.push("Escribe el número de parte.");
  if (!payload.especificacion_material.trim())
    errors.push("Escribe la especificación del material.");
  const names = new Set<string>();
  for (const vendor of payload.vendedores) {
    const name = vendor.vendedor.trim();
    if (!name) {
      if (String(vendor.costo ?? "").trim())
        errors.push("Escribe el vendedor del costo capturado.");
      continue;
    }
    if (name.includes(","))
      errors.push("Los nombres de vendedor no pueden contener comas.");
    if (names.has(name.toLocaleLowerCase()))
      errors.push(`El vendedor ${name} está duplicado.`);
    names.add(name.toLocaleLowerCase());
    const value = String(vendor.costo ?? "").trim();
    if (
      value &&
      (!/^\d+(\.\d{1,4})?$/.test(value) ||
        !Number.isFinite(Number(value)) ||
        Number(value) > 99999999.9999)
    ) {
      errors.push(
        `${name}: escribe un costo entre 0 y 99,999,999.9999, con hasta 4 decimales.`,
      );
    }
    if (!["USD", "MXN", "KRW"].includes(vendor.moneda))
      errors.push(`${name}: selecciona una moneda válida.`);
  }
  if (
    payload.vendedores
      .map((v) => v.vendedor.trim())
      .filter(Boolean)
      .join(", ").length > 100
  ) {
    errors.push("La lista de vendedores admite hasta 100 caracteres en total.");
  }
  return errors;
}

export function normalizePayload(payload: MaterialPayload): MaterialPayload {
  return {
    ...payload,
    numero_parte: payload.numero_parte.trim(),
    especificacion_material: payload.especificacion_material.trim(),
    propiedad_material: payload.propiedad_material.trim(),
    clasificacion: payload.clasificacion.trim(),
    unidad_empaque: payload.unidad_empaque.trim(),
    unidad_medida: payload.unidad_medida.trim() || "EA",
    vendedores: payload.vendedores
      .filter((v) => v.vendedor.trim())
      .map((v) => ({
        vendedor: v.vendedor.trim(),
        costo: String(v.costo ?? "").trim() || "0",
        moneda: v.moneda,
      })),
  };
}

export function hasCost(cost: VendorCost) {
  return cost.costo !== null && cost.costo !== "" && cost.costo !== undefined;
}
export function formatCost(cost: VendorCost) {
  if (!hasCost(cost)) return "Sin costo";
  const n = Number(cost.costo);
  return `${Number.isFinite(n) ? n.toLocaleString("es-MX", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : cost.costo} ${cost.moneda}`;
}

// Never allow user-controlled catalog values to become formulas in the demo CSV.
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
