import { useMemo, useState, type ReactNode } from "react";
import { FilterX } from "lucide-react";
import { Button } from "../Button";
import { EmptyState } from "../Feedback";
import { DataTable, type DataTableProps } from "./DataTable";
import { Pagination } from "./Pagination";
import { cellText, distinctValues, filterTableRows } from "./tableFilters";
import { useClientTable } from "./useClientTable";
import { groupTableRows } from "./tableGroups";
import type { ColumnFilters, TableSort } from "./types";
import "./filters.css";

export interface DataGridProps<T> extends Omit<
  DataTableProps<T>,
  | "sorting"
  | "onSortChange"
  | "filters"
  | "filterOptions"
  | "onColumnFilterChange"
  | "columnSearches"
  | "onColumnSearchChange"
  | "groupingRows"
> {
  initialSort?: TableSort;
  initialPageSize?: number;
  resetKey?: string;
  paginate?: boolean;
  itemLabel?: string;
  summary?: (rows: readonly T[]) => ReactNode;
}
/** Adds column filters before local sorting/pagination; preserves DataTable's existing presentation. */
export function DataGrid<T>({
  rows,
  columns,
  initialSort,
  initialPageSize,
  resetKey,
  paginate = true,
  itemLabel,
  summary,
  grouping,
  ...props
}: DataGridProps<T>) {
  const [filters, setFilters] = useState<ColumnFilters>({});
  const filteredRows = useMemo(
    () => filterTableRows(rows, columns, filters),
    [rows, columns, filters],
  );
  const options = useMemo(
    () =>
      Object.fromEntries(
        columns
          .filter((column) => column.filterable !== false)
          .map((column) => [
            column.id,
            distinctValues(rows.map((row) => cellText(column, row))),
          ]),
      ),
    [rows, columns],
  );
  const table = useClientTable(filteredRows, columns, {
    initialSort,
    initialPageSize,
    resetKey: JSON.stringify([resetKey, filters]),
  });
  const active = columns.filter((column) => filters[column.id] !== undefined);
  const groupedRows = useMemo(
    () =>
      grouping
        ? groupTableRows(table.allRows, grouping).flatMap((group) => group.rows)
        : table.allRows,
    [table.allRows, grouping],
  );
  return (
    <>
      {!props.loading && !props.error && summary?.(filteredRows)}
      {active.length > 0 && (
        <div
          className="table-filter-summary"
          aria-label="Filtros de columna activos"
        >
          <span>Filtros de tabla:</span>
          {active.map((column) => (
            <Button
              key={column.id}
              variant="plain"
              className="table-filter-chip"
              title={filters[column.id]
                .map((value) => value || "(Vacías)")
                .join(", ")}
              onClick={() =>
                setFilters((previous) => {
                  const next = { ...previous };
                  delete next[column.id];
                  return next;
                })
              }
            >
              {column.header}:{" "}
              {filters[column.id].length === 1
                ? filters[column.id][0] || "(Vacías)"
                : `${filters[column.id].length} valores`}{" "}
              ×
            </Button>
          ))}
          <Button
            variant="plain"
            className="text-button"
            icon={<FilterX size={12} />}
            onClick={() => setFilters({})}
          >
            Limpiar filtros de tabla
          </Button>
        </div>
      )}
      <DataTable
        {...props}
        rows={
          grouping
            ? paginate
              ? groupedRows.slice(
                  (table.page - 1) * table.pageSize,
                  table.page * table.pageSize,
                )
              : groupedRows
            : paginate
              ? table.rows
              : table.allRows
        }
        grouping={
          grouping && active.length
            ? { ...grouping, showEmpty: false }
            : grouping
        }
        groupingRows={groupedRows}
        columns={columns}
        sorting={table.sorting}
        onSortChange={table.setSort}
        filters={filters}
        filterOptions={options}
        onColumnFilterChange={(id, values) =>
          setFilters((previous) => {
            const next = { ...previous };
            if (values === null) delete next[id];
            else next[id] = values;
            return next;
          })
        }
        emptyState={
          active.length && rows.length ? (
            <EmptyState
              title="Sin coincidencias en la tabla"
              message="Quita los filtros de columna para volver a ver los registros."
              action={
                <Button onClick={() => setFilters({})}>
                  Limpiar filtros de tabla
                </Button>
              }
            />
          ) : (
            props.emptyState
          )
        }
      />
      {paginate && !props.loading && !props.error && (
        <Pagination
          page={table.page}
          pageSize={table.pageSize}
          total={table.total}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          fetching={props.fetching}
          itemLabel={itemLabel}
        />
      )}
    </>
  );
}
