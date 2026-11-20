import { ArrowDown, ArrowUpDown, Filter, LoaderCircle } from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button, IconButton } from "../Button";
import { EmptyState, ErrorState } from "../Feedback";
import { TableSkeleton } from "../Skeleton";
import { ColumnFilter } from "./ColumnFilter";
import { ColumnSearch } from "./ColumnSearch";
import type { GridAnchor } from "./GridPopup";
import type {
  ColumnFilters,
  TableColumn,
  TableSort,
  TableGrouping,
} from "./types";
import { groupTableRows } from "./tableGroups";
import { cellText, distinctValues } from "./tableFilters";
import "./filters.css";
import type { WorksheetView } from "../../lib/worksheet";
import { readStorage, writeStorage } from "../../lib/storage";
import { focusableControls, isTextEntry } from "../../lib/focus";
import { TableStorageScope } from "./tableConfig";

interface StoredWidths {
  key: string;
  widths: Record<string, number>;
}
/** Persisted input is untrusted: keep it only when every width is a non-negative number. */
function decodeWidths(value: unknown): StoredWidths | null {
  const stored = value as Partial<StoredWidths> | null;
  return typeof stored?.key === "string" &&
    stored.widths &&
    typeof stored.widths === "object" &&
    Object.values(stored.widths).every(
      (width) => typeof width === "number" && width >= 0,
    )
    ? (stored as StoredWidths)
    : null;
}
/** Buttons and fields a Tab can reach inside a cell, header sort and filter included. */
function tabbableControls(cell: HTMLElement) {
  return focusableControls(cell).filter((control) => control.tabIndex >= 0);
}
/** Cell at a grid position; a position covered by a row or column span resolves to the spanning cell. */
function cellAt(table: HTMLTableElement, row: number, col: number) {
  for (let r = row; r >= Math.max(-1, row - 50); r--)
    for (let c = col; c >= 0; c--) {
      const cell = table.querySelector<HTMLTableCellElement>(
        `[data-row="${r}"][data-col="${c}"]`,
      );
      if (cell && r + cell.rowSpan > row && c + cell.colSpan > col) return cell;
    }
  return null;
}

