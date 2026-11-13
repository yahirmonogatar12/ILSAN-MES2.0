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
