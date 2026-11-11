import type { TableGrouping } from "@/shared/ui";
import { lineName, text } from "./model";
import { SHIFT } from "./timeline";
import type { Kind, Row } from "./types";
const formatNumber = (value: number) => value.toLocaleString("es-MX");

/** The original ASSY bands and IMT/SMT line sections share the table renderer. */
export function planGrouping({
  kind,
  view,
  rows,
  count,
  date,
  canDrop,
  onMove,
}: {
  kind: Kind;
  view: string;
  rows: readonly Row[];
  count: number;
  date: string;
  canDrop: boolean;
  onMove: (lot: string, group: number, date: string) => void;
}): TableGrouping<Row> {
  const byGroup = kind === "ASSY" && view === "groups";
  const dates = [...new Set(rows.map((row) => text(row.working_date)))].sort();
  if (!dates.length) dates.push(date);
  const keys = new Set(rows.map((row) => text(row._bucket)));
  if (byGroup)
    for (const day of dates)
      for (
        let i = 1;
        i <=
        (Number.isSafeInteger(count) && count >= 1 && count <= 12 ? count : 6);
        i++
      )
        keys.add(`${day}:${i}`);
  const order = [...keys].sort((a, b) => {
    const [dayA, groupA] = a.split(":"),
      [dayB, groupB] = b.split(":");
    return (
      dayA.localeCompare(dayB) ||
      groupA.localeCompare(groupB, undefined, { numeric: true })
    );
  });
  const title = (key: string) => {
    const [day, group] = key.split(":");
    return `${byGroup ? `GRUPO ${group}` : lineName(kind, group)}${dates.length > 1 ? ` · ${day}` : ""}`;
  };
  const dropProps = (key: string) => ({
    "aria-disabled": !canDrop,
    onDragOver: (event: React.DragEvent<HTMLTableRowElement>) => {
      if (canDrop) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }
    },
    onDrop: (event: React.DragEvent<HTMLTableRowElement>) => {
      if (!canDrop) return;
      event.preventDefault();
      const [day, group] = key.split(":");
      onMove(event.dataTransfer.getData("text/plain"), Number(group), day);
    },
  });
  return {
    key: (row) => text(row._bucket),
    order,
    showEmpty: byGroup,
    headerProps: ({ key }) => ({
      "aria-label": title(key),
      className: "process-production-group",
      ...(byGroup ? dropProps(key) : {}),
    }),
    header: ({ key, rows: items }) => {
      const minutes = items.reduce(
        (sum, row) =>
          sum +
          (row.status === "CANCELADO" ? 0 : Number(row.effective_minutes) || 0),
        0,
      );
      const extra = minutes > SHIFT.productive;
      return (
        <div className="process-production-group-heading">
          <strong>{title(key)}</strong>
          {byGroup ? (
            <span className="process-production-group-summary">
              <span>Total: {(minutes / 60).toFixed(1)}h</span>
              <span
                className={`process-production-group-state ${extra ? "process-production-group-extra" : ""}`}
              >
                {extra ? "TIEMPO EXTRA" : "NORMAL"}
              </span>
            </span>
          ) : (
            <span className="process-production-group-summary">
              {items.length} {items.length === 1 ? "plan" : "planes"} · Plan:{" "}
              {formatNumber(
                items.reduce(
                  (sum, row) => sum + (Number(row.plan_count) || 0),
                  0,
                ),
              )}{" "}
              · Output:{" "}
              {formatNumber(
                items.reduce((sum, row) => sum + (Number(row.output) || 0), 0),
              )}
            </span>
          )}
        </div>
      );
    },
    dropTarget: byGroup
      ? ({ key, rows: items }) => ({
          rowProps: {
            ...dropProps(key),
            "aria-label": `Asignar planes a ${title(key)}`,
            className: "process-production-group-drop",
          },
          content: items.length ? null : (
            <span className="process-production-group-empty">
              Arrastra planes aquí para asignarlos a este grupo
            </span>
          ),
        })
      : undefined,
  };
}
