import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  Card,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  ExportButton,
  Modal,
} from "@/shared/ui";
import { columnsFor } from "./ResultsTable";
import { comparisonRows, compareFields, testDetail } from "./machineViews";
import { text } from "./model";
import { useResults } from "./useResults";
import type { Row } from "./types";

export function MachineComparison({
  records,
  onClose,
}: {
  records: readonly Row[];
  onClose: () => void;
}) {
  const context = useResults();
  const [onlyDiffs, setOnlyDiffs] = useState(true);
  const query = useQuery({
    queryKey: context.key(
      "comparison",
      records.map((row) => [row.barcode, row.ts]),
    ),
    queryFn: async ({ signal }) =>
      Promise.all(
        records.map(async (record) => {
          const spec = testDetail("ict", record);
          const data = await context.api.report(spec, {}, {}, 1, 500, signal);
          return { record, parameters: data.rows };
        }),
      ),
  });
  const compared = useMemo(
    () => comparisonRows(query.data ?? [], onlyDiffs),
    [query.data, onlyDiffs],
  );
  const columns = useMemo(
    () =>
      columnsFor([
        { key: "componente", title: "Componente", width: 115 },
        { key: "pinref", title: "Pinref", width: 85 },
        { key: "execution", title: "Ejecución", width: 230 },
        ...compareFields,
      ]).map((column) => ({
        ...column,
        cell: (row: Row) => (
          <span
            className={
              Array.isArray(row.changedFields) &&
              row.changedFields.includes(column.id)
                ? "production-results-comparison-change"
                : undefined
            }
          >
            {column.cell(row)}
          </span>
        ),
      })),
    [],
  );
  const download = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () => context.api.exportComparison(records, onlyDiffs),
  });
  return (
    <Modal
      title="Comparación de parámetros ICT"
      size="xl"
      busy={download.pending}
      onClose={onClose}
      className="production-results-dialog"
    >
      <DialogBody>
        <Card
          fill
          title={"Ejecuciones seleccionadas · " + records.length}
          actions={
            <CheckboxField
              label="Solo diferencias"
              checked={onlyDiffs}
              onChange={(event) => setOnlyDiffs(event.target.checked)}
            />
          }
        >
          {download.error && (
            <Alert tone="danger">{download.error.message}</Alert>
          )}
          <DataGrid
            label="Comparación de parámetros ICT"
            rows={compared}
            columns={columns}
            rowKey={(row, index) => text(row.execution) + ":" + index}
            minWidth={1570}
            layout="fixed"
            className="production-results-table"
            virtualRows={{ rowHeight: 32 }}
            resetKey={String(onlyDiffs)}
            loading={query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
            rowProps={(row) => ({
              className: row.different
                ? "production-results-difference"
                : undefined,
            })}
          />
        </Card>
      </DialogBody>
      <DialogFooter>
        <ExportButton
          loading={download.pending}
          disabled={!query.isSuccess}
          onClick={() => void download.submit()}
        />
        <Button disabled={download.pending} onClick={onClose}>
          Cerrar
        </Button>
      </DialogFooter>
    </Modal>
  );
}
