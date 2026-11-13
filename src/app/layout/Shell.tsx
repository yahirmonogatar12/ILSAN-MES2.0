import { useState, type ReactNode } from "react";
import {
  Link,
  matchPath,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ChevronDown,
  FlaskConical,
  LogOut,
  Menu,
  PanelLeft,
  X,
} from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import type { ModuleDefinition, SectionDefinition } from "@/core/modules/types";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { usePersistentState } from "@/shared/hooks/usePersistentState";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { Alert, Button, IconButton, SelectField, TabBar } from "@/shared/ui";
import { Brand } from "./Brand";

interface Props {
  modules: readonly ModuleDefinition[];
  sections: readonly SectionDefinition[];
  children: ReactNode;
  tabs: readonly ModuleDefinition[];
  activeTabId: string | null;
  onActivateTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}
/** Application layout depends on descriptors, never on a business feature. */
export function Shell({
  modules,
  sections,
  children,
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
}: Props) {
  const { mode, profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const activeModule =
    modules.find((module) => matchPath(module.path, location.pathname)) ||
    modules[0];
  const activeSection = sections.find(
    (section) => section.id === activeModule?.sectionId,
  );
  const sectionModules = modules.filter(
    (module) => module.sectionId === activeSection?.id,
  );
  const groups = [...new Set(sectionModules.map((module) => module.group))];
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 700px)");
  useBodyScrollLock(isMobile && mobileOpen);
  const [collapsed, setCollapsed] = usePersistentState(
    "mes-v2:sidebar-collapsed",
    false,
    (value) => value === true,
  );
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const [leaving, setLeaving] = useState(false);
  const [exitError, setExitError] = useState<Error | null>(null);
  const hidden = isMobile ? !mobileOpen : collapsed;
  const home = modules[0]?.path || "/inicio";
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <header className="mes-header">
        <div className="header-identity">
          <Link to={home} aria-label="ILSAN MES inicio">
            <Brand />
          </Link>
          <div className="welcome-text">
            {mode === "demo"
              ? "Modo demostración"
              : `Bienvenido, ${profile?.nombre_completo || ""}`}
          </div>
        </div>
        <IconButton
          className="sidebar-toggle"
          label={
            isMobile
              ? "Abrir menú"
              : collapsed
                ? "Mostrar lista lateral"
                : "Ocultar lista lateral"
          }
          icon={isMobile ? <Menu size={22} /> : <PanelLeft size={18} />}
          onClick={() =>
            isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)
          }
        />
        <nav className="section-navigation" aria-label="Secciones del MES">
          {sections.map((section) => {
            const firstModule = modules.find(
              (module) => module.sectionId === section.id,
            );
            return firstModule ? (
              <NavLink
                className={`section-tile ${section.id === activeSection?.id ? "active" : ""}`}
                to={firstModule.path}
                key={section.id}
              >
                <img src={`/brand/${section.image}.png`} alt="" />
                <span>{section.title}</span>
              </NavLink>
            ) : (
              <Button
                variant="plain"
                className="section-tile"
                disabled
                title={`${section.title} · Próximamente`}
                key={section.id}
              >
                <img src={`/brand/${section.image}.png`} alt="" />
                <span>{section.title}</span>
              </Button>
            );
          })}
        </nav>
        <div className="header-session">
          {mode === "demo" && (
            <span className="mode-badge">
              <FlaskConical size={12} /> DEMO
            </span>
          )}
          <Button
            variant="danger"
            className="logout-button"
            icon={<LogOut size={16} />}
            loading={leaving}
            aria-label={
              mode === "demo" ? "Salir de demostración" : "Cerrar sesión"
            }
            onClick={async () => {
              setLeaving(true);
              setExitError(null);
              try {
                await logout();
                void navigate("/inicio", { replace: true });
              } catch (error) {
                setExitError(
                  error instanceof Error
                    ? error
                    : new Error("No se pudo cerrar sesión."),
                );
                setLeaving(false);
              }
            }}
          >
            <span>Salir</span>
          </Button>
        </div>
      </header>
      {isMobile && mobileOpen && (
        <Button
          variant="plain"
          className="sidebar-scrim"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}
        aria-label="Navegación principal"
        inert={hidden}
        aria-hidden={hidden || undefined}
      >
        <IconButton
          className="mobile-close"
          label="Cerrar menú"
          icon={<X size={18} />}
          onClick={() => setMobileOpen(false)}
        />
        {isMobile && (
          <SelectField
            label="Sección"
            containerClassName="mobile-section-picker"
            value={activeSection?.id || ""}
            options={sections
              .filter((section) =>
                modules.some((module) => module.sectionId === section.id),
              )
              .map((section) => ({ value: section.id, label: section.title }))}
            onChange={(event) => {
              const target = modules.find(
                (module) => module.sectionId === event.target.value,
              );
              if (target) void navigate(target.path);
            }}
          />
        )}
        <div className="sidebar-navigation">
          {groups.map((group) => (
            <div key={group} className="nav-group">
              <Button
                variant="plain"
                className="nav-parent"
                aria-expanded={!closedGroups[group]}
                onClick={() =>
                  setClosedGroups((previous) => ({
                    ...previous,
                    [group]: !previous[group],
                  }))
                }
              >
                <span>{group}</span>
                <ChevronDown
                  size={12}
                  className={closedGroups[group] ? "" : "nav-caret-expanded"}
                />
              </Button>
              {!closedGroups[group] && (
                <div className="nav-children">
                  {sectionModules
                    .filter((module) => module.group === group)
                    .map((module) => (
                      <NavLink
                        to={module.path}
                        key={module.id}
                        onClick={() => setMobileOpen(false)}
                      >
                        {module.title}
                      </NavLink>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
      <div className="main-shell">
        <div className="workspace-tabs">
          <TabBar
            id="workspace"
            label="Módulos abiertos"
            items={tabs.map((module) => ({
              id: module.id,
              label: module.title,
              title: `${module.title} · ${sections.find((section) => section.id === module.sectionId)?.title || ""}`,
            }))}
            activeId={activeTabId}
            onChange={onActivateTab}
            onClose={onCloseTab}
          />
        </div>
        {exitError && (
          <Alert tone="danger" className="shell-error">
            {exitError.message}
          </Alert>
        )}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
