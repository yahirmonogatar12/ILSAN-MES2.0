import { AlertCircle, LoaderCircle, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function Alert({
  children,
  tone = "info",
  className = "",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "danger" | "success";
  className?: string;
}) {
  return (
    <div
      className={`inline-message ${tone} ${className}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Loading({ text = "Cargando…" }: { text?: string }) {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="spin" size={26} aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}
export function ErrorState({
  error,
  onRetry,
  title = "No pudimos completar la consulta",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="state-panel error-state" role="alert">
      <AlertCircle size={28} />
      <h3>{title}</h3>
      <p>
        {error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado."}
      </p>
      {onRetry && <Button onClick={onRetry}>Volver a intentar</Button>}
    </div>
  );
}
/** Text and actions are supplied by the caller; no business-domain assumptions. */
export function EmptyState({
  title = "Sin registros",
  message = "No hay datos para mostrar.",
  icon = <SearchX size={29} />,
  action,
}: {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state-panel">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}
