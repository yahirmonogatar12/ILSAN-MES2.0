import { useForm } from "@/shared/hooks/useForm";
import {
  DialogBody,
  FormActions,
  FormMessages,
  Modal,
  TextField,
} from "@/shared/ui";
import { lineDraft, lineIssues } from "./model";
import type { DataRow, InvoiceApi, InvoiceScope, LineDraft } from "./types";
export function LineForm({
  row,
  id,
  scope,
  api,
  onClose,
  onSaved,
}: {
  row: DataRow;
  id: number;
  scope: InvoiceScope;
  api: InvoiceApi;
  onClose: () => void;
  onSaved: (result: DataRow) => void;
}) {
  const form = useForm({
    initialValues: lineDraft(row),
    validate: lineIssues,
    onSubmit: async (draft) =>
      onSaved(await api.updateLine(scope, id, Number(row.id), draft)),
  });
  const fields: [keyof LineDraft, string, string?][] = [
    ["line_no", "Número de línea", "number"],
    ["raw_part_num", "Parte raw"],
    ["numero_parte_sistema", "Parte sistema"],
    ["descripcion", "Descripción"],
    ["cantidad", "Cantidad", "number"],
    ["uom", "Unidad"],
    ["costo_unitario", "Costo unitario", "number"],
    ["costo_total", "Costo total", "number"],
  ];
  return (
    <Modal
      title="Editar línea de invoice"
      size="lg"
      busy={form.pending}
      onClose={onClose}
      className="invoicing-form"
    >
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          <div className="invoicing-fields">
            {fields.map(([key, label, type]) => (
              <TextField
                key={key}
                label={label}
                type={type || "text"}
                step={key === "line_no" ? "1" : "0.0001"}
                min={type === "number" ? "0" : undefined}
                maxLength={key === "descripcion" ? 1024 : 512}
                value={form.values[key]}
                disabled={form.pending}
                onChange={(event) => form.setField(key, event.target.value)}
              />
            ))}
          </div>
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <FormActions
          pending={form.pending}
          onCancel={onClose}
          submitLabel="Guardar línea"
        />
      </form>
    </Modal>
  );
}
