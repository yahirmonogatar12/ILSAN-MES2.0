import { Activity, Suspense, useMemo, type ReactNode } from "react";
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
import { Shell } from "../layout/Shell";
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
        onActivateTab={tabs.activate}
        onCloseTab={tabs.close}
      >
        {tabs.opened.map((module) => {
          const active = module.id === tabs.activeModule?.id;
          const ids = tabIds("workspace", module.id);
          const Component = module.component;
          return (
            <section
              key={module.id}
              id={ids.panel}
              role="tabpanel"
              aria-labelledby={ids.tab}
              className="workspace-panel"
              hidden={!active}
              inert={!active}
              tabIndex={-1}
            >
              {tabs.visited.includes(module.id) && (
                <ModuleAccess
                  permission={module.permission}
                  demoOnly={module.demoOnly}
                  requiredRoles={module.requiredRoles}
                >
                  <Activity
                    mode={active ? "visible" : "hidden"}
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
                          <ModuleSkeleton label={`Cargando ${module.title}…`} />
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
