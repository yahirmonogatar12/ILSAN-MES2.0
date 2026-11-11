import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
export type SortValue = string | number | Date | null | undefined;
export interface TableSort {
  columnId: string;
  direction: "asc" | "desc";
}
/** A column describes presentation; it does not know an API or a business model. */
export interface TableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Controlled grouped rows: span 0 omits a cell covered by a previous row/column. */
  cellSpan?: (row: T, index: number) => { rowSpan?: number; colSpan?: number };
  /** Plain text used by column filters when a custom cell component is rendered. */
  textValue?: (row: T) => string;
  /** Server criterion represented by a displayed suggestion, e.g. duration in seconds. */
  searchValue?: (row: T) => string;
  /** Label for the server criterion; defaults to Contiene. */
  searchLabel?: string;
  sortValue?: (row: T) => SortValue;
  filterable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
  /** Column share in fixed layout, e.g. "20%"; pixels are also supported. */
  width?: CSSProperties["width"];
  minWidth?: number;
}

export type ColumnFilters = Readonly<Record<string, readonly string[]>>;

export interface TableGroupContext<T> {
  key: string;
  /** All filtered records in the group, including other pages. */
  rows: readonly T[];
  visibleRows: readonly T[];
}
type GroupRowProps = Omit<HTMLAttributes<HTMLTableRowElement>, "children">;
/** Visual sections inside the same table/scroll area. Group rows are not records. */
export interface TableGrouping<T> {
  key: (row: T) => string;
  order?: readonly string[];
  showEmpty?: boolean;
  header: (group: TableGroupContext<T>) => ReactNode;
  headerProps?: (group: TableGroupContext<T>) => GroupRowProps;
  dropTarget?: (group: TableGroupContext<T>) =>
    | {
        content: ReactNode;
        rowProps?: GroupRowProps;
      }
    | undefined;
}
