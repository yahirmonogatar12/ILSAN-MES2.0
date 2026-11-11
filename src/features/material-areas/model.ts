import { AREA_CONFIG, COLUMNS } from "./config";
import type {
  Area,
  AreaFilters,
  AreaResult,
  AreaRow,
  AreaView,
  ConnectedArea,
  Searches,
  SearchesByView,
} from "./types";
export const EXPORT_LIMIT = 50000;
export const REMOTE_PAGE_SIZES = [100, 200, 500, 1000] as const;
export const isInventory = (view: string) => view.startsWith("inventario");
export const effectiveView = (filters: AreaFilters): AreaView =>
  isInventory(filters.consulta) && filters.modo === "general"
    ? (`${filters.consulta}_general` as AreaView)
    : filters.consulta;
export function todayMexico(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join("-");
}
export function defaults(): AreaFilters {
  const date = todayMexico();
  return { consulta: "inventario", modo: "general", start: date, end: date };
}
export function dateIssue(filters: AreaFilters) {
  if (isInventory(filters.consulta)) return "";
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) > 0 &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(filters.start) || !validDate(filters.end))
    return "Selecciona ambas fechas.";
  return filters.start > filters.end
    ? "La fecha inicial no puede ser posterior a la final."
    : "";
}
export function validateArea(area: Area, filters: AreaFilters) {
  if (!["smd", "micom", "imd", "ipm"].includes(area))
    throw new Error("La consulta de esta área todavía no está disponible.");
  if (!["general", "detallado"].includes(filters.modo))
    throw new Error("Modo de inventario inválido.");
  if (
    ![
      "entradas",
      "salidas",
      ...AREA_CONFIG[area].inventories.map((item) => item.value),
    ].includes(filters.consulta)
  )
    throw new Error("Consulta no disponible para esta área.");
  const issue = dateIssue(filters);
  if (issue) throw new Error(issue);
}
export function params(
  area: ConnectedArea,
  filters: AreaFilters,
  searches: Searches,
  page?: number,
  size?: number,
) {
  validateArea(area, filters);
  const view = effectiveView(filters),
    values = new URLSearchParams({ vista: view });
  if (!isInventory(view)) {
    values.set("start", filters.start);
    values.set("end", filters.end);
  }
  for (const [key] of COLUMNS[view]) {
    const value = searches[key]?.trim();
    if (value) values.set(`cf_${key}`, value.slice(0, 128));
  }
  if (page !== undefined && size !== undefined) {
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !REMOTE_PAGE_SIZES.some((value) => value === size)
    )
      throw new Error("Paginación inválida.");
    values.set("page", String(page));
    values.set("per_page", String(size));
  }
  return values;
}
export function decodeResult(value: unknown, expectedSize: number): AreaResult {
  const data = value as AreaResult;
  if (
    !data ||
    ![data.total, data.page, data.per_page, data.total_pages].every(
      Number.isSafeInteger,
    ) ||
    data.total < 0 ||
    data.page < 1 ||
    data.per_page !== expectedSize ||
    data.total_pages !== Math.max(1, Math.ceil(data.total / data.per_page)) ||
    data.page > data.total_pages ||
    !Number.isFinite(Number(data.piezas)) ||
    !Array.isArray(data.rows) ||
    data.rows.length > data.per_page ||
    data.rows.length > data.total ||
    data.rows.some(
      (row) =>
        !row ||
        Array.isArray(row) ||
        typeof row !== "object" ||
        Object.values(row).some(
          (cell) =>
            cell !== null &&
            !["string", "number", "boolean"].includes(typeof cell),
        ),
    )
  )
    throw new Error("El servidor no devolvió una consulta de material válida.");
  return { ...data, piezas: Number(data.piezas) };
}
export function decodeSearches(value: unknown): SearchesByView {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: SearchesByView = {};
  for (const view of Object.keys(COLUMNS) as AreaView[]) {
    const saved = (value as Record<string, unknown>)[view];
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) continue;
    result[view] = Object.fromEntries(
      COLUMNS[view].flatMap(([key]) => {
        const text = (saved as Record<string, unknown>)[key];
        return typeof text === "string" && text.trim()
          ? [[key, text.trim().slice(0, 128)]]
          : [];
      }),
    );
  }
  return result;
}
export const cellText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);
const numberFormat = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 20,
});
export const numberText = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? ""
    : Number.isFinite(Number(value))
      ? numberFormat.format(Number(value))
      : cellText(value);
export const rowKey = (row: AreaRow, index: number, offset: number) =>
  `${row.codigo || row.lote_chamber || row.lote_completo || row.part_no || row.programacion || "row"}:${offset + index}`;
