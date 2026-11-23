import { AlertCircle, LoaderCircle, RefreshCw, SearchX } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { useInitialLoading } from "../hooks/useInitialLoading";

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
  const element = useRef<HTMLDivElement>(null);
  useInitialLoading(element);
  return (
    <div ref={element} className="state-panel" role="status">
      <LoaderCircle className="spin" size={26} aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}
// Chrome, Firefox and Safari wording, plus Vite's CSS preload, for a screen file
// that could not be downloaded: a page opened before a new build or a lost connection.
const MISSING_SCREEN_FILE =
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function ErrorState({
  error,
  onRetry,
  title = "No pudimos completar la consulta",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  // The browser remembers a failed download, so retrying in place never works.
  if (error instanceof Error && MISSING_SCREEN_FILE.test(error.message))
    return (
      <div className="state-panel error-state" role="alert">
        <RefreshCw size={28} />
        <h3>Hay que recargar la página</h3>
        <p>
          No se pudo descargar esta pantalla: el MES se actualizó o se perdió la
          conexión con el servidor. Recarga la página (F5) para continuar. Lo
          que no hayas guardado en otras pestañas del MES se perderá.
        </p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Recargar página
        </Button>
      </div>
    );
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
