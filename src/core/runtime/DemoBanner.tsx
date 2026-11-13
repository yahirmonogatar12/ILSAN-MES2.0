import { useAuth } from "../auth/useAuth";
export function DemoBanner() {
  const { mode } = useAuth();
  if (mode !== "demo") return null;
  return (
    <div className="demo-banner">
      <span className="demo-banner-mark" />
      <span>
        <strong>Estás explorando una demostración.</strong> Los cambios se
        guardan en este navegador.
      </span>
      <span className="demo-banner-label">DATOS DE EJEMPLO</span>
    </div>
  );
}
