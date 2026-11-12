import type { ReactNode } from "react";
import { Card } from "./Layout";
import "./tableToolbar.css";

/** A single control surface for filters and table actions, with independent form semantics. */
export function TableToolbar({
  children,
  actions,
  footer,
  title,
}: {
  children?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  title?: string;
}) {
  return (
    <Card title={title} className="filters-panel table-toolbar">
      <div className="table-toolbar-main">
        {children && <div className="table-toolbar-filters">{children}</div>}
        {actions && (
          <div
            className="table-toolbar-actions catalog-actions"
            role="group"
            aria-label="Acciones de la tabla"
          >
            {actions}
          </div>
        )}
      </div>
      {footer}
    </Card>
  );
}
