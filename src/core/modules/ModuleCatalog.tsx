import { useMemo, type ReactNode } from "react";
import type { ModuleDefinition, SectionDefinition } from "./types";
import { ModuleCatalogContext } from "./useModuleCatalog";
/** Presentation metadata only: no feature imports or screen preloading. */
export function ModuleCatalogProvider({
  modules,
  sections,
  children,
}: {
  modules: readonly ModuleDefinition[];
  sections: readonly SectionDefinition[];
  children: ReactNode;
}) {
  const catalog = useMemo(
    () =>
      modules.flatMap((module) =>
        module.permission
          ? [
              {
                id: module.id,
                title: module.title,
                group: module.group,
                section:
                  sections.find((section) => section.id === module.sectionId)
                    ?.title || module.sectionId,
                permission: module.permission,
              },
            ]
          : [],
      ),
    [modules, sections],
  );
  return (
    <ModuleCatalogContext.Provider value={catalog}>
      {children}
    </ModuleCatalogContext.Provider>
  );
}
