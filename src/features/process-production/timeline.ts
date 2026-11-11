import { text } from "./model";
import type { Kind, Row } from "./types";
export const SHIFT = {
  start: 450,
  end: 1050,
  productive: 540,
  breaks: [
    [570, 585],
    [720, 750],
    [900, 915],
  ] as readonly (readonly [number, number])[],
};
export function lineCompare(a: string, b: string) {
  const matchA = /^([MDH])(\d+)$/.exec(a),
    matchB = /^([MDH])(\d+)$/.exec(b);
  if (!matchA || !matchB)
    return a.localeCompare(b, undefined, { numeric: true });
  const ranks: Record<string, number> = { M: 1, D: 2, H: 3 };
  return (
    ranks[matchA[1]] - ranks[matchB[1]] || Number(matchA[2]) - Number(matchB[2])
  );
}
export function autoArrange(data: readonly Row[], count: number): Row[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 12)
    throw new Error("El número de grupos debe estar entre 1 y 12.");
  const lines = [...new Set(data.map((row) => text(row.line)))].sort(
      lineCompare,
    ),
    sequences = new Map<string, number>();
  return data
    .slice()
    .sort(
      (a, b) =>
        lineCompare(text(a.line), text(b.line)) ||
        Number(a.sequence ?? 0) - Number(b.sequence ?? 0),
    )
    .map((row) => {
      const group = (lines.indexOf(text(row.line)) % count) + 1,
        key = `${text(row.working_date)}:${group}`,
        sequence = (sequences.get(key) ?? 0) + 1;
      sequences.set(key, sequence);
      return { ...row, group_no: group, sequence };
    });
}
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
function stamp(date: string, minutes: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.floor(minutes / 1440));
  return `${d.toISOString().slice(0, 10)} ${clock(minutes % 1440)}:00`;
}
/** Port of the original productive-time/break rules. Dates remain local wall-clock values. */
export function calculateTimeline(
  kind: Kind,
  source: readonly Row[],
  view = "groups",
): Row[] {
  const current = new Map<
    string,
    { minutes: number; productive: number; sequence: number }
  >();
  return [...source]
    .sort(
      (a, b) =>
        text(a.working_date).localeCompare(text(b.working_date)) ||
        (kind === "ASSY" && view === "groups"
          ? Number(a.group_no ?? 1) - Number(b.group_no ?? 1)
          : lineCompare(text(a.line), text(b.line))) ||
        Number(a.sequence ?? 0) - Number(b.sequence ?? 0),
    )
    .map((row) => {
      const key = `${text(row.working_date)}:${kind === "ASSY" && view === "groups" ? (row.group_no ?? 1) : row.line}`;
      const state = current.get(key) ?? {
        minutes: SHIFT.start,
        productive: 0,
        sequence: 0,
      };
      const uph = Number(row.uph || (kind === "ASSY" ? 0 : 100)),
        qty = Number(row.plan_count ?? 0);
      const cancelled = row.status === "CANCELADO";
      const duration =
        cancelled || uph <= 0
          ? 0
          : kind === "ASSY"
            ? Math.round((qty / uph) * 60)
            : Math.ceil((qty / uph) * 60);
      const start = state.minutes;
      let end = start + duration,
        breaks = 0;
      if (!cancelled)
        SHIFT.breaks.forEach(([a, b]) => {
          if (
            kind === "ASSY"
              ? a >= start && a < start + duration
              : start < b && end > a
          ) {
            breaks += b - a;
            end += b - a;
          }
        });
      state.minutes = end;
      state.productive += duration;
      state.sequence++;
      current.set(key, state);
      const overtime =
        kind === "ASSY" ? state.productive > SHIFT.productive : end > SHIFT.end;
      return {
        ...row,
        _shift:
          row.shift ??
          ["DIA", "TIEMPO EXTRA", "NOCHE"][Number(row.routing ?? 1) - 1] ??
          "DIA",
        input: row.input ?? row.produced_count ?? row.produced ?? 0,
        _bucket: key,
        _overtime: overtime,
        tiempo_produccion: `${Math.floor(duration / 60)}h ${duration % 60}m`,
        inicio: cancelled ? "—" : clock(start),
        fin: cancelled ? "—" : clock(end),
        effective_minutes: duration,
        breaks_minutes: breaks,
        planned_start: cancelled ? null : stamp(text(row.working_date), start),
        planned_end: cancelled ? null : stamp(text(row.working_date), end),
        plan_start_date: cancelled ? null : text(row.working_date),
        sequence: state.sequence,
        secuencia: state.sequence,
        grupo: row.group_no ?? 1,
        turno:
          row.shift ??
          ["DIA", "TIEMPO EXTRA", "NOCHE"][Number(row.routing ?? 1) - 1] ??
          "DIA",
        extra: overtime ? "EXTRA" : "NORMAL",
      };
    });
}
export function orderPayload(kind: Kind, data: readonly Row[]) {
  return {
    sequences: data.map((row) =>
      kind === "ASSY"
        ? {
            lot_no: row.lot_no,
            group_no: Number(row.group_no ?? 1),
            sequence: Number(row.sequence ?? row.secuencia ?? 1),
            plan_start_date: row.plan_start_date,
            planned_start: row.planned_start,
            planned_end: row.planned_end,
            effective_minutes: row.effective_minutes,
            breaks_minutes: row.breaks_minutes,
          }
        : {
            lot_no: row.lot_no,
            sequence: Number(row.sequence ?? row.secuencia ?? 1),
          },
    ),
  };
}
export function moveRow(
  kind: Kind,
  source: readonly Row[],
  lot: string,
  target: string,
) {
  const data = source.map((row) => ({ ...row })),
    from = data.findIndex((row) => row.lot_no === lot),
    to = data.findIndex((row) => row.lot_no === target);
  if (from < 0 || to < 0 || from === to) return data;
  if (text(data[from].working_date) !== text(data[to].working_date))
    throw new Error("Reordena lotes de la misma fecha.");
  if (kind !== "ASSY" && data[from].line !== data[to].line)
    throw new Error("Para cambiar de línea utiliza Editar plan.");
  const [row] = data.splice(from, 1);
  if (kind === "ASSY")
    row.group_no = data[to > from ? to - 1 : to]?.group_no ?? row.group_no;
  data.splice(to, 0, row);
  const buckets = new Map<string, number>();
  return data.map((item) => {
    const key = `${text(item.working_date)}:${kind === "ASSY" ? item.group_no : item.line}`,
      n = (buckets.get(key) ?? 0) + 1;
    buckets.set(key, n);
    return { ...item, sequence: n };
  });
}

/** Moves a plan to the end of an ASSY group without changing its date or other plans. */
export function moveToGroup(
  source: readonly Row[],
  lot: string,
  group: number,
  date: string,
): Row[] {
  if (!Number.isSafeInteger(group) || group < 1 || group > 12)
    throw new Error("El grupo debe estar entre 1 y 12.");
  const row = source.find((item) => item.lot_no === lot);
  if (!row) throw new Error("No se encontró el plan que deseas mover.");
  if (text(row.working_date) !== date)
    throw new Error("Reordena lotes de la misma fecha.");
  const sequence =
    Math.max(
      0,
      ...source
        .filter(
          (item) =>
            item.working_date === date &&
            Number(item.group_no ?? 1) === group &&
            item.lot_no !== lot,
        )
        .map((item) => Number(item.sequence) || 0),
    ) + 1;
  return source.map((item) =>
    item.lot_no === lot ? { ...item, group_no: group, sequence } : { ...item },
  );
}
