import { Suspense, useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { ModuleAccess } from "@/core/modules/ModuleAccess";
import type { ModuleDefinition } from "@/core/modules/types";
import {
  EmptyState,
  ErrorBoundary,
  ErrorState,
  InitialLoadingBoundary,
  LoadingPending,
  ModuleSkeleton,
} from "@/shared/ui";

/** Query flag of a module opened in its own browser window (see Workspace.popOut). */
export const WINDOW_FLAG = "ventana";

/** One module alone, without header, menus or tabs; same session and permissions. */
export function ModuleWindow({
  modules,
}: {
  modules: readonly ModuleDefinition[];
}) {
  const { pathname } = useLocation();
  const module = modules.find((item) => matchPath(item.path, pathname));
  useEffect(() => {
    if (module) document.title = `${module.title} · ILSAN MES`;
  }, [module]);
  if (!module)
    return (
      <main className="module-window">
        <EmptyState
          title="Módulo no encontrado"
          message="Cierra esta ventana y abre el módulo desde el MES."
        />
      </main>
    );
  const Component = module.component;
  return (
    <main className="module-window">
      <ModuleAccess
        permission={module.permission}
        demoOnly={module.demoOnly}
        requiredRoles={module.requiredRoles}
      >
        <ErrorBoundary
          resetKey={module.id}
          fallback={(error, reset) => (
            <ErrorState
              error={error}
              title="No se pudo mostrar el módulo"
              onRetry={reset}
            />
          )}
        >
          <InitialLoadingBoundary
            fallback={<ModuleSkeleton label={`Cargando ${module.title}…`} />}
          >
            <Suspense fallback={<LoadingPending />}>
              <Component />
            </Suspense>
          </InitialLoadingBoundary>
        </ErrorBoundary>
      </ModuleAccess>
    </main>
  );
}
