import { useMemo } from "react";

interface CellState {
  source: string;
  saved: string;
  draft: string;
  pending: boolean;
  error: string;
}

interface CellEntry {
  state: CellState;
  listeners: Set<() => void>;
}

export type SaveCell = (value: string) => Promise<string | void>;

/** Per-table editor state survives virtual-row unmounts, including pending saves. */
function createCellEditor() {
  const entries = new Map<string, CellEntry>();
  function entry(id: string, value = ""): CellEntry {
    let item = entries.get(id);
    if (!item) {
      item = {
        state: {
          source: value,
          saved: value,
          draft: value,
          pending: false,
          error: "",
        },
        listeners: new Set(),
      };
      entries.set(id, item);
    }
    return item;
  }
  function update(id: string, patch: Partial<CellState>) {
    const item = entry(id);
    item.state = { ...item.state, ...patch };
    item.listeners.forEach((listener) => listener());
  }
  return {
    snapshot: (id: string, value: string) => entry(id, value).state,
    subscribe(id: string, listener: () => void) {
      const item = entry(id);
      item.listeners.add(listener);
      return () => {
        item.listeners.delete(listener);
      };
    },
    sync(id: string, value: string) {
      const { state } = entry(id, value);
      if (state.source === value) return;
      update(
        id,
        state.pending
          ? { source: value }
          : {
              source: value,
              saved: value,
              ...(state.draft === state.saved && !state.error
                ? { draft: value }
                : {}),
            },
      );
    },
    edit(id: string, draft: string) {
      if (!entry(id).state.pending) update(id, { draft, error: "" });
    },
    cancel(id: string) {
      const { state } = entry(id);
      if (!state.pending) update(id, { draft: state.saved, error: "" });
    },
    async save(id: string, onSave: SaveCell, retry = false) {
      const { state } = entry(id);
      if (
        state.pending ||
        state.draft === state.saved ||
        (state.error && !retry)
      )
        return;
      const draft = state.draft;
      update(id, { pending: true, error: "" });
      try {
        const saved = await onSave(draft);
        update(id, {
          saved: saved ?? draft,
          draft: saved ?? draft,
          pending: false,
          error: "",
        });
      } catch (error) {
        update(id, {
          pending: false,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo guardar la celda.",
        });
      }
    },
  };
}

export type CellEditor = ReturnType<typeof createCellEditor>;

export function useCellEditor(): CellEditor {
  return useMemo(createCellEditor, []);
}
