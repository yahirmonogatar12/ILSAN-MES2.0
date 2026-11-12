import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  FilterBar,
  Modal,
} from "@/shared/ui";
import { FormDialog, makeColumns, useProcess } from "./components";
import { text } from "./model";
import { assyPayloads } from "./requests";
import { ASSY_DATE_FIELDS, useAssyFilters } from "./useAssyFilters";
import type { AssyToolProps, Field, Row, ScanLot } from "./types";
type ScanDialog = {
  action: "assign-scan" | "create-scan";
  title: string;
  description: string;
  initial: Row;
  fields: Field[];
};
const specs = [
  ["linea", "LÍNEA", 70],
  ["nparte", "PARTE", 140],
  ["modelo", "MODELO", 130],
  ["lotes_scan", "LOTES SCAN", 70],
  ["registros", "REGISTROS", 80],
  ["cantidad_total", "CANTIDAD", 85],
  ["primero", "PRIMERO", 135],
  ["ultimo", "ÚLTIMO", 135],
] as const;
export function AssyScanLots({ initial, onClose, onDone }: AssyToolProps) {
  const context = useProcess();
  const filters = useAssyFilters(initial);
  const [dialog, setDialog] = useState<ScanDialog | null>(null);
  const params = {
    date_from: filters.applied.start,
    date_to: filters.applied.end,
    line: filters.applied.line,
    part_no: filters.applied.part_number,
    limit: 500,
  };
  const query = useQuery({
    queryKey: context.key("assy-tools", "scan", params),
    queryFn: ({ signal }) => context.api.extra("scan", params, signal),
  });
  function assign(row: ScanLot) {
    const eligible = (query.data?.plan_options ?? []).filter(
      (plan) =>
        plan.line === row.linea &&
        plan.part_no === row.nparte &&
        plan.status !== "CANCELADO" &&
        Number(plan.plan_count) > Number(plan.produced_count ?? 0),
    );
    setDialog({
      title: `Asignar SCAN · ${row.nparte}`,
      action: "assign-scan",
      initial: {
        ...params,
        linea: row.linea,
        nparte: row.nparte,
        target_lot_no: eligible[0]?.lot_no ?? "",
        allow_extend: false,
      },
      fields: [
        {
          key: "target_lot_no",
          label: "Plan destino",
          type: "select",
          required: true,
          options: eligible.map((plan) => ({
            value: plan.lot_no,
            label: `${plan.lot_no} · pendiente ${Number(plan.plan_count) - Number(plan.produced_count ?? 0)}`,
          })),
        },
        {
          key: "allow_extend",
          label: "Extender el plan si la cantidad SCAN supera el pendiente",
          type: "checkbox",
        },
      ],
      description: `Se asignarán ${text(row.cantidad_total)} piezas al plan seleccionado. La extensión requiere activar la casilla.`,
    });
  }
  function create(row: ScanLot) {
    setDialog({
      title: `Crear plan desde SCAN · ${row.nparte}`,
      action: "create-scan",
      initial: {
        ...params,
        linea: row.linea,
        nparte: row.nparte,
        working_date: filters.applied.end,
      },
      fields: [
        {
          key: "working_date",
          label: "Fecha de operación",
          type: "date",
          required: true,
        },
      ],
      description: `Se creará un plan y se asignarán ${text(row.cantidad_total)} piezas de los escaneos del período.`,
    });
  }
  const columns = [
    ...makeColumns(specs).map((column) => ({
      ...column,
      width: `${parseFloat(String(column.width)) * 0.75}%`,
    })),
    {
      id: "actions",
      header: "ACCIONES",
      width: "25%",
      filterable: false,
      cell: (row: ScanLot) => (
        <div className="process-production-row-actions">
          <Button
            size="sm"
            disabled={query.isFetching}
            onClick={() => assign(row)}
          >
            Asignar a plan
          </Button>
          <Button
            size="sm"
            disabled={query.isFetching}
            onClick={() => create(row)}
          >
            Crear plan
          </Button>
        </div>
      ),
    },
  ];
  return (
    <>
      <Modal
        title="Lotes SCAN sin asignar"
        size="xl"
        className="process-production-dialog"
        onClose={onClose}
      >
        <DialogBody>
          <FilterBar
            fields={[
              ...ASSY_DATE_FIELDS,
              { key: "line", label: "Línea", type: "search" },
              { key: "part_number", label: "Número de parte", type: "search" },
            ]}
            values={filters.draft}
            defaults={initial}
            pending={query.isFetching}
            onChange={(patch) =>
              filters.setDraft((previous) => ({ ...previous, ...patch }))
            }
            onReset={filters.reset}
            onSubmit={() => filters.submit(query.refetch)}
          />
          {filters.error && <Alert tone="danger">{filters.error}</Alert>}
          <DataGrid
            label="Grupos SCAN"
            rows={query.data?.scan_lots ?? []}
            columns={columns}
            rowKey={(row) => `${row.linea}:${row.nparte}`}
            loading={query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
            minWidth={1000}
            layout="fixed"
          />
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </Modal>
      {dialog && (
        <FormDialog
          title={dialog.title}
          description={dialog.description}
          fields={dialog.fields}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSave={(value) =>
            context.api.extra(dialog.action, assyPayloads[dialog.action](value))
          }
          onDone={onDone}
          label="Confirmar"
        />
      )}
    </>
  );
}
