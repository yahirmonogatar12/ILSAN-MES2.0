import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircle,
} from "lucide-react";
import { IconButton } from "../Button";
import { SelectField } from "../Fields";
import { PAGE_SIZE_OPTIONS } from "./tableConfig";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
  pageSizeOptions?: readonly number[];
  fetching?: boolean;
  disabled?: boolean;
}
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  itemLabel = "registros",
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  fetching,
  disabled,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pages);
  const format = (value: number) => value.toLocaleString("es-MX");
  return (
    <div className="table-footer">
      <div className="results-count">
        {total ? (
          <>
            Mostrando{" "}
            <strong>
              {format((current - 1) * pageSize + 1)}–
              {format(Math.min(current * pageSize, total))}
            </strong>{" "}
            de <strong>{format(total)}</strong> {itemLabel}
          </>
        ) : (
          `0 ${itemLabel}`
        )}
        {fetching && <LoaderCircle size={13} className="spin" />}
      </div>
      <div className="pagination">
        <SelectField
          label="Filas"
          aria-label="Filas por página"
          containerClassName="pagination-size"
          value={String(pageSize)}
          disabled={disabled}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          options={[...new Set([...pageSizeOptions, pageSize])].map((size) => ({
            value: String(size),
            label: String(size),
          }))}
        />
        <nav className="page-buttons" aria-label="Paginación">
          <IconButton
            label="Primera página"
            icon={<ChevronsLeft size={15} />}
            disabled={disabled || current === 1}
            onClick={() => onPageChange(1)}
          />
          <IconButton
            label="Página anterior"
            icon={<ChevronLeft size={16} />}
            disabled={disabled || current === 1}
            onClick={() => onPageChange(current - 1)}
          />
          <span className="page-number" aria-current="page">
            {current}
          </span>
          <span className="page-of">de {pages}</span>
          <IconButton
            label="Página siguiente"
            icon={<ChevronRight size={16} />}
            disabled={disabled || current === pages}
            onClick={() => onPageChange(current + 1)}
          />
          <IconButton
            label="Última página"
            icon={<ChevronsRight size={15} />}
            disabled={disabled || current === pages}
            onClick={() => onPageChange(pages)}
          />
        </nav>
      </div>
    </div>
  );
}
