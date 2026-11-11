import { useEffect, useMemo, useRef, useState } from "react";
import type { SortValue, TableColumn, TableSort } from "./types";
import { DEFAULT_PAGE_SIZE } from "./tableConfig";

function compare(a: SortValue, b: SortValue): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), "es", { numeric: true });
}
export function sortRows<T>(
  rows: readonly T[],
  columns: readonly TableColumn<T>[],
  sorting: TableSort | null,
): T[] {
  const column = columns.find((c) => c.id === sorting?.columnId);
  if (!sorting || !column?.sortValue) return [...rows];
  const value = column.sortValue;
  return [...rows].sort(
    (a, b) =>
      compare(value(a), value(b)) * (sorting.direction === "desc" ? -1 : 1),
  );
}
/** Client-side controller only. For server pagination use DataTable + Pagination directly. */
export function useClientTable<T>(
  rows: readonly T[],
  columns: readonly TableColumn<T>[],
  options: {
    initialSort?: TableSort;
    initialPageSize?: number;
    resetKey?: string;
  } = {},
) {
  const [sorting, setSorting] = useState<TableSort | null>(
    options.initialSort || null,
  );
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, updatePageSize] = useState(
    options.initialPageSize || DEFAULT_PAGE_SIZE,
  );
  const previousResetKey = useRef(options.resetKey);
  useEffect(() => {
    // Activity reconnects effects when a workspace tab becomes visible again.
    // Reset only for different criteria, not when resuming the same table.
    if (previousResetKey.current !== options.resetKey) {
      previousResetKey.current = options.resetKey;
      setRequestedPage(1);
    }
  }, [options.resetKey]);
  const sorted = useMemo(
    () => sortRows(rows, columns, sorting),
    [rows, columns, sorting],
  );
  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(sorted.length / pageSize)),
  );
  const visibleRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  function setSort(sort: TableSort) {
    setSorting(sort);
    setRequestedPage(1);
  }
  function setPageSize(size: number) {
    if (size < 1) return;
    updatePageSize(size);
    setRequestedPage(1);
  }
  return {
    allRows: sorted,
    rows: visibleRows,
    total: sorted.length,
    sorting,
    setSort,
    page,
    setPage: setRequestedPage,
    pageSize,
    setPageSize,
  };
}
