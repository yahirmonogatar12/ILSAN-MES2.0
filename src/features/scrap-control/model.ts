import type { ColumnSearches, ScrapFilters, ScrapRecord } from "./types";

/** Filter identifiers match Flask's cf_* parameters. Fields match the returned records. */
export const scrapColumns = [
  { id: "cliente", field: "cliente", title: "Cliente", width: 7 },
  { id: "fecha", field: "fecha", title: "Fecha", width: 8 },
  { id: "hora", field: "hora", title: "Hora", width: 6 },
  { id: "codigo", field: "scanned_original", title: "Código", width: 12 },
  { id: "part_no", field: "part_no", title: "Part No", width: 11 },
  { id: "modelo", field: "modelo", title: "Modelo", width: 8 },
  { id: "area", field: "area", title: "Área", width: 7 },
  { id: "proceso", field: "proceso", title: "Proceso", width: 7 },
  { id: "motivo", field: "motivo_scrap_texto", title: "Motivo", width: 10 },
  { id: "cantidad", field: "cantidad", title: "Cantidad", width: 7 },
  { id: "comentarios", field: "comentarios", title: "Comentarios", width: 10 },
  { id: "usuario", field: "usuario_registro", title: "Usuario", width: 7 },
] as const satisfies readonly {
  id: string;
  field: keyof ScrapRecord;
  title: string;
  width: number;
}[];

export const scrapAreas = [
  "M1",
  "M2",
  "M3",
  "M4",
  "D1",
  "D2",
  "D3",
  "SMD",
  "IMD",
  "IPM",
  "COATING",
  "CALIDAD",
  "MANTENIMIENTO",
  "COMPONENTE",
  "PROVEEDOR",
];

export function defaultFilters(): ScrapFilters {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { start: date, end: date, area: "" };
}

function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function rangeIssue({ start, end }: ScrapFilters) {
  if (!validDate(start) || !validDate(end)) return "Selecciona ambas fechas.";
  return start > end
    ? "La fecha desde debe ser anterior o igual a la fecha hasta."
    : "";
}

export function decodeSearches(value: unknown): ColumnSearches {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const searches: ColumnSearches = {};
  for (const { id } of scrapColumns) {
    const term = input[id];
    if (typeof term !== "string") continue;
    const search = term.trim().slice(0, 128);
    if (search) searches[id] = search;
  }
  return searches;
}

export function scrapParams(filters: ScrapFilters, searches: ColumnSearches) {
  const error = rangeIssue(filters);
  if (error) throw new Error(error);
  const params = new URLSearchParams({
    start: filters.start,
    end: filters.end,
  });
  if (filters.area) params.set("area", filters.area);
  for (const [id, value] of Object.entries(decodeSearches(searches))) {
    params.set("cf_" + id, value);
  }
  return params;
}

export function quantity(row: ScrapRecord) {
  const parsed = Number(row.cantidad);
  return Number.isFinite(parsed) ? parsed : 0;
}
