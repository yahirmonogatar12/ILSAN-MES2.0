import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye } from "lucide-react";
import {
  Alert,
  Button,
  ExportButton,
  DataTable,
  DEFAULT_PAGE_SIZE,
  DialogBody,
  DialogFooter,
  FilterBar,
  Modal,
  Pagination,
  TableRowActions,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { ECO_FILTERS } from "./config";
import { EcoDetailDialog } from "./EcoDetail";
import type { BomApi, EcoFilters, EcoRow } from "./types";
const fields: FilterField<EcoFilters>[] = [
  { key: "eco_no", label: "ECO / ECN", type: "search" },
  { key: "part_no", label: "Modelo", type: "text" },
  {
    key: "status",
    label: "Estado",
    type: "select",
    options: [
      { value: "", label: "Todos" },
      ...["DRAFT", "APPROVED", "CANCELLED"].map((value) => ({
        value,
        label: value,
      })),
    ],
  },
  {
    key: "origen",
    label: "Origen",
    type: "select",
    options: [
      { value: "", label: "Todos" },
      { value: "MES", label: "MES" },
      { value: "KS", label: "KS" },
    ],
  },
  { key: "date_from", label: "Fecha desde", type: "date" },
  { key: "date_to", label: "Fecha hasta", type: "date" },
];
export function EcoHistory({
  api,
  scope,
  demo,
  canCreate,
  canApprove,
  onClose,
  onChanged,
}: {
  api: BomApi;
  scope: string;
  demo: boolean;
  canCreate: boolean;
  canApprove: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [filters, setFilters] = useState({ ...ECO_FILTERS });
  const [applied, setApplied] = useState({ ...ECO_FILTERS });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<EcoRow | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["bom", scope, "ecos", applied, page, pageSize],
    queryFn: ({ signal }) => api.history(applied, page, pageSize, signal),
  });
  const exportFile = useMutation({
    mutationFn: () => api.exportHistory(applied),
  });
  useEffect(() => {
    if (query.data?.meta.filters_active && !query.isFetching) {
      const last = Math.max(1, Math.ceil(query.data.meta.total / pageSize));
      if (page > last) setPage(last);
    }
  }, [query.data, query.isFetching, page, pageSize]);
  const columns = useMemo<TableColumn<EcoRow>[]>(
    () => [
      {
        id: "number",
        header: "ECO / ECN",
        width: "16%",
        cell: (row) => row.eco_no,
      },
      {
        id: "origin",
        header: "ORIGEN",
        width: "6%",
        cell: (row) => row.origen,
      },
      {
        id: "part",
        header: "MODELO / FAMILIA",
        width: "23%",
        cell: (row) => row.scope_parts || row.part_no,
      },
      {
        id: "revision",
        header: "REVISIÓN",
        width: "7%",
        cell: (row) => row.bom_revision,
      },
      {
        id: "date",
        header: "FECHA EFECTIVA",
        width: "15%",
        cell: (row) => row.effective_at,
      },
      {
        id: "status",
        header: "ESTADO",
        width: "10%",
        cell: (row) => row.status,
      },
      {
        id: "approver",
        header: "APROBADO POR",
        width: "11%",
        cell: (row) => row.approved_by || "—",
      },
      {
        id: "actions",
        header: "ACCIONES",
        width: "12%",
        filterable: false,
        cell: (row) => (
          <TableRowActions
            actions={[
              {
                id: "view",
                label: `Ver ${row.eco_no}`,
                icon: <Eye size={16} />,
                onClick: () => setDetail(row),
              },
            ]}
          />
        ),
      },
    ],
    [],
  );
  return (
    <Modal
      title="Historial de ECO / ECN"
      size="xl"
      className="bom-history"
      onClose={onClose}
    >
      <DialogBody>
        <FilterBar
          actions={
            <ExportButton
              icon={<Download size={15} />}
              disabled={!query.data || query.isError}
              loading={exportFile.isPending}
              onClick={() => exportFile.mutate()}
            >
              {demo ? "Exportar ejemplo" : "Exportar Excel"}
            </ExportButton>
          }
          fields={fields}
          values={filters}
          defaults={ECO_FILTERS}
          onChange={(patch) =>
            setFilters((previous) => ({ ...previous, ...patch }))
          }
          onSubmit={() => {
            if (
              filters.date_from &&
              filters.date_to &&
              filters.date_from > filters.date_to
            ) {
              setError("La fecha inicial no puede ser posterior a la final.");
              return;
            }
            setError("");
            void client.invalidateQueries({
              queryKey: ["bom", scope, "ecos"],
              refetchType: "none",
            });
            if (
              page === 1 &&
              JSON.stringify(filters) === JSON.stringify(applied)
            )
              void query.refetch();
            setApplied({ ...filters });
            setPage(1);
          }}
          onReset={() => {
            void client.invalidateQueries({
              queryKey: ["bom", scope, "ecos"],
              refetchType: "none",
            });
            if (
              page === 1 &&
              JSON.stringify(applied) === JSON.stringify(ECO_FILTERS)
            )
              void query.refetch();
            setFilters({ ...ECO_FILTERS });
            setApplied({ ...ECO_FILTERS });
            setPage(1);
            setError("");
          }}
          pending={query.isFetching}
        />
        {(error || exportFile.error) && (
          <Alert tone="danger">{error || exportFile.error?.message}</Alert>
        )}
        {query.data && !query.data.meta.filters_active && (
          <Alert tone="info">
            Se muestran los últimos {query.data.data.length} cambios de{" "}
            {query.data.meta.total}. Aplica filtros para consultar el historial
            completo por páginas.
          </Alert>
        )}
        <DataTable
          label="Historial de ECO y ECN"
          rows={query.data?.data || []}
          columns={columns}
          rowKey={(row) => `${row.origen}:${row.id}`}
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          layout="fixed"
          minWidth={900}
        />
        {query.data?.meta.filters_active && !query.isError && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={query.data.meta.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            itemLabel="cambios"
            fetching={query.isFetching}
          />
        )}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
      {detail && (
        <EcoDetailDialog
          key={detail.id}
          row={detail}
          api={api}
          scope={scope}
          canCreate={canCreate}
          canApprove={canApprove}
          onClose={() => setDetail(null)}
          onChanged={onChanged}
        />
      )}
    </Modal>
  );
}
