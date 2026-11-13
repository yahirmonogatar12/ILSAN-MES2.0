import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  FilterBar,
  Modal,
} from "@/shared/ui";
import { FormDialog } from "./components";
import { makeColumns } from "./columns";
import { useProcess } from "./useProcess";
import { text } from "./model";
import { assyPayloads } from "./requests";
import { ASSY_DATE_FIELDS, useAssyFilters } from "./useAssyFilters";
import type { AssyToolProps, Row } from "./types";
const specs = [
  ["_code", "WO", 150],
  ["codigo_po", "PO", 130],
  ["modelo", "MODELO", 150],
  ["cantidad_planeada", "CANTIDAD", 90],
  ["fecha_operacion", "FECHA", 95],
  ["estado", "ESTADO", 95],
  ["lot_no_existente", "LOTE EXISTENTE", 180],
] as const;
export function AssyWorkOrders({ initial, onClose, onDone }: AssyToolProps) {
  const context = useProcess();
  const filters = useAssyFilters(initial);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<Row | null>(null);
  const params = {
    desde: filters.applied.start,
    hasta: filters.applied.end,
    include_import_status: 1,
  };
  const query = useQuery({
    queryKey: context.key("assy-tools", "wos", params),
    queryFn: ({ signal }) => context.api.extra("wos", params, signal),
  });
  const data = useMemo(
    () =>
      (query.data ?? []).map((row) => ({
        ...row,
        _code: row.wo_code ?? row.codigo_wo,
      })),
    [query.data],
  );
  const columns = [
    {
      id: "select",
      header: "INCLUIR",
      width: "5%",
      filterable: false,
      cell: (row: Row) => (
        <CheckboxField
          aria-label={`Importar ${text(row._code)}`}
          checked={selected.has(Number(row.id))}
          disabled={!!row.ya_importado || query.isFetching || !Number(row.id)}
          onChange={(event) =>
            setSelected((previous) => {
              const next = new Set(previous);
              if (event.target.checked) next.add(Number(row.id));
              else next.delete(Number(row.id));
              return next;
            })
          }
        />
      ),
    },
    ...makeColumns(specs).map((column) => ({
      ...column,
      width: `${parseFloat(String(column.width)) * 0.95}%`,
    })),
  ];
  return (
    <>
      <Modal
        title="Importar Work Orders · ASSY"
        size="xl"
        className="process-production-dialog"
        onClose={onClose}
      >
        <DialogBody>
          <FilterBar
            fields={ASSY_DATE_FIELDS}
            values={filters.draft}
            defaults={initial}
            pending={query.isFetching}
            onChange={(patch) =>
              filters.setDraft((previous) => ({ ...previous, ...patch }))
            }
            onReset={() => {
              filters.reset();
              setSelected(new Set());
            }}
            onSubmit={() => {
              if (filters.submit(query.refetch)) setSelected(new Set());
            }}
          />
          {filters.error && <Alert tone="danger">{filters.error}</Alert>}
          <DataGrid
            label="Work Orders disponibles"
            rows={data}
            columns={columns}
            rowKey={(row) => row.id}
            loading={query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
            minWidth={1000}
            layout="fixed"
          />
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
          <Button
            variant="primary"
            disabled={!selected.size || query.isFetching || query.isError}
            onClick={() =>
              setConfirm({
                wo_ids: [...selected],
                import_date: filters.applied.end,
              })
            }
          >
            Importar seleccionadas ({selected.size})
          </Button>
        </DialogFooter>
      </Modal>
      {confirm && (
        <FormDialog
          title="Importar WO seleccionadas"
          description={`Se importarán ${selected.size} WO. Los duplicados y errores parciales se mostrarán en el resultado.`}
          initial={confirm}
          fields={[
            {
              key: "import_date",
              label: "Fecha de importación",
              type: "date",
              required: true,
            },
          ]}
          onClose={() => setConfirm(null)}
          onSave={(value) =>
            context.api.extra("import-wos", assyPayloads["import-wos"](value))
          }
          onDone={onDone}
          label="Confirmar"
        />
      )}
    </>
  );
}
