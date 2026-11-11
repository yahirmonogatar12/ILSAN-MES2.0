import { useMemo } from "react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
} from "@/shared/ui";
import { VALUATION, makeColumns } from "./columns";
import { amount, rows } from "./model";
import type { DataRow, ValuationApi } from "./types";
export function BackfillDialog({
  preview,
  api,
  onClose,
  onSaved,
}: {
  preview: DataRow;
  api: ValuationApi;
  onClose: () => void;
  onSaved: (result: DataRow) => void;
}) {
  const records = useMemo(() => rows(preview.preview_records), [preview]);
  const columns = useMemo(
    () =>
      makeColumns(
        VALUATION.filter((spec) =>
          [
            "codigo_material_recibido",
            "numero_parte_sistema",
            "numero_lote",
            "pallet_no",
            "vendedor",
            "stock_actual",
            "unidad_medida",
            "costo_unitario",
            "moneda",
            "valor_total",
          ].includes(spec[0]),
        ),
      ),
    [],
  );
  const form = useForm({
    initialValues: {},
    validate: () =>
      amount(preview.preview_total) > 0 ? [] : ["No hay costos por aplicar."],
    onSubmit: async () => onSaved(await api.backfill(false)),
  });
  return (
    <Modal
      title="Aplicar costos históricos"
      subtitle="Revisión de la simulación"
      size="xl"
      busy={form.pending}
      onClose={onClose}
      className="invoicing-dialog"
    >
      <form className="invoicing-dialog-form" onSubmit={form.handleSubmit}>
        <DialogBody>
          <Alert tone="warning">
            Esta operación revisa el inventario con stock de toda la base,
            independientemente de los filtros de la tabla. Aplica un bloque de
            hasta 500 lotes; conserva los costos protegidos por el servidor.
          </Alert>
          <p>
            Inventario con stock: {amount(preview.total_lotes)} · Costos
            aplicables: {amount(preview.preview_total)} · Ya con costo:{" "}
            {amount(preview.ya_tenian_costo)} · Sin costo histórico:{" "}
            {amount(preview.quedaron_sin_costo)} · Invoice conservados:{" "}
            {amount(preview.no_sobrescritos_invoice)}
          </p>
          {preview.preview_truncated === true && (
            <Alert tone="info">
              Se muestran {records.length} de {amount(preview.preview_total)}{" "}
              cambios posibles. La simulación muestra hasta 5,000 lotes.
            </Alert>
          )}
          <DataGrid
            label="Costos históricos previstos"
            rows={records}
            columns={columns}
            rowKey={(row) => String(row.codigo_material_recibido)}
            layout="fixed"
            minWidth={1100}
          />
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <DialogFooter>
          <Button disabled={form.pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={form.pending}
            disabled={amount(preview.preview_total) <= 0}
          >
            Aplicar bloque de 500
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
