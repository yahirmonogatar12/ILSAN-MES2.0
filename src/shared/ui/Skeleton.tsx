import { useRef, type CSSProperties } from "react";
import { Card, Page } from "./Layout";
import { useInitialLoading } from "../hooks/useInitialLoading";
import "./skeleton.css";

/** Decorative placeholder. Announce loading once from the surrounding status region. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`ui-skeleton ${className}`} aria-hidden="true" />;
}

export function TableSkeleton({
  label = "Cargando registros…",
  columns = 6,
  maxHeight,
}: {
  label?: string;
  columns?: number;
  maxHeight?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  useInitialLoading(element);
  const cells = Array.from(
    { length: Math.max(1, Math.min(10, columns)) },
    (_, index) => index,
  );
  const grid: CSSProperties = {
    gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
  };
  return (
    <div
      ref={element}
      className="ui-table-skeleton table-overflow"
      role="status"
      aria-label={label}
      aria-busy="true"
      style={{ maxHeight }}
    >
      <span className="ui-skeleton-label">{label}</span>
      <div
        className="ui-table-skeleton-heading"
        style={grid}
        aria-hidden="true"
      >
        {cells.map((cell) => (
          <Skeleton key={cell} />
        ))}
      </div>
      <div className="ui-table-skeleton-body" aria-hidden="true">
        {Array.from({ length: 12 }, (_, row) => (
          <div className="ui-table-skeleton-row" style={grid} key={row}>
            {cells.map((cell) => (
              <Skeleton key={cell} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shared route fallback. Real controls appear when the module and its data are ready. */
export function ModuleSkeleton({
  label = "Cargando módulo…",
}: {
  label?: string;
}) {
  return (
    <Page className="ui-module-skeleton">
      <div className="surface ui-module-skeleton-filters" aria-hidden="true">
        {[0, 1, 2].map((field) => (
          <div className="ui-module-skeleton-field" key={field}>
            <Skeleton />
            <Skeleton />
          </div>
        ))}
        <div className="ui-module-skeleton-actions">
          <Skeleton />
          <Skeleton />
        </div>
      </div>
      <Card fill>
        <TableSkeleton label={label} />
        <div className="ui-module-skeleton-footer" aria-hidden="true">
          <Skeleton />
          <Skeleton />
        </div>
      </Card>
    </Page>
  );
}