/** Workbook layout renderer; deliberately has no sorting/filtering that could move original cells. */
export function WorksheetTable({
  view,
  label,
}: {
  view: WorksheetView;
  label: string;
}) {
  return (
    <div
      className="worksheet-overflow"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="worksheet-table" aria-label={label}>
        <colgroup>
          <col style={{ width: 44 }} />
          {view.columns.map((column) => (
            <col key={column.label} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th aria-label="Fila" />
            {view.columns.map((column) => (
              <th key={column.label} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <tr key={row.number} style={{ height: row.height }}>
              <th scope="row">{row.number}</th>
              {row.cells.map((cell) => (
                <td
                  key={cell.column}
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly TableColumn<T>[];
  rowKey: (row: T, index: number) => Key;
  label: string;
  loading?: boolean;
  loadingText?: string;
  error?: unknown;
  onRetry?: () => void;
  fetching?: boolean;
  emptyState?: ReactNode;
  sorting?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  minWidth?: number;
  /** Fixed layout fits declared column widths; minWidth preserves scrolling on narrow screens. */
  layout?: "auto" | "fixed";
  maxHeight?: string;
  /** Reset vertical position for a new page or query while preserving horizontal position. */
  scrollResetKey?: string;
  /** Optional fixed-height window. Keep complete groups together when cells span rows. */
  virtualRows?: { rowHeight: number; groupSize?: number };
  className?: string;
  rowProps?: (
    row: T,
    index: number,
  ) => Omit<HTMLAttributes<HTMLTableRowElement>, "children">;
  grouping?: TableGrouping<T>;
  /** Full filtered records for group totals; defaults to the current rows. */
  groupingRows?: readonly T[];
  filters?: ColumnFilters;
  filterOptions?: Readonly<Record<string, readonly string[]>>;
  /** Optional remote text filters. The consumer applies them before server pagination. */
  columnSearches?: Readonly<Record<string, string>>;
  onColumnSearchChange?: (columnId: string, value: string) => void;
  onColumnFilterChange?: (
    columnId: string,
    values: readonly string[] | null,
  ) => void;
}
/** Controlled, domain-independent table. Fetching, permissions and exports stay outside. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  label,
  loading,
  loadingText,
  error,
  onRetry,
  fetching,
  emptyState,
  sorting,
  onSortChange,
  minWidth = 800,
  layout = "auto",
  maxHeight,
  scrollResetKey,
  virtualRows,
  className = "",
  rowProps,
  grouping,
  groupingRows = rows,
  filters = {},
  filterOptions = {},
  columnSearches = {},
  onColumnSearchChange,
  onColumnFilterChange,
}: DataTableProps<T>) {
  const overflowRef = useRef<HTMLDivElement>(null);
  const [windowRange, setWindowRange] = useState({ start: 0, count: 60 });
  const previousScrollResetKey = useRef(scrollResetKey);
  useEffect(() => {
    // Activity reconnects effects when the same workspace tab becomes visible.
    if (previousScrollResetKey.current === scrollResetKey) return;
    previousScrollResetKey.current = scrollResetKey;
    if (overflowRef.current) overflowRef.current.scrollTop = 0;
    setWindowRange((previous) => ({ ...previous, start: 0 }));
  }, [scrollResetKey]);
  const rowHeight = virtualRows?.rowHeight ?? 0;
  const groupSize = Math.max(1, Math.floor(virtualRows?.groupSize ?? 1));
  const windowed = !grouping && Number.isFinite(rowHeight) && rowHeight > 0;
  const rowGroups = useMemo(() => {
    if (!grouping) return [];
    const visible = new Map(
      groupTableRows(rows, grouping).map((group) => [group.key, group.rows]),
    );
    return groupTableRows(groupingRows, grouping)
      .filter(
        (group) =>
          visible.get(group.key)?.length ||
          (!group.rows.length && grouping.showEmpty),
      )
      .map((group) => ({
        ...group,
        visibleRows: visible.get(group.key) ?? [],
      }));
  }, [rows, groupingRows, grouping]);
  useEffect(() => {
    const element = overflowRef.current;
    if (!windowed || !element) return;
    let frame = 0;
    const update = () => {
      const headerHeight =
        element.querySelector("thead")?.getBoundingClientRect().height ?? 36;
      const start =
        Math.max(
          0,
          Math.floor(
            Math.max(0, element.scrollTop - headerHeight) /
              rowHeight /
              groupSize,
          ) - 8,
        ) * groupSize;
      const count =
        (Math.ceil((element.clientHeight || 500) / rowHeight / groupSize) +
          16) *
        groupSize;
      setWindowRange((previous) =>
        previous.start === start && previous.count === count
          ? previous
          : { start, count },
      );
    };
    const onScroll = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(element);
    update();
    return () => {
      element.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [windowed, rowHeight, groupSize, loading, error, rows.length]);
  const firstRow = windowed
    ? Math.min(
        windowRange.start,
        Math.max(0, Math.floor((rows.length - 1) / groupSize) * groupSize),
      )
    : 0;
  const lastRow = windowed
    ? Math.min(rows.length, firstRow + windowRange.count)
    : rows.length;
  const visibleRows = windowed ? rows.slice(firstRow, lastRow) : rows;
  const [popup, setPopup] = useState<{ id: string; anchor: GridAnchor } | null>(
    null,
  );
  const closePopup = useCallback(() => setPopup(null), []);
  const activeColumn = popup
    ? columns.find((column) => column.id === popup.id)
    : null;
  const searchOptions = useMemo(() => {
    if (!activeColumn || !onColumnSearchChange || onColumnFilterChange)
      return [];
    const supplied = filterOptions[activeColumn.id];
    if (supplied?.length)
      return distinctValues(supplied.filter((value) => value !== "")).map(
        (value) => ({ value, label: value }),
      );
    const labels = new Map<string, string>();
    for (const row of rows) {
      const label = cellText(activeColumn, row);
      const value = activeColumn.searchValue?.(row) ?? label;
      if (label && label !== "—" && value !== "") labels.set(value, label);
    }
    return [...labels]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es", {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [
    activeColumn,
    rows,
    filterOptions,
    onColumnSearchChange,
    onColumnFilterChange,
  ]);
  const rowIndexes = useMemo(
    () => new Map(rows.map((row, index) => [row, index])),
    [rows],
  );
  // Widths are remembered per user and table label in this browser; a column change discards them.
  const storageKey = `mes-v2:table-widths:${useContext(TableStorageScope)}:${label}`;
  const columnKey = columns.map((column) => column.id).join("\n");
  const [resized, setResized] = useState(() =>
    decodeWidths(readStorage<unknown>(storageKey, null)),
  );
  const widths =
    resized?.key === storageKey + "\n" + columnKey ? resized.widths : null;
  function resetWidths() {
    setResized(null);
    writeStorage(storageKey, null);
  }
  /** Freeze every column at its rendered width so only the changed one moves. */
  function measuredWidths(headerRow: Element) {
    const cells = [...headerRow.children] as HTMLElement[];
    return Object.fromEntries(
      columns.map((column, index) => [
        column.id,
        widths?.[column.id] ?? cells[index].offsetWidth,
      ]),
    );
  }
  function withWidth(
    base: Record<string, number>,
    id: string,
    width: number,
  ): StoredWidths {
    return {
      key: storageKey + "\n" + columnKey,
      widths: { ...base, [id]: Math.max(40, Math.round(width)) },
    };
  }
  function startResize(event: PointerEvent<HTMLSpanElement>, id: string) {
    event.preventDefault();
    const base = measuredWidths(event.currentTarget.closest("tr")!);
    const startX = event.clientX;
    let latest: StoredWidths | null = null;
    const move = (moveEvent: globalThis.PointerEvent) => {
      latest = withWidth(base, id, base[id] + moveEvent.clientX - startX);
      setResized(latest);
    };
    const stop = () => {
      if (latest) writeStorage(storageKey, latest);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }
  const resizedWidth = widths
    ? Object.values(widths).reduce((sum, width) => sum + width, 0)
    : 0;

  // Excel-style keyboard: one Tab stop per table and arrows/Tab move between cells.
  // The stop is set in the DOM after each render, so moving it never re-renders rows,
  // and rows that come and go (queries, filters, virtual scrolling) never leave the table without one.
  const tableRef = useRef<HTMLTableElement>(null);
  const activeCell = useRef({ row: 0, col: 0 });
  const pendingFocus = useRef(false);
  function setTabStop(cell: HTMLElement) {
    for (const other of tableRef.current!.querySelectorAll<HTMLElement>(
      '[data-row][tabindex="0"]',
    ))
      if (other !== cell) other.tabIndex = -1;
    cell.tabIndex = 0;
  }
  function markCell(cell: HTMLElement) {
    setTabStop(cell);
    activeCell.current = {
      row: Number(cell.dataset.row),
      col: Number(cell.dataset.col),
    };
  }
  /** Focus a cell; `into` lands on its first or last button instead, as Tab does. */
  function goTo(row: number, col: number, into?: "first" | "last") {
    const table = tableRef.current!;
    const selection = window.getSelection();
    if (selection?.anchorNode && table.contains(selection.anchorNode))
      selection.removeAllRanges();
    const cell = cellAt(table, row, col);
    if (cell) {
      markCell(cell);
      const controls = into ? tabbableControls(cell) : [];
      ((into === "last" ? controls.at(-1) : controls[0]) ?? cell).focus();
    } else if (windowed) {
      // Virtual rows are drawn on scroll; the effect below focuses the cell once it exists.
      activeCell.current = { row, col };
      pendingFocus.current = true;
      const element = overflowRef.current!;
      element.scrollTop = Math.max(
        0,
        row * rowHeight - element.clientHeight / 2,
      );
    }
  }
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const { row, col } = activeCell.current;
    const cell = cellAt(table, row, col);
    if (cell && pendingFocus.current) {
      pendingFocus.current = false;
      markCell(cell);
      cell.focus();
      return;
    }
    const stop =
      cell ??
      table.querySelector<HTMLElement>(
        `th[data-row="-1"][data-col="${Math.min(col, columns.length - 1)}"]`,
      );
    if (stop) setTabStop(stop);
  });
  function onGridKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    if (event.defaultPrevented || isTextEntry(event.target)) return;
    const table = event.currentTarget;
    const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>(
      "[data-row]",
    );
    if (!cell || !table.contains(cell)) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const onCell = event.target === cell;
    const { key, altKey, shiftKey } = event;
    const ctrl = event.ctrlKey || event.metaKey;
    if (altKey && key === "ArrowDown") {
      event.preventDefault();
      table
        .querySelector<HTMLElement>(
          `th[data-row="-1"][data-col="${col}"] .table-column-filter`,
        )
        ?.click();
      return;
    }
    if (row === -1 && shiftKey && /^Arrow(Left|Right)$/.test(key)) {
      event.preventDefault();
      const base = measuredWidths(cell.parentElement!);
      const id = columns[col].id;
      const next = withWidth(
        base,
        id,
        base[id] + (key === "ArrowLeft" ? -10 : 10),
      );
      setResized(next);
      writeStorage(storageKey, next);
      return;
    }
    if (onCell && (key === "Enter" || key === "F2")) {
      event.preventDefault();
      if (row === -1)
        return void cell.querySelector<HTMLElement>(".sort-button")?.click();
      const [control] = focusableControls(cell);
      // No control inside: Enter opens the row the same way a double click does.
      if (control) control.focus();
      else
        cell.parentElement?.dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true }),
        );
      return;
    }
    if (ctrl && key.toLowerCase() === "c") {
      // Select the cell so the browser's own copy takes its text.
      if (onCell && !window.getSelection()?.toString())
        window.getSelection()?.selectAllChildren(cell);
      return;
    }
    const tab = key === "Tab" && !altKey && !ctrl;
    if (
      !tab &&
      (altKey || shiftKey || (ctrl && key !== "Home" && key !== "End"))
    )
      return;
    const last = columns.length - 1;
    // Header first, then body rows in screen order (grouping may reorder them).
    const order = windowed
      ? null
      : [
          -1,
          ...[...table.tBodies].flatMap((body) =>
            [...body.rows]
              .map((tableRow) =>
                tableRow.querySelector("[data-row]")?.getAttribute("data-row"),
              )
              .filter((value) => value != null)
              .map(Number),
          ),
        ];
    const position = (value: number) => (order ? order.indexOf(value) : value);
    const rowAt = (index: number) => (order ? order[index] : index);
    const lowest = order ? 0 : -1;
    const highest = order ? order.length - 1 : rows.length - 1;
    const vertical = (delta: number) => {
      let index = Math.min(highest, Math.max(lowest, position(row) + delta));
      // Skip positions covered by the current cell's own row span.
      while (index !== position(row)) {
        const next = cellAt(table, rowAt(index), col);
        if (!next || next !== cell) return goTo(rowAt(index), col);
        index += Math.sign(delta);
        if (index < lowest || index > highest) return;
      }
    };
    const sideways = (delta: number) => {
      for (let next = col + delta; next >= 0 && next <= last; next += delta)
        if (cellAt(table, row, next) !== cell) return goTo(row, next);
    };
    const page = Math.max(
      1,
      Math.floor(
        (overflowRef.current?.clientHeight || 400) /
          Math.max(cell.offsetHeight, 24),
      ) - 1,
    );
    if (tab) {
      const step = shiftKey ? -1 : 1;
      const into = shiftKey ? "last" : "first";
      const controls = tabbableControls(cell);
      const index = controls.indexOf(event.target as HTMLElement);
      // A cell's own buttons come first; from the cell itself Tab enters them.
      if (controls[index + step] && (index >= 0 || !shiftKey)) return;
      const inRow = (value: number) => [
        ...table.querySelectorAll<HTMLElement>(`[data-row="${value}"]`),
      ];
      const sibling = inRow(row)[inRow(row).indexOf(cell) + step];
      if (sibling) {
        event.preventDefault();
        return goTo(row, Number(sibling.dataset.col), into);
      }
      const next = position(row) + step;
      // Past the first or last cell, Tab leaves the table as usual.
      if (next < lowest || next > highest) return;
      event.preventDefault();
      const cells = inRow(rowAt(next));
      const edge = shiftKey ? cells.at(-1) : cells[0];
      return goTo(
        rowAt(next),
        edge ? Number(edge.dataset.col) : shiftKey ? last : 0,
        into,
      );
    }
    const moves: Record<string, () => void> = {
      ArrowLeft: () => sideways(-1),
      ArrowRight: () => sideways(1),
      ArrowUp: () => vertical(-1),
      ArrowDown: () => vertical(1),
      PageUp: () => vertical(-page),
      PageDown: () => vertical(page),
      Home: () => goTo(ctrl ? rowAt(Math.min(highest, lowest + 1)) : row, 0),
      End: () => goTo(ctrl ? rowAt(highest) : row, last),
    };
    if (!moves[key]) return;
    event.preventDefault();
    moves[key]();
  }
  function renderRow(row: T, index: number) {
    return (
      <tr
        {...rowProps?.(row, index)}
        key={rowKey(row, index)}
        aria-rowindex={windowed ? index + 2 : undefined}
      >
        {columns.map((column, colIndex) => {
          const span = column.cellSpan?.(row, index);
          if (span?.rowSpan === 0 || span?.colSpan === 0) return null;
          return (
            <td
              key={column.id}
              data-row={index}
              data-col={colIndex}
              tabIndex={-1}
              rowSpan={span?.rowSpan}
              colSpan={span?.colSpan}
              className={column.className}
              style={{ textAlign: column.align } as CSSProperties}
            >
              {column.cell(row)}
            </td>
          );
        })}
      </tr>
    );
  }
  if (loading)
    return (
      <TableSkeleton
        label={loadingText ?? `Cargando ${label}…`}
        columns={columns.length}
        maxHeight={maxHeight}
      />
    );
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (
    !rows.length &&
    !rowGroups.length &&
    !onColumnFilterChange &&
    !onColumnSearchChange
  )
    return emptyState ?? <EmptyState />;
  return (
    <>
      <div
        ref={overflowRef}
        className={`table-overflow ${fetching ? "table-refreshing" : ""} ${className}`}
        style={{ maxHeight }}
        aria-busy={fetching || undefined}
      >
        <table
          ref={tableRef}
          onKeyDown={onGridKeyDown}
          onFocus={(event) => {
            const cell = (event.target as HTMLElement).closest<HTMLElement>(
              "[data-row]",
            );
            if (cell && event.currentTarget.contains(cell)) markCell(cell);
          }}
          className={`ui-data-table${layout === "fixed" ? " ui-data-table-fixed" : ""}${widths ? " ui-data-table-resized" : ""}`}
          aria-label={label}
          aria-rowcount={windowed ? rows.length + 1 : undefined}
          style={
            widths
              ? { width: resizedWidth, minWidth: resizedWidth }
              : { minWidth }
          }
        >
          <thead>
            <tr>
              {columns.map((column, colIndex) => {
                const active = sorting?.columnId === column.id;
                return (
                  <th
                    key={column.id}
                    data-row={-1}
                    data-col={colIndex}
                    tabIndex={-1}
                    style={{
                      textAlign: column.align,
                      minWidth: widths ? undefined : column.minWidth,
                      width: widths?.[column.id] ?? column.width,
                    }}
                    aria-sort={
                      column.sortValue && onSortChange
                        ? active
                          ? sorting.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                  >
                    <div className="table-column-heading">
                      {column.sortValue && onSortChange ? (
                        <Button
                          variant="plain"
                          className="sort-button"
                          onClick={() =>
                            onSortChange({
                              columnId: column.id,
                              direction:
                                active && sorting.direction === "asc"
                                  ? "desc"
                                  : "asc",
                            })
                          }
                        >
                          <span
                            className="table-column-title"
                            title={column.header}
                          >
                            {column.header}
                          </span>
                          {active ? (
                            <ArrowDown
                              size={12}
                              className={
                                sorting.direction === "asc" ? "up-arrow" : ""
                              }
                            />
                          ) : (
                            <ArrowUpDown size={12} />
                          )}
                        </Button>
                      ) : (
                        <span
                          className="table-column-title"
                          title={column.header}
                        >
                          {column.header}
                        </span>
                      )}
                      {(onColumnFilterChange || onColumnSearchChange) &&
                        column.filterable !== false && (
                          <IconButton
                            label={`Filtrar ${column.header}`}
                            className={`table-column-filter ${filters[column.id] || columnSearches[column.id] ? "active" : ""}`}
                            icon={<Filter size={12} />}
                            aria-haspopup="dialog"
                            aria-expanded={popup?.id === column.id}
                            onClick={(event) => {
                              const rect =
                                event.currentTarget.getBoundingClientRect();
                              setPopup({
                                id: column.id,
                                anchor: {
                                  x: rect.right - 280,
                                  y: rect.bottom + 4,
                                  trigger: event.currentTarget,
                                },
                              });
                            }}
                          />
                        )}
                    </div>
                    <span
                      className="table-column-resizer"
                      aria-hidden="true"
                      title="Arrastra para cambiar el ancho · doble clic restablece"
                      onPointerDown={(event) => startResize(event, column.id)}
                      onDoubleClick={resetWidths}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          {grouping
            ? rowGroups.map((group, groupIndex) => {
                const headerProps = grouping.headerProps?.(group);
                const drop = grouping.dropTarget?.(group);
                return (
                  <tbody key={group.key} data-row-group={group.key}>
                    {groupIndex > 0 && (
                      <tr className="table-group-spacer" aria-hidden="true">
                        <td colSpan={columns.length} />
                      </tr>
                    )}
                    <tr
                      {...headerProps}
                      className={`table-group-header ${headerProps?.className ?? ""}`}
                    >
                      <th scope="rowgroup" colSpan={columns.length}>
                        {grouping.header(group)}
                      </th>
                    </tr>
                    {drop && (
                      <tr
                        {...drop.rowProps}
                        className={`table-group-drop ${drop.rowProps?.className ?? ""}`}
                      >
                        <td colSpan={columns.length}>{drop.content}</td>
                      </tr>
                    )}
                    {group.visibleRows.map((row) =>
                      renderRow(row, rowIndexes.get(row)!),
                    )}
                  </tbody>
                );
              })
            : null}
          {(!grouping || !rowGroups.length) && (
            <tbody>
              {windowed && firstRow > 0 && (
                <tr aria-hidden="true">
                  <td
                    colSpan={columns.length}
                    style={{
                      height: firstRow * rowHeight,
                      padding: 0,
                      border: 0,
                      fontSize: 0,
                      lineHeight: 0,
                    }}
                  />
                </tr>
              )}
              {visibleRows.map((row, localIndex) =>
                renderRow(row, firstRow + localIndex),
              )}
              {windowed && lastRow < rows.length && (
                <tr aria-hidden="true">
                  <td
                    colSpan={columns.length}
                    style={{
                      height: (rows.length - lastRow) * rowHeight,
                      padding: 0,
                      border: 0,
                      fontSize: 0,
                      lineHeight: 0,
                    }}
                  />
                </tr>
              )}
              {!rows.length && (
                <tr>
                  <td colSpan={columns.length}>
                    {emptyState ?? <EmptyState />}
                  </td>
                </tr>
              )}
            </tbody>
          )}
        </table>
      </div>
      {popup && activeColumn && onColumnFilterChange && (
        <ColumnFilter
          key={activeColumn.id}
          anchor={popup.anchor}
          title={activeColumn.header}
          values={filterOptions[activeColumn.id] || []}
          current={filters[activeColumn.id]}
          onClose={closePopup}
          onApply={(values) => {
            onColumnFilterChange(activeColumn.id, values);
            closePopup();
          }}
        />
      )}
      {popup &&
        activeColumn &&
        onColumnSearchChange &&
        !onColumnFilterChange && (
          <ColumnSearch
            key={activeColumn.id}
            anchor={popup.anchor}
            title={activeColumn.header}
            current={columnSearches[activeColumn.id]}
            values={searchOptions}
            label={activeColumn.searchLabel}
            onClose={closePopup}
            onApply={(value) => {
              onColumnSearchChange(activeColumn.id, value);
              closePopup();
            }}
          />
        )}
    </>
  );
}
export interface RowAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}
export function TableRowActions({
  actions,
  loading = false,
}: {
  actions: readonly RowAction[];
  loading?: boolean;
}) {
  return (
    <div className="row-actions">
      {loading ? (
        <LoaderCircle
          size={17}
          className="spin"
          role="status"
          aria-label="Consultando registro"
        />
      ) : (
        actions.map((action) => (
          <IconButton
            key={action.id}
            label={action.label}
            icon={action.icon}
            disabled={action.disabled}
            tone={action.tone}
            onClick={action.onClick}
          />
        ))
      )}
    </div>
  );
}
