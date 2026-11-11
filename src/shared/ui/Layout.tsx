import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { Alert } from "./Feedback";
import { useMediaQuery } from "../hooks/useMediaQuery";

export function Card({
  title,
  icon,
  actions,
  badge,
  fill = false,
  children,
  className = "",
}: {
  title?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  /** Fill the available page height; only the table body scrolls. */
  fill?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      className={`surface ${fill ? "surface-fill" : ""} ${className}`}
      aria-labelledby={title ? id : undefined}
    >
      {(title || actions) && (
        <div className="catalog-heading">
          <div>
            {icon && <span className="catalog-icon">{icon}</span>}
            {title && <h2 id={id}>{title}</h2>}
            {badge !== undefined && (
              <span className="count-badge">{badge}</span>
            )}
          </div>
          {actions && <div className="catalog-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
export function Page({
  title,
  icon,
  children,
  banner,
  footer,
  className = "",
}: {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`module-page ${className}`}>
      {title && (
        <div className="page-heading">
          {icon}
          <h1>{title}</h1>
        </div>
      )}
      {banner}
      {children}
      {footer && <div className="page-footnote">{footer}</div>}
    </div>
  );
}
const DetailLayoutContext = createContext<{
  expanded: boolean;
  toggle: () => void;
} | null>(null);
/** Bounded master/detail workspace. The side form and both tables keep their own overflow. */
export function MasterDetailLayout({
  side,
  sideLabel = "Captura",
  list,
  detail,
}: {
  side: ReactNode;
  sideLabel?: string;
  list: ReactNode;
  detail?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const compact = useMediaQuery("(max-width: 620px)");
  const [captureOpen, setCaptureOpen] = useState(false);
  return (
    <DetailLayoutContext
      value={{ expanded, toggle: () => setExpanded((previous) => !previous) }}
    >
      <div
        className={`master-detail ${detail ? "master-detail-selected" : ""} ${detail && expanded ? "master-detail-expanded" : ""}`}
      >
        <div className="master-detail-top">
          <details
            className="master-detail-side"
            open={!compact || captureOpen}
            onToggle={(event) => {
              if (compact) setCaptureOpen(event.currentTarget.open);
            }}
          >
            <summary>{sideLabel}</summary>
            {side}
          </details>
          <div className="master-detail-list">{list}</div>
        </div>
        {detail && <div className="master-detail-content">{detail}</div>}
      </div>
    </DetailLayoutContext>
  );
}
/** Inline detail with the same body/footer slots as Modal, without taking over the screen. */
export function DetailPanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const layout = useContext(DetailLayoutContext);
  return (
    <Card
      fill
      title={title}
      className="detail-panel"
      actions={
        <>
          {layout && (
            <Button
              size="sm"
              className="detail-layout-toggle"
              onClick={layout.toggle}
            >
              {layout.expanded ? "Mostrar listado" : "Ampliar detalle"}
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            Ocultar detalle
          </Button>
        </>
      }
    >
      {subtitle && (
        <p className="detail-panel-subtitle" title={subtitle}>
          {subtitle}
        </p>
      )}
      {children}
    </Card>
  );
}
export function FormSection({
  number,
  title,
  description,
  actions,
  children,
}: {
  number?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ui-form-section">
      <div className="form-section-title">
        {number && <span>{number}</span>}
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
export function FormActions({
  pending,
  onCancel,
  submitLabel = "Guardar",
  pendingLabel = "Guardando…",
  icon,
}: {
  pending: boolean;
  onCancel: () => void;
  submitLabel?: string;
  pendingLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="modal-footer">
      <Button disabled={pending} onClick={onCancel}>
        Cancelar
      </Button>
      <Button
        type="submit"
        variant="primary"
        icon={icon}
        loading={pending}
        loadingLabel={pendingLabel}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
export function KeyValueGrid({
  items,
}: {
  items: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="detail-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function FormMessages({
  errors,
  error,
}: {
  errors: readonly string[];
  error?: Error | null;
}) {
  return (
    <>
      {errors.length > 0 && (
        <Alert tone="danger">
          {errors.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </Alert>
      )}
      {error && <Alert tone="danger">{error.message}</Alert>}
    </>
  );
}
