import type { PpmPeriod, PpmReport } from "./reportTypes";

export const ppmMetrics = [
  ["inspected", "TTL PDN"],
  ["target", "TARGET"],
  ["defects", "TTL DEFECT"],
  ["ppm", "PPM"],
] as const;

export function pivotRows(periods: PpmPeriod[]) {
  return ppmMetrics.map(([key, label]) => ({
    item: label,
    metric: key,
    ...Object.fromEntries(periods.map((period) => [period.key, period[key]])),
  }));
}

export function weeklyRows(report: PpmReport) {
  return report.weekly.rows.flatMap((group) =>
    ppmMetrics
      .filter(([key]) => key !== "target")
      .map(([key, label], index) => ({
        line: group.line,
        item: label,
        metric: key,
        index,
        ...Object.fromEntries(
          group.weeks.flatMap((week) => [
            [week.key, week[key]],
            ["target:" + week.key, week.target],
          ]),
        ),
      })),
  );
}
