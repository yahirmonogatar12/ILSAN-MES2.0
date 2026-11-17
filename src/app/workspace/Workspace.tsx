import {
  Activity,
  Suspense,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { PanelsTopLeft } from "lucide-react";
import { ModuleAccess } from "@/core/modules/ModuleAccess";
import { ActiveModuleContext } from "@/core/modules/ActiveModule";
import {
  allowsPermission,
  allowsRoles,
  usePermissions,
} from "@/core/auth/usePermission";
import { useAuth } from "@/core/auth/useAuth";
import type { ModuleDefinition, SectionDefinition } from "@/core/modules/types";
import type { RuntimeMode } from "@/core/runtime";
import {
  EmptyState,
  ErrorBoundary,
  ErrorState,
  InitialLoadingBoundary,
  LoadingPending,
  ModuleSkeleton,
  tabIds,
} from "@/shared/ui";
import { Shell, type WorkspaceSplit } from "../layout/Shell";
import { EMPTY_WORKSPACE } from "./tabs";
import { useWorkspaceTabs } from "./useWorkspaceTabs";

interface Props {
  modules: readonly ModuleDefinition[];
  sections: readonly SectionDefinition[];
  scope: string;
  mode: RuntimeMode;
  children?: ReactNode;
}
export function Workspace(props: Props) {
  const { profile } = useAuth();
  const access = usePermissions(true);
  const available = useMemo(
    () =>
      props.modules.filter(
        (module) =>
          (!module.demoOnly || props.mode === "demo") &&
          allowsRoles(profile, module.requiredRoles, props.mode) &&
          access.isSuccess &&
          allowsPermission(access.data, module.permission),
      ),
    [props.modules, props.mode, access.data, access.isSuccess, profile],
  );
  if (access.isPending || access.isError)
    return (
      <Shell
        modules={[]}
        sections={[]}
        tabs={[]}
        activeTabId={null}
        onActivateTab={() => {}}
        onCloseTab={() => {}}
      >
        {access.isError ? (
          <ErrorState
            error={access.error}
            title="No se pudieron verificar los permisos"
            onRetry={() => void access.refetch()}
          />
        ) : (
          <ModuleSkeleton label="Verificando permisos…" />
        )}
      </Shell>
    );
  return <AuthorizedWorkspace {...props} available={available} />;
}
function AuthorizedWorkspace({
  modules,
  sections,
  scope,
  mode,
  available,
  children,
}: Props & { available: readonly ModuleDefinition[] }) {
  const tabs = useWorkspaceTabs(available, scope);
  // Split view: the active tab (route-driven) plus one more open tab beside it.
  // ponytail: not persisted across reloads; store it with the tabs if asked.
  const [split, setSplit] = useState<WorkspaceSplit | null>(null);
  const splitModule =
    split && split.id !== tabs.activeModule?.id
      ? tabs.opened.find((module) => module.id === split.id)
      : undefined;
  const activeSplit = splitModule ? split : null;
  // Primary pane share (%). While dragging, the CSS variable is written straight
  // to the DOM so the heavy module trees don't re-render on every pointer move;
  // the final value is committed on release.
  const [splitSize, setSplitSize] = useState(50);
  const dragSize = useRef<number | null>(null);
  const panels = useRef<HTMLDivElement>(null);
  const clampSize = (value: number) => Math.min(80, Math.max(20, value));
  const sizeAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = panels.current!.getBoundingClientRect();
    return clampSize(
      activeSplit?.rows
        ? ((event.clientY - box.top) / box.height) * 100
        : ((event.clientX - box.left) / box.width) * 100,
    );
  };
  const home = available[0]?.path || EMPTY_WORKSPACE;
  const remembered =
    available.find((module) => module.id === tabs.lastActiveId)?.path || home;
  const active = useMemo(
    () =>
      tabs.activeModule
        ? {
            id: tabs.activeModule.id,
            title: tabs.activeModule.title,
            path: tabs.activeModule.path,
            panelId: tabIds("workspace", tabs.activeModule.id).panel,
          }
        : null,
    [tabs.activeModule],
  );
  return (
    <ActiveModuleContext.Provider value={active}>
      <Shell
        modules={available}
        sections={
          mode === "demo"
            ? sections
            : sections.filter((section) =>
                available.some((module) => module.sectionId === section.id),
              )
        }
        tabs={tabs.opened}
        activeTabId={tabs.activeModule?.id || null}
        split={activeSplit}
        onSplit={setSplit}
        onActivateTab={(id) => {
          // Clicking the tab shown in the second pane swaps the two panes.
          const current = tabs.activeModule?.id;
          if (activeSplit && id === activeSplit.id && current)
            setSplit({ ...activeSplit, id: current });
          tabs.activate(id);
        }}
        onCloseTab={tabs.close}
      >
        <div
          ref={panels}
          className={`workspace-panels ${activeSplit ? (activeSplit.rows ? "workspace-split-rows" : "workspace-split-columns") : ""}`}
          style={{ "--split-size": splitSize + "%" } as CSSProperties}
        >
          {activeSplit && (
            <div
              role="separator"
              aria-label="Redimensionar paneles (doble clic para centrar)"
              aria-orientation={activeSplit.rows ? "horizontal" : "vertical"}
              aria-valuemin={20}
              aria-valuemax={80}
              aria-valuenow={Math.round(splitSize)}
              tabIndex={0}
              className="workspace-split-divider"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                panels.current!.classList.add("workspace-split-dragging");
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId))
                  return;
                dragSize.current = sizeAt(event);
                panels.current!.style.setProperty(
                  "--split-size",
                  dragSize.current + "%",
                );
              }}
              // Fires after pointerup and after pointercancel alike, so the
              // committed size always matches what was last drawn.
              onLostPointerCapture={() => {
                panels.current!.classList.remove("workspace-split-dragging");
                if (dragSize.current !== null) setSplitSize(dragSize.current);
                dragSize.current = null;
              }}
              onDoubleClick={() => setSplitSize(50)}
              onKeyDown={(event) => {
                const step = {
                  ArrowLeft: -5,
                  ArrowUp: -5,
                  ArrowRight: 5,
                  ArrowDown: 5,
                }[event.key];
                if (!step) return;
                event.preventDefault();
                setSplitSize((size) => clampSize(size + step));
              }}
            />
          )}
          {tabs.opened.map((module) => {
            const active = module.id === tabs.activeModule?.id;
            const secondary = module.id === splitModule?.id;
            const visible = active || secondary;
            const ids = tabIds("workspace", module.id);
            const Component = module.component;
            return (
              <section
                key={module.id}
                id={ids.panel}
                role="tabpanel"
                aria-labelledby={ids.tab}
                className={`workspace-panel ${active && splitModule ? "workspace-panel-primary" : ""} ${secondary ? "workspace-panel-secondary" : ""}`}
                hidden={!visible}
                inert={!visible}
                tabIndex={-1}
              >
                {(tabs.visited.includes(module.id) || secondary) && (
                  <ModuleAccess
                    permission={module.permission}
                    demoOnly={module.demoOnly}
                    requiredRoles={module.requiredRoles}
                  >
                    <Activity
                      mode={visible ? "visible" : "hidden"}
                      name={module.id}
                    >
                      <ErrorBoundary
                        resetKey={`${scope}:${module.id}`}
                        fallback={(error, reset) => (
                          <ErrorState
                            error={error}
                            title="No se pudo mostrar el módulo"
                            onRetry={reset}
                          />
                        )}
                      >
                        <InitialLoadingBoundary
                          fallback={
                            <ModuleSkeleton
                              label={`Cargando ${module.title}…`}
                            />
                          }
                        >
                          <Suspense fallback={<LoadingPending />}>
                            <Component />
                          </Suspense>
                        </InitialLoadingBoundary>
                      </ErrorBoundary>
                    </Activity>
                  </ModuleAccess>
                )}
              </section>
            );
          })}
        </div>
        <Routes>
          {available.map((module) => (
            <Route key={module.id} path={module.path} element={null} />
          ))}
          {modules
            .filter((module) => !available.includes(module))
            .map((module) => (
              <Route
                key={module.id}
                path={module.path}
                element={
                  <ModuleAccess
                    permission={module.permission}
                    demoOnly={module.demoOnly}
                    requiredRoles={module.requiredRoles}
                  >
                    {null}
                  </ModuleAccess>
                }
              />
            ))}
          {modules.flatMap((module) =>
            (module.legacyPaths || []).map((path) => (
              <Route
                key={`${module.id}:legacy:${path}`}
                path={path}
                element={<Navigate to={module.path} replace />}
              />
            )),
          )}
          <Route path="/" element={<Navigate to={remembered} replace />} />
          <Route path="/mes" element={<Navigate to={remembered} replace />} />
          <Route
            path="/ILSAN-ELECTRONICS"
            element={<Navigate to="/mes" replace />}
          />
          <Route
            path={EMPTY_WORKSPACE}
            element={
              <EmptyState
                title={
                  available.length
                    ? "Sin pestañas abiertas"
                    : "Sin módulos asignados"
                }
                message={
                  available.length
                    ? "Selecciona un módulo de la barra superior o del menú lateral para comenzar."
                    : "Solicita al administrador un rol con acceso a los módulos que necesitas."
                }
                icon={<PanelsTopLeft size={30} />}
              />
            }
          />
          <Route
            path="*"
            element={
              <EmptyState
                title="Página no encontrada"
                message="Selecciona un módulo disponible."
                action={<Link to={home}>Volver al inicio</Link>}
              />
            }
          />
        </Routes>
      </Shell>
      {children}
    </ActiveModuleContext.Provider>
  );
}
