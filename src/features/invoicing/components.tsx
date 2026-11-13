import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  ExportButton as SharedExportButton,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  TextareaField,
} from "@/shared/ui";
import { exportRows, type ExportSheet } from "./exportRows";
import { amount, object, text } from "./model";
import type { ColumnSpec } from "./columns";
import type { DataRow } from "./types";

export function ExportButton({
  name,
  specs,
  rows,
  extraSheets,
}: {
  name: string;
  specs: readonly ColumnSpec[];
  rows: readonly DataRow[];
  extraSheets?: readonly ExportSheet[];
}) {
  const download = useMutation({
    mutationFn: () => exportRows(name, specs, rows, extraSheets),
  });
  return (
    <>
      <SharedExportButton
        size="sm"
        icon={<Download size={15} />}
        loading={download.isPending}
        disabled={!rows.length}
        onClick={() => download.mutate()}
        title="Exporta todas las filas de la consulta cargada, independientemente de la página o los filtros locales de columna."
      >
        Exportar Excel
      </SharedExportButton>
      {download.error && <Alert tone="danger">{download.error.message}</Alert>}
    </>
  );
}
export function ActionDialog({
  title,
  message,
  submitLabel = "Confirmar",
  onConfirm,
  onClose,
  onDone,
  comment = false,
}: {
  title: string;
  message: string;
  submitLabel?: string;
  comment?: boolean;
  onConfirm: (comment: string) => Promise<DataRow>;
  onClose: () => void;
  onDone: (result: DataRow) => void;
}) {
  const form = useForm({
    initialValues: { comment: "" },
    validate: () => [],
    onSubmit: async (values) => onDone(await onConfirm(values.comment)),
  });
  return (
    <Modal title={title} onClose={onClose} busy={form.pending}>
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          <p>{message}</p>
          {comment && (
            <TextareaField
              label="Comentario"
              maxLength={500}
              value={form.values.comment}
              disabled={form.pending}
              onChange={(event) => form.setField("comment", event.target.value)}
            />
          )}
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <DialogFooter>
          <Button disabled={form.pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={form.pending}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
const labels: Record<string, string> = {
  estado: "Estado",
  aplicados: "Aplicados",
  omitidos: "Omitidos",
  links_desaplicados: "Lotes desaplicados",
  links_reaplicados: "Lotes reaplicados",
  total_lineas: "Líneas",
  total_transacciones: "Transacciones",
  total_packing: "Packing",
  total_monto: "Monto",
  lineas_nuevas: "Líneas nuevas",
  lineas_existentes: "Líneas existentes",
  partes_sin_sistema: "Partes sin sistema",
  procesados_lotes: "Lotes procesados",
  asignados_control_material: "Costos asignados",
  quedaron_sin_costo: "Sin costo histórico",
  no_sobrescritos_invoice: "Invoice conservados",
  pendientes_aplicables: "Pendientes aplicables",
  agregadas: "Agregadas",
  modificadas: "Modificadas",
  borradas: "Borradas",
  renombradas: "Renombradas",
  bloqueadas: "Con lotes, conservadas",
  protegidas: "Histórico conservado",
};
export function ResultNotice({ result }: { result: DataRow | null }) {
  if (!result) return null;
  const skipped = Array.isArray(result.skipped)
    ? result.skipped
    : Array.isArray(result.omitidos)
      ? result.omitidos
      : [];
  const parts = Object.entries(labels).flatMap(([key, label]) =>
    result[key] != null && !Array.isArray(result[key])
      ? [`${label}: ${text(result[key])}`]
      : [],
  );
  if (object(result.unapply))
    parts.push(
      `Lotes desaplicados: ${amount(result.unapply.links_desaplicados)}`,
    );
  return (
    <Alert tone={skipped.length ? "warning" : "info"}>
      {text(result.message || result.mensaje) ||
        parts.join(" · ") ||
        "Operación completada."}
      {!!skipped.length && (
        <details>
          <summary>{skipped.length} resultado(s) omitidos</summary>
          {skipped.map((item, index) => (
            <p key={index}>
              {object(item)
                ? `${text(item.codigo_material_recibido)}: ${text(item.error || item.mensaje)}`
                : text(item)}
            </p>
          ))}
        </details>
      )}
    </Alert>
  );
}
