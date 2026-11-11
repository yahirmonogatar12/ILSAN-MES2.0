import type {
  Area,
  Filters,
  ProgrammingOption,
  RequestDraft,
  RequestPayload,
} from "./types";
export const ORIGINS = [
  { value: "EMBARQUES", label: "Embarques" },
  { value: "SMD", label: "SMD" },
  { value: "PRODUCCION", label: "Producción" },
] as const;
export const STATES: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};
export const STAGES: Record<string, string> = {
  CP_RETRABAJO: "Etiquetas / Reprogramación",
  CP_REPARACION: "Reparación ASSY",
  SMD_REPARACION: "Reparación SMD/IMD",
};
export const validPart = (part: string) =>
  /^[A-Z]{3}\d{8}$/.test(part.trim().toUpperCase());
export const normalizePart = (part: string) => part.trim().toUpperCase();
export function mexicoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("-");
}
export function defaultFilters(): Filters {
  const hasta = mexicoDate(),
    start = new Date(`${hasta}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 30);
  return {
    desde: start.toISOString().slice(0, 10),
    hasta,
    codigo: "",
    estado: "",
  };
}
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function filterIssue(filters: Filters) {
  if (filters.codigo.trim()) return "";
  if (
    (filters.desde && !validDate(filters.desde)) ||
    (filters.hasta && !validDate(filters.hasta))
  )
    return "Captura fechas válidas.";
  return filters.desde && filters.hasta && filters.desde > filters.hasta
    ? "La fecha inicial no puede ser posterior a la final."
    : "";
}
export function filterParams(filters: Filters) {
  const issue = filterIssue(filters);
  if (issue) throw new Error(issue);
  const params = new URLSearchParams();
  for (const key of (filters.codigo.trim()
    ? ["codigo", "estado"]
    : ["desde", "hasta", "estado"]) as (keyof Filters)[]) {
    const value = filters[key].trim();
    if (value) params.set(key, value);
  }
  return params;
}
export function emptyDraft(): RequestDraft {
  return {
    np_origen: "",
    np_destino: "",
    tipo_material: "ASSY",
    cantidades: { EMBARQUES: "", SMD: "", PRODUCCION: "" },
    programmingEnabled: false,
    programmingPart: "",
    programaciones: [],
    componentes: [],
    comentarios: "",
  };
}
export function requestPayload(values: RequestDraft): RequestPayload {
  return {
    np_origen: normalizePart(values.np_origen),
    np_destino: normalizePart(values.np_destino),
    tipo_material: values.tipo_material,
    origenes: ORIGINS.map(({ value }) => ({
      origen: value,
      cantidad: Number(values.cantidades[value] || 0),
    })).filter((row) => row.cantidad > 0),
    programaciones: values.programmingEnabled
      ? values.programaciones.map((row) => ({ ...row }))
      : [],
    componentes: values.componentes.map(
      ({ tipo, ubicacion, np_anterior, np_nuevo }) => ({
        tipo,
        ubicacion: ubicacion.trim().toUpperCase(),
        np_anterior: normalizePart(np_anterior),
        np_nuevo: normalizePart(np_nuevo),
      }),
    ),
    comentarios: values.comentarios.trim(),
  };
}
export function validateRequest(
  values: RequestDraft,
  programmingReady: boolean,
) {
  const errors: string[] = [];
  if (!validPart(values.np_origen))
    errors.push("NP origen inválido: usa tres letras y ocho dígitos.");
  if (!validPart(values.np_destino))
    errors.push("NP destino inválido: usa tres letras y ocho dígitos.");
  for (const origin of ORIGINS) {
    const raw = values.cantidades[origin.value].trim();
    if (
      raw &&
      (!/^\d+$/.test(raw) ||
        !Number.isSafeInteger(Number(raw)) ||
        Number(raw) > 999)
    )
      errors.push(
        `La cantidad de ${origin.label} debe ser un entero entre 0 y 999.`,
      );
  }
  const payload = requestPayload(values),
    total = payload.origenes.reduce((sum, row) => sum + row.cantidad, 0);
  if (!payload.origenes.length || total > 999)
    errors.push("La cantidad total debe estar entre 1 y 999.");
  if (
    values.programmingEnabled &&
    (!programmingReady ||
      values.programmingPart !== normalizePart(values.np_destino))
  )
    errors.push(
      "Consulta la programación vigente del NP destino antes de guardar.",
    );
  if (values.programmingEnabled && !payload.programaciones.length)
    errors.push("Selecciona al menos una programación o desactiva la opción.");
  if (
    new Set(payload.programaciones.map((row) => row.ic_location)).size !==
    payload.programaciones.length
  )
    errors.push("Selecciona una sola programación por ubicación IC.");
  if (
    payload.componentes.some(
      (row) => !["ASSY", "SMD", "IMD"].includes(row.tipo) || !row.ubicacion,
    )
  )
    errors.push("Cada componente necesita tipo y ubicación.");
  if (
    payload.np_origen === payload.np_destino &&
    !payload.programaciones.length &&
    !payload.componentes.length
  )
    errors.push("Indica cambio de NP, programación o componentes.");
  return errors;
}
export function programmingGroups(options: ProgrammingOption[]) {
  const groups = new Map<string, ProgrammingOption[]>();
  options.forEach((option) =>
    groups.set(option.ic_location, [
      ...(groups.get(option.ic_location) ?? []),
      option,
    ]),
  );
  return [...groups].map(([location, options]) => ({ location, options }));
}
export function plannedAreas(payload: RequestPayload): string[] {
  const result: string[] = [],
    changed =
      !!payload.np_origen &&
      !!payload.np_destino &&
      payload.np_origen !== payload.np_destino;
  if (payload.origenes.some((row) => row.origen === "EMBARQUES"))
    result.push("Embarques: salida con el folio RT como departure");
  if (payload.programaciones.length)
    result.push("MICOM: etiquetas de programación");
  if (changed) result.push("Impresión: etiquetas SMD");
  if (payload.programaciones.length || changed)
    result.push(
      `Control Producción: ${payload.programaciones.length ? "reprogramación" : "cambio de etiquetas"}`,
    );
  if (payload.componentes.some((row) => row.tipo === "ASSY"))
    result.push("Control Producción: reparación ASSY");
  if (payload.componentes.some((row) => row.tipo !== "ASSY"))
    result.push("Inventario SMD: reparación SMD/IMD");
  return result;
}
export const areaText = (areas: Area[]) =>
  areas.map((area) => `${area.nombre} ${area.hecho}/${area.total}`).join(", ");
