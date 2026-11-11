import type { ModuleDefinition } from "@/core/modules/types";

export const EMPTY_WORKSPACE = "/mes/inicio";
export interface WorkspaceState {
  ids: string[];
  activeId: string | null;
  /** Only visited screens have live React state; restored chips stay unloaded. */
  visited: string[];
}
/** Only module IDs/order are persisted. No records, form values or passwords. */
export function decodeTabs(
  value: unknown,
  modules: readonly ModuleDefinition[],
): WorkspaceState {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const valid = new Set(modules.map((module) => module.id));
  const ids = Array.isArray(source.ids)
    ? [
        ...new Set(
          source.ids.filter(
            (id): id is string => typeof id === "string" && valid.has(id),
          ),
        ),
      ]
    : [];
  return {
    ids,
    activeId:
      typeof source.activeId === "string" && ids.includes(source.activeId)
        ? source.activeId
        : ids[0] || null,
    visited: [],
  };
}
export function activateTab(
  state: WorkspaceState,
  id: string | undefined,
): WorkspaceState {
  if (
    !id ||
    (state.activeId === id &&
      state.ids.includes(id) &&
      state.visited.includes(id))
  )
    return state;
  return {
    ids: state.ids.includes(id) ? state.ids : [...state.ids, id],
    activeId: id,
    visited: state.visited.includes(id)
      ? state.visited
      : [...state.visited, id],
  };
}
/** Revoked modules lose their mounted state and are removed from preferences. */
export function reconcileTabs(
  state: WorkspaceState,
  modules: readonly ModuleDefinition[],
): WorkspaceState {
  const valid = new Set(modules.map((module) => module.id));
  const ids = state.ids.filter((id) => valid.has(id));
  const visited = state.visited.filter((id) => valid.has(id));
  const activeId =
    state.activeId && valid.has(state.activeId)
      ? state.activeId
      : ids[0] || null;
  return ids.length === state.ids.length &&
    visited.length === state.visited.length &&
    activeId === state.activeId
    ? state
    : { ids, visited, activeId };
}
export function removeTab(state: WorkspaceState, id: string): WorkspaceState {
  const index = state.ids.indexOf(id);
  if (index < 0) return state;
  const ids = state.ids.filter((value) => value !== id);
  return {
    ids,
    activeId:
      state.activeId === id
        ? ids[Math.min(index, ids.length - 1)] || null
        : state.activeId,
    visited: state.visited.filter((value) => value !== id),
  };
}
