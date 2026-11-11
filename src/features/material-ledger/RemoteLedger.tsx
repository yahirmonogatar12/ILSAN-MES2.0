import { FilterX } from "lucide-react";
import { Button, DataTable, Pagination, type TableColumn } from "@/shared/ui";
import type { LedgerPage, LedgerRow, Searches } from "./types";
export function RemoteLedger({
  label,
  columns,
  result,
  loading,
  fetching,
  error,
  onRetry,
  searches,
  onSearchChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  minWidth,
}: {
  label: string;
  columns: TableColumn<LedgerRow>[];
  result?: LedgerPage;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  onRetry: () => void;
  searches: Searches;
  onSearchChange: (next: Searches) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  minWidth: number;
}) {
  const active = columns.filter((column) => searches[column.id]);
  return (
    <>
      {active.length > 0 && (
        <div
          className="table-filter-summary"
          aria-label="Filtros de columna activos"
        >
          {active.map((column) => (
            <Button
              variant="plain"
              className="table-filter-chip"
              key={column.id}
              title={searches[column.id]}
              onClick={() => {
                const next = { ...searches };
                delete next[column.id];
                onSearchChange(next);
              }}
            >
              {column.header}: {searches[column.id]} ×
            </Button>
          ))}
          <Button
            variant="plain"
            className="text-button"
            icon={<FilterX size={13} />}
            onClick={() => onSearchChange({})}
          >
            Quitar filtros de columnas
          </Button>
        </div>
      )}
      <DataTable
        label={label}
        rows={result?.data || []}
        columns={columns}
        rowKey={(row, index) =>
          `${row.codigo_material_recibido || row.warehousing_code || row.numero_parte}:${(result?.offset || 0) + index}`
        }
        layout="fixed"
        minWidth={minWidth}
        loading={loading}
        fetching={fetching}
        error={error}
        onRetry={onRetry}
        columnSearches={searches}
        onColumnSearchChange={(id, value) => {
          const next = { ...searches };
          if (value) next[id] = value;
          else delete next[id];
          onSearchChange(next);
        }}
      />
      {!loading && !error && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={result?.total || 0}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          fetching={fetching}
          disabled={fetching}
        />
      )}
    </>
  );
}
