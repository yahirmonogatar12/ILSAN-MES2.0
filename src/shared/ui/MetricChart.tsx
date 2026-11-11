import { useId, useState } from "react";
import "./metric-chart.css";
export interface ChartSeries {
  label: string;
  values: readonly number[];
  color: string;
}
/** Responsive plot with exact values available by pointer and keyboard focus. */
export function MetricChart({
  title,
  labels,
  series,
  bars = false,
}: {
  title: string;
  labels: readonly string[];
  series: readonly ChartSeries[];
  bars?: boolean;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 760,
    height = 300,
    left = 100,
    right = 24,
    top = 20,
    bottom = 52;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const max = Math.max(
    1,
    ...series.flatMap((item) =>
      item.values.filter(Number.isFinite).map((value) => Math.max(0, value)),
    ),
  );
  const ceiling =
    Math.ceil(max / 10 ** Math.floor(Math.log10(max))) *
    10 ** Math.floor(Math.log10(max));
  const x = (index: number) =>
    left + ((index + 0.5) * plotWidth) / Math.max(1, labels.length);
  const y = (value: number) =>
    top +
    plotHeight *
      (1 - Math.max(0, Number.isFinite(value) ? value : 0) / ceiling);
  const format = (value: number) => value.toLocaleString("es-MX");
  const detail = (index: number) =>
    [
      labels[index],
      ...series.map(
        (item) => item.label + " " + format(item.values[index] ?? 0),
      ),
    ].join(" · ");
  return (
    <figure className="metric-chart" aria-labelledby={id}>
      <figcaption id={id}>{title}</figcaption>
      <div className="metric-chart-legend">
        {series.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{title}</title>
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = (ceiling * tick) / 4,
            yy = y(value);
          return (
            <g key={tick}>
              <line
                x1={left}
                y1={yy}
                x2={width - right}
                y2={yy}
                stroke="#ffffff18"
              />
              <text x={left - 8} y={yy + 4} textAnchor="end">
                {format(value)}
              </text>
            </g>
          );
        })}
        {labels.map((label, index) =>
          labels.length <= 16 || index % Math.ceil(labels.length / 12) === 0 ? (
            <text
              key={index}
              x={x(index)}
              y={height - bottom + 20}
              textAnchor="middle"
            >
              <title>{label}</title>
              {label.length > 15 ? label.slice(0, 14) + "…" : label}
            </text>
          ) : null,
        )}
        {series.map((item, seriesIndex) => (
          <g key={item.label}>
            {bars && seriesIndex === 0 ? null : (
              <polyline
                points={labels
                  .map(
                    (_, index) => x(index) + "," + y(item.values[index] ?? 0),
                  )
                  .join(" ")}
                fill="none"
                stroke={item.color}
                strokeWidth={2.5}
              />
            )}
            {labels.map((_, index) => {
              const value = item.values[index] ?? 0;
              const props = {
                tabIndex: 0,
                onFocus: () => setActive(index),
                onMouseEnter: () => setActive(index),
                "aria-label": detail(index),
              };
              return bars && seriesIndex === 0 ? (
                <rect
                  key={index}
                  {...props}
                  x={
                    x(index) -
                    Math.min(35, (plotWidth / Math.max(1, labels.length)) * 0.3)
                  }
                  y={y(value)}
                  width={Math.min(
                    70,
                    (plotWidth / Math.max(1, labels.length)) * 0.6,
                  )}
                  height={Math.max(1, top + plotHeight - y(value))}
                  fill={item.color}
                >
                  <title>{detail(index)}</title>
                </rect>
              ) : (
                <circle
                  key={index}
                  {...props}
                  cx={x(index)}
                  cy={y(value)}
                  r={4}
                  fill={item.color}
                >
                  <title>{detail(index)}</title>
                </circle>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="metric-chart-detail" role="status">
        {active !== null && active < labels.length
          ? detail(active)
          : labels.length
            ? " "
            : "Sin datos"}
      </div>
    </figure>
  );
}
