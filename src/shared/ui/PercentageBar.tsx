import "./percentage-bar.css";

export interface PercentageSegment {
  value: number;
  tone: "positive" | "negative";
  label?: string;
}

/** Percentage widths are bounded independently; labels remain supplied by the caller. */
export function PercentageBar({
  label,
  segments,
  sideLabel,
}: {
  label: string;
  segments: readonly PercentageSegment[];
  sideLabel?: string;
}) {
  return (
    <div className="percentage-bar" role="img" aria-label={label} title={label}>
      <div className="percentage-bar-track" aria-hidden="true">
        {segments.map((segment, index) => (
          <span
            key={index}
            className={"percentage-bar-segment percentage-bar-" + segment.tone}
            style={{
              width:
                Math.min(
                  100,
                  Math.max(
                    0,
                    Number.isFinite(segment.value) ? segment.value : 0,
                  ),
                ) + "%",
            }}
          >
            {segment.label && (
              <span className="percentage-bar-label">{segment.label}</span>
            )}
          </span>
        ))}
      </div>
      {sideLabel && (
        <span className="percentage-bar-side-label" aria-hidden="true">
          {sideLabel}
        </span>
      )}
    </div>
  );
}
