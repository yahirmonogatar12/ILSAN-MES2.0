import { number } from "@/shared/lib/parse";
import { text } from "@/shared/lib/text";
import { Alert, MetricChart, PercentageBar } from "@/shared/ui";
import type { Visualization } from "@/core/assistant/types";
import type { labels } from "./i18n";
export function Visualizations({
  values,
  t,
}: {
  values: Visualization[];
  t: ReturnType<typeof labels>;
}) {
  return (
    <>
      {values.map((value) => {
        if (value.type === "production_area_progress") {
          const areas = value.areas ?? [];
          return (
            <section className="assistant-visualization" key={value.id}>
              <small>
                {value.date_from}
                {value.date_to !== value.date_from ? " – " + value.date_to : ""}
                {value.source ? " · " + value.source : ""}
              </small>
              <MetricChart
                title={t.lineProgressTitle}
                labels={areas.map((area) => text(area.area))}
                bars
                series={[
                  {
                    label: t.goal,
                    color: "#94a3b8",
                    values: areas.map((area) => number(area.goal)),
                  },
                  {
                    label: t.produced,
                    color: "#2878b5",
                    values: areas.map((area) => number(area.produced)),
                  },
                  {
                    label: t.output,
                    color: "#28a88a",
                    values: areas.map((area) => number(area.output)),
                  },
                ]}
              />
              {!!value.omitted_areas?.length && (
                <Alert tone="info">
                  {t.omittedAreas} · {value.omitted_areas.join(", ")}
                </Alert>
              )}
            </section>
          );
        }
        if (value.type !== "quality_today_overview") return null;
        return (
          <section className="assistant-visualization" key={value.id}>
            <strong>{t.qualityTitle}</strong>
            <small>
              {value.date_from}
              {value.date_to !== value.date_from ? " – " + value.date_to : ""}
            </small>
            {(value.sources ?? []).map((source, index) => {
              const key = text(source.key);
              const title =
                {
                  lqc_results: t.qualityLqcResults,
                  ict_history: t.qualityIct,
                  lqc_release_history: t.qualityLqcRelease,
                  vision_history: t.qualityVision,
                }[key] ?? key;
              const metrics =
                key === "lqc_results"
                  ? [
                      [t.inspected, source.inspected],
                      [t.defects, source.defects],
                      [t.ppm, source.ppm],
                      [t.target, source.target_ppm],
                    ]
                  : key === "lqc_release_history"
                    ? [
                        [t.scans, source.total],
                        [t.uniqueUnits, source.unique_units],
                        [t.lots, source.lots],
                        [t.duplicates, source.duplicates],
                      ]
                    : [
                        [t.tests, source.total],
                        [t.uniqueUnits, source.unique_units],
                        [t.passed, source.passed],
                        [t.failed, source.failed],
                      ];
              return (
                <div className="assistant-quality-source" key={key || index}>
                  <strong>{title}</strong>
                  <dl>
                    {metrics.map(([label, value]) => (
                      <div key={text(label)}>
                        <dt>{text(label)}</dt>
                        <dd>{number(value).toLocaleString("es-MX")}</dd>
                      </div>
                    ))}
                  </dl>
                  {source.pass_rate_pct !== undefined && (
                    <PercentageBar
                      label={t.passRate}
                      segments={[
                        {
                          value: number(source.pass_rate_pct),
                          tone: "positive",
                          label: number(source.pass_rate_pct).toFixed(1) + "%",
                        },
                        {
                          value: 100 - number(source.pass_rate_pct),
                          tone: "negative",
                        },
                      ]}
                    />
                  )}
                </div>
              );
            })}
            {!!value.omitted_sources?.length && (
              <Alert tone="info">
                {t.omittedSources} · {value.omitted_sources.join(", ")}
              </Alert>
            )}
          </section>
        );
      })}
    </>
  );
}
