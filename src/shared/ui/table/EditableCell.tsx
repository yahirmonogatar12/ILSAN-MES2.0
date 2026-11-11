import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { TextField } from "../Fields";

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
type SaveCell = (value: string) => Promise<string | void>;

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

/** Spreadsheet-style cell. Domain validation and persistence belong to onSave. */
export function EditableCell({
  editor,
  cellId,
  value,
  label,
  onSave,
  formatValue = (value) => value || "—",
  disabled = false,
  onCancel,
}: {
  editor: CellEditor;
  cellId: string;
  value: string | number | null | undefined;
  label: string;
  onSave: SaveCell;
  formatValue?: (value: string) => string;
  disabled?: boolean;
  onCancel?: () => void;
}) {
  const raw = value == null ? "" : String(value),
    input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const subscribe = useMemo(
    () => (listener: () => void) => editor.subscribe(cellId, listener),
    [editor, cellId],
  );
  const snapshot = useMemo(
    () => () => editor.snapshot(cellId, raw),
    [editor, cellId, raw],
  );
  const state = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    editor.sync(cellId, raw);
  }, [editor, cellId, raw]);
  useEffect(() => {
    if (focused) input.current?.select();
  }, [focused]);
  const dirty = state.draft !== state.saved;
  const save = (retry = false) => {
    if (!disabled) void editor.save(cellId, onSave, retry);
  };
  return (
    <TextField
      ref={input}
      aria-label={label}
      aria-busy={state.pending || undefined}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      readOnly={state.pending}
      containerClassName={`ui-editable-cell ${dirty ? "is-dirty" : ""} ${state.pending ? "is-saving" : ""}`}
      error={state.error || undefined}
      title={
        state.error ||
        (state.pending
          ? "Guardando…"
          : "Enter o Tab para guardar · Escape para cancelar")
      }
      value={
        focused || dirty || state.pending || state.error
          ? state.draft
          : formatValue(state.saved)
      }
      onFocus={() => setFocused(true)}
      onChange={(event) => editor.edit(cellId, event.target.value)}
      onBlur={() => {
        setFocused(false);
        save();
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") {
          event.preventDefault();
          save(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          editor.cancel(cellId);
          if (!state.pending) onCancel?.();
          input.current?.select();
        }
      }}
    />
  );
}
