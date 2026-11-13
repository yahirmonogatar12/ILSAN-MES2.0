import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { TextField } from "../Fields";
import type { CellEditor, SaveCell } from "./useCellEditor";

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
