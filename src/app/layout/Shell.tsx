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
  // A section tile only lists its modules; opening one stays the user's choice.
  // The pick lasts until the route changes, then the list follows the route.
  const [picked, setPicked] = useState<{ id: string; at: string } | null>(null);
  const activeSectionId =
    picked?.at === location.pathname ? picked.id : activeModule?.sectionId;
  const pickSection = (id: string) =>
    setPicked({ id, at: location.pathname });
  const activeSection = sections.find(
    (section) => section.id === activeSectionId,
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
  // After collapsing, the browser keeps the toggle :hover until the mouse moves,
  // so the button would flash over the logo. Hold the hover reveal until then.
  const [revealLocked, setRevealLocked] = useState(false);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const [railGroup, setRailGroup] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [exitError, setExitError] = useState<Error | null>(null);
  const hidden = isMobile ? !mobileOpen : collapsed;
  const compactIdentity = !isMobile && collapsed;
  const home = modules[0]?.path || "/inicio";
  return (
    <div
      className={`app-shell ${compactIdentity ? "sidebar-collapsed" : ""} ${revealLocked ? "reveal-locked" : ""}`}
    >
      <header className="mes-header">
        <div className="header-identity">
          <Link to={home} aria-label="ILSAN MES inicio">
            <Brand />
          </Link>
          <div
            className="welcome-text"
            aria-hidden={compactIdentity || undefined}
          >
            {mode === "demo"
              ? "Modo demostración"
              : `Bienvenido, ${profile?.nombre_completo || ""}`}
          </div>
          <IconButton
            className="sidebar-toggle"
            aria-controls="mes-sidebar"
            aria-expanded={!hidden}
            label={
              isMobile
                ? "Abrir menú"
                : collapsed
                  ? "Mostrar lista lateral"
                  : "Ocultar lista lateral"
            }
            icon={isMobile ? <Menu size={22} /> : <PanelLeft size={18} />}
            onClick={() => {
              if (isMobile) return setMobileOpen(!mobileOpen);
              if (!collapsed) {
                setRevealLocked(true);
                window.addEventListener(
                  "pointermove",
                  () => setRevealLocked(false),
                  { once: true },
                );
              }
              setCollapsed(!collapsed);
            }}
          />
        </div>
        <nav className="section-navigation" aria-label="Secciones del MES">
          {sections.map((section) => {
            const hasModules = modules.some(
              (module) => module.sectionId === section.id,
            );
            const breakAt = section.title.lastIndexOf(" ");
            const label = (
              <span className="section-tile-label">
                {breakAt < 0 ? (
                  section.title
                ) : (
                  <>
                    <span>{section.title.slice(0, breakAt)}</span>{" "}
                    <span>{section.title.slice(breakAt + 1)}</span>
                  </>
                )}
              </span>
            );
            const selected = section.id === activeSection?.id;
            return hasModules ? (
              <Button
                variant="plain"
                className={`section-tile ${selected ? "active" : ""}`}
                aria-pressed={selected}
                key={section.id}
                onClick={() => pickSection(section.id)}
              >
                <img src={`/brand/${section.image}.png`} alt="" />
                {label}
              </Button>
            ) : (
              <Button
                variant="plain"
                className="section-tile"
                disabled
                title={`${section.title} · Próximamente`}
                key={section.id}
              >
                <img src={`/brand/${section.image}.png`} alt="" />
                {label}
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
        id="mes-sidebar"
        className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}
        aria-label="Navegación principal"
        inert={isMobile && hidden}
        aria-hidden={(isMobile && hidden) || undefined}
      >
        <div
          className="sidebar-expanded-content"
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
                .map((section) => ({
                  value: section.id,
                  label: section.title,
                }))}
              onChange={(event) => pickSection(event.target.value)}
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
        </div>
        {compactIdentity && (
          <nav className="sidebar-rail" aria-label="Accesos de módulos">
            {/* One button per group; its modules open in a flyout on hover/click. */}
            {groups.map((group) => {
              const items = sectionModules.filter(
                (module) => module.group === group,
              );
              const Icon = items[0]!.icon;
              const open = railGroup === group;
              return (
                <div
                  key={group}
                  className="sidebar-rail-group"
                  onPointerEnter={() => setRailGroup(group)}
                  onPointerLeave={() => setRailGroup(null)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                      setRailGroup(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setRailGroup(null);
                  }}
                >
                  <button
                    type="button"
                    className={`sidebar-rail-link ${items.some((module) => matchPath(module.path, location.pathname)) ? "active" : ""}`}
                    aria-label={group}
                    aria-expanded={open}
                    onClick={() => setRailGroup(group)}
                  >
                    <Icon size={20} aria-hidden="true" />
                  </button>
                  {open && (
                    <div className="sidebar-rail-flyout">
                      <div className="sidebar-rail-panel">
                        <span className="sidebar-rail-title">{group}</span>
                        {items.map((module) => (
                          <NavLink
                            key={module.id}
                            to={module.path}
                            onClick={() => setRailGroup(null)}
                          >
                            {module.title}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}
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
