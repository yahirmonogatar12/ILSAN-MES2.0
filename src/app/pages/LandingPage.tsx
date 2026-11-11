import { useEffect } from "react";
import { PortalHeader } from "../landing/PortalHeader";
import "../landing/landing.css";

const welcome =
  "Bienvenido al Portal Integrado de Ilsan Electronics Monterrey México.";
const description =
  "Este portal ha sido diseñado para proporcionar a nuestros empleados un acceso centralizado a las aplicaciones y recursos esenciales que facilitan sus tareas diarias. Aquí encontrará herramientas para la gestión de materiales, control de calidad, soporte técnico y más.";

export function LandingPage() {
  useEffect(() => {
    document.title = "ILSAN Electronics - Portal Corporativo";
    return () => {
      document.title = "ILSAN MES";
    };
  }, []);
  return (
    <div className="landing-page">
      <PortalHeader />
      <main className="landing-content">
        <div className="landing-info-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <section className="landing-info" key={index}>
              <h2>{welcome}</h2>
              <p>{description}</p>
            </section>
          ))}
        </div>
      </main>
      <footer className="landing-footer">
        © {new Date().getFullYear()} Ilsan Electronics Monterrey México. Todos
        los derechos reservados.
      </footer>
    </div>
  );
}
