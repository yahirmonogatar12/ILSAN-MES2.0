import { ArrowDown, ArrowUpDown, Filter, LoaderCircle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type ReactNode,
} from "react";
import { Button, IconButton } from "../Button";
import { EmptyState, ErrorState, Loading } from "../Feedback";
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
  function renderRow(row: T, index: number) {
    return (
      <tr
        {...rowProps?.(row, index)}
        key={rowKey(row, index)}
        aria-rowindex={windowed ? index + 2 : undefined}
      >
        {columns.map((column) => {
          const span = column.cellSpan?.(row, index);
          if (span?.rowSpan === 0 || span?.colSpan === 0) return null;
          return (
            <td
              key={column.id}
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
  if (loading) return <Loading text={loadingText} />;
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
          className={`ui-data-table${layout === "fixed" ? " ui-data-table-fixed" : ""}`}
          aria-label={label}
          aria-rowcount={windowed ? rows.length + 1 : undefined}
          style={{ minWidth }}
        >
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sorting?.columnId === column.id;
                return (
                  <th
                    key={column.id}
                    style={{
                      textAlign: column.align,
                      minWidth: column.minWidth,
                      width: column.width,
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
                          <span className="table-column-title">
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
                        <span className="table-column-title">
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
