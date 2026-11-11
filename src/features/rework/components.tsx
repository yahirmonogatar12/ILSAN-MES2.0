import type { TableColumn } from "@/shared/ui";
import { STATES } from "./model";
import type { Area, ReworkSummary } from "./types";
export function StateBadge({
  state,
  children,
}: {
  state: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={`rework-badge rework-state-${state}`}>
      {children ?? STATES[state] ?? state}
    </span>
  );
}
export function AreaBadges({
  areas,
  compact = false,
}: {
  areas: readonly Area[];
  compact?: boolean;
}) {
  const shortNames: Record<string, string> = {
    EMBARQUES: "Embarques",
    MICOM: "MICOM",
    IMPRESION: "Impresión",
    CP_REPARACION: "Rep. ASSY",
    SMD_REPARACION: "Rep. SMD/IMD",
  };
  return (
    <div className={`rework-badges ${compact ? "rework-badges-compact" : ""}`}>
      {areas.map((area) => (
        <StateBadge key={area.area} state={area.estado}>
          {compact ? (
            <abbr title={area.nombre}>
              {shortNames[area.area] ??
                (area.area === "CP_RETRABAJO"
                  ? area.nombre === "Cambio de etiquetas"
                    ? "Etiquetas"
                    : "Reprog."
                  : area.nombre)}
            </abbr>
          ) : (
            area.nombre
          )}{" "}
          {area.hecho}/{area.total}
        </StateBadge>
      ))}
    </div>
  );
}
export function ListSummary({ rows }: { rows: readonly ReworkSummary[] }) {
  return (
    <div
      className="rework-counts"
      aria-label="Resumen de solicitudes filtradas"
    >
      <span>{rows.length} solicitudes</span>
      <span>
        {
          rows.filter((row) => ["PENDIENTE", "EN_PROCESO"].includes(row.estado))
            .length
        }{" "}
        abiertas
      </span>
      <span>
        {rows.filter((row) => row.estado === "COMPLETADA").length} completadas
      </span>
    </div>
  );
}
export function columnsFor<T>(
  specs: readonly (readonly [keyof T & string, string, number])[],
): TableColumn<T>[] {
  const total = specs.reduce((sum, spec) => sum + spec[2], 0);
  const text = (value: unknown) =>
    Array.isArray(value)
      ? value.join(", ")
      : value == null
        ? ""
        : String(value);
  return specs.map(([id, header, width]) => ({
    id,
    header,
    width: `${(width / total) * 100}%`,
    cell: (row) => text(row[id]) || "—",
    textValue: (row) => text(row[id]),
    sortValue: (row) =>
      typeof row[id] === "number" ? (row[id] as number) : text(row[id]),
  }));
}
