import "./progress-ring.css";

/** Bounded percentage gauge. Labels and values belong to the consumer. */
export function ProgressRing({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const percentage = Math.min(
    100,
    Math.max(0, Number.isFinite(value) ? value : 0),
  );
  const formatted = new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(percentage);
  return (
    <div
      className="ui-progress-ring"
      role="img"
      aria-label={label + " " + formatted + "%"}
      style={{
        background: `conic-gradient(#27ae60 ${percentage * 3.6}deg, #ffffff14 0deg)`,
      }}
    >
      <div className="ui-progress-ring-inner" aria-hidden="true">
        <strong>{formatted}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
