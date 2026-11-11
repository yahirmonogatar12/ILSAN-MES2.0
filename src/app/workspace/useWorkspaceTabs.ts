import { useEffect, useMemo, useState } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import type { ModuleDefinition } from "@/core/modules/types";
import { readStorage, writeStorage } from "@/shared/lib/storage";
import {
  activateTab,
  decodeTabs,
  EMPTY_WORKSPACE,
  reconcileTabs,
  removeTab,
} from "./tabs";

export function useWorkspaceTabs(
  modules: readonly ModuleDefinition[],
  scope: string,
) {
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = `mes-v2:tabs:${scope}`;
  const [state, setState] = useState(() =>
    decodeTabs(readStorage(storageKey, null), modules),
  );
  const activeModule = modules.find((module) =>
    matchPath(module.path, location.pathname),
  );
  const activeId = activeModule?.id;
  // Derive immediately, so a newly navigated screen renders in its final panel
  // without a temporary mount elsewhere or a frame with missing content.
  const current = useMemo(
    () => activateTab(reconcileTabs(state, modules), activeId),
    [state, activeId, modules],
  );
  useEffect(() => {
    setState((previous) =>
      activateTab(reconcileTabs(previous, modules), activeId),
    );
  }, [activeId, modules]);
  useEffect(() => {
    writeStorage(storageKey, { ids: current.ids, activeId: current.activeId });
  }, [storageKey, current.ids, current.activeId]);
  const opened = current.ids.flatMap((id) => {
    const module = modules.find((item) => item.id === id);
    return module ? [module] : [];
  });
  function activate(id: string) {
    const module = modules.find((item) => item.id === id);
    if (module && module.id !== activeId) void navigate(module.path);
  }
  function close(id: string) {
    const next = removeTab(current, id);
    setState(next);
    if (id === activeId) {
      const target =
        modules.find((module) => module.id === next.activeId)?.path ||
        EMPTY_WORKSPACE;
      void navigate(target, { replace: true });
      // Return keyboard focus to the remaining selected tab after its render.
      requestAnimationFrame(() =>
        (
          document.querySelector<HTMLElement>(
            '.workspace-tabs [aria-selected="true"]',
          ) || document.getElementById("main-content")
        )?.focus(),
      );
    }
  }
  return {
    opened,
    activeModule,
    visited: current.visited,
    lastActiveId: current.activeId,
    activate,
    close,
  };
}
