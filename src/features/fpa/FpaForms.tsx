import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import {
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  ErrorState,
  FormActions,
  FormMessages,
  FormSection,
  KeyValueGrid,
  Loading,
  Modal,
  TextField,
  TextareaField,
  type TableColumn,
} from "@/shared/ui";
import {
  adjustmentPayload,
  quantityValid,
  requestPayload,
  validateRequest,
} from "./model";
import type {
  Attempt,
  FpaApi,
  FpaDetail,
  FpaEvent,
  FpaItem,
  RequestDraft,
} from "./types";

export function NewRequest({
  api,
  onClose,
  onSaved,
}: {
  api: FpaApi;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const submission = useRef({ signature: "", key: "" });
  const form = useForm<RequestDraft>({
    initialValues: {
      fpaPartNumber: "",
      pgmMicom: "",
      micomQuantity: "0",
      pgmComp: "",
      compQuantity: "0",
    },
    validate: validateRequest,
    onSubmit: async (values) => {
      const payload = requestPayload(values);
      const signature = JSON.stringify(payload);
      if (submission.current.signature !== signature)
        submission.current = { signature, key: crypto.randomUUID() };
      const record = await api.create(payload, submission.current.key);
      onSaved(`Solicitud ${record.folio} creada.`);
    },
  });
  return (
    <Modal
      title="Nueva solicitud FPA"
      className="fpa-form"
      size="lg"
      busy={form.pending}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            <div className="fpa-fields">
              <TextField
                label="Número de parte FPA"
                required
                maxLength={80}
                initialFocus
                value={form.values.fpaPartNumber}
                onChange={(event) =>
                  form.setField("fpaPartNumber", event.target.value)
                }
              />
              <div className="form-grid">
                <TextField
                  label="PGM MAIN / MICOM"
                  hint="Número de parte y lote/checksum separados por espacio."
                  value={form.values.pgmMicom}
                  onChange={(event) =>
                    form.setField("pgmMicom", event.target.value)
                  }
                />
                <TextField
                  label="Cantidad MICOM"
                  type="number"
                  min={0}
                  max={999}
                  step={1}
                  value={form.values.micomQuantity}
                  onChange={(event) =>
                    form.setField("micomQuantity", event.target.value)
                  }
                />
                <TextField
                  label="PGM COMP"
                  hint="Número de parte y lote/checksum separados por espacio."
                  value={form.values.pgmComp}
                  onChange={(event) =>
                    form.setField("pgmComp", event.target.value)
                  }
                />
                <TextField
                  label="Cantidad COMP"
                  type="number"
                  min={0}
                  max={999}
                  step={1}
                  value={form.values.compQuantity}
                  onChange={(event) =>
                    form.setField("compQuantity", event.target.value)
                  }
                />
              </div>
            </div>
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <FormActions
            pending={form.pending}
            onCancel={onClose}
            submitLabel="Crear solicitud"
          />
        </fieldset>
      </form>
    </Modal>
  );
}
const itemColumns: TableColumn<FpaItem>[] = [
  { id: "type", header: "TIPO", cell: (row) => row.labelType },
  { id: "code", header: "CÓDIGO", cell: (row) => row.code },
  ...(["requested", "consumed", "confirmed", "remaining"] as const).map(
    (key, index) => ({
      id: key,
      header: ["SOLICITADAS", "CONSUMIDAS", "CONFIRMADAS", "RESTANTES"][index],
      cell: (row: FpaItem) => row[key],
    }),
  ),
];
const attemptColumns: TableColumn<Attempt>[] = [
  { id: "date", header: "FECHA", cell: (row) => row.createdAt },
  { id: "type", header: "TIPO", cell: (row) => row.labelType },
  { id: "qty", header: "CANTIDAD", cell: (row) => row.quantity },
  { id: "operator", header: "OPERADOR", cell: (row) => row.operator },
  { id: "station", header: "ESTACIÓN", cell: (row) => row.stationId },
  { id: "status", header: "RESULTADO", cell: (row) => row.status },
  { id: "error", header: "ERROR", cell: (row) => row.error || "—" },
];
const eventColumns: TableColumn<FpaEvent>[] = [
  { id: "date", header: "FECHA", cell: (row) => row.createdAt },
  { id: "type", header: "EVENTO", cell: (row) => row.type },
  { id: "actor", header: "ACTOR", cell: (row) => row.actor },
  { id: "reason", header: "MOTIVO", cell: (row) => row.reason || "—" },
];
interface DetailProps {
  id: number;
  api: FpaApi;
  scope: string;
  canAdjust: boolean;
  focusAdjust: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}
export function FpaDetailDialog(props: DetailProps) {
  const query = useQuery({
    queryKey: ["fpa", props.scope, "detail", props.id],
    queryFn: ({ signal }) => props.api.detail(props.id, signal),
    staleTime: 0,
  });
  if (!query.data || query.isError || query.isFetching)
    return (
      <Modal title="Detalle FPA" size="lg" onClose={props.onClose}>
        <DialogBody>
          {query.error ? (
            <ErrorState
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          ) : (
            <Loading text="Cargando solicitud…" />
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={props.onClose}>Cerrar</Button>
        </DialogFooter>
      </Modal>
    );
  return <DetailContent {...props} record={query.data} />;
}
function DetailContent({
  record,
  api,
  canAdjust,
  focusAdjust,
  onClose,
  onSaved,
}: DetailProps & { record: FpaDetail }) {
  const form = useForm({
    initialValues: {
      MICOM: String(
        record.items.find((item) => item.labelType === "MICOM")?.requested ?? 0,
      ),
      COMP: String(
        record.items.find((item) => item.labelType === "COMP")?.requested ?? 0,
      ),
      reason: "",
    },
    validate: (values) => {
      const errors = values.reason.trim()
        ? []
        : ["El motivo del ajuste es obligatorio."];
      record.items.forEach((item) => {
        if (!quantityValid(values[item.labelType]))
          errors.push(
            `Cantidad ${item.labelType}: debe ser un entero entre 0 y 999.`,
          );
        else if (Number(values[item.labelType]) < item.consumed)
          errors.push(
            `La cantidad ${item.labelType} no puede ser menor a ${item.consumed} etiquetas consumidas.`,
          );
      });
      return errors;
    },
    onSubmit: async (values) => {
      if (!canAdjust)
        throw new Error("No tienes permiso para ajustar cantidades.");
      await api.adjust(record.id, adjustmentPayload(values, record));
      onSaved("Cantidades FPA actualizadas.");
    },
  });
  return (
    <Modal
      title={`Detalle FPA · ${record.folio}`}
      size="lg"
      className="fpa-detail"
      busy={form.pending}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            <KeyValueGrid
              items={[
                { label: "Número de parte FPA", value: record.fpaPartNumber },
                { label: "Solicitante", value: record.requester },
                { label: "Fecha y hora", value: record.createdAt },
                { label: "Estado", value: record.status },
              ]}
            />
            <FormSection title="Etiquetas autorizadas">
              <DataGrid
                label="Etiquetas autorizadas"
                rows={record.items}
                columns={itemColumns}
                rowKey={(row) => row.id}
                paginate={false}
                minWidth={660}
                maxHeight="200px"
              />
            </FormSection>
            <FormSection title="Intentos de impresión">
              <DataGrid
                label="Intentos de impresión"
                rows={record.printAttempts || []}
                columns={attemptColumns}
                rowKey={(row) => row.id}
                minWidth={800}
                maxHeight="220px"
              />
            </FormSection>
            <FormSection title="Bitácora">
              <DataGrid
                label="Bitácora FPA"
                rows={record.events || []}
                columns={eventColumns}
                rowKey={(row) => row.id}
                minWidth={600}
                maxHeight="220px"
              />
            </FormSection>
            {canAdjust && (
              <FormSection title="Ajustar cantidades">
                <div className="form-grid">
                  {record.items.map((item) => (
                    <TextField
                      key={item.id}
                      label={`Nueva cantidad ${item.labelType}`}
                      type="number"
                      min={item.consumed}
                      max={999}
                      step={1}
                      value={form.values[item.labelType]}
                      onChange={(event) =>
                        form.setField(item.labelType, event.target.value)
                      }
                    />
                  ))}
                  <TextareaField
                    label="Motivo obligatorio"
                    required
                    initialFocus={focusAdjust}
                    containerClassName="span-2"
                    rows={2}
                    value={form.values.reason}
                    onChange={(event) =>
                      form.setField("reason", event.target.value)
                    }
                  />
                </div>
                <FormMessages errors={form.errors} error={form.error} />
              </FormSection>
            )}
          </DialogBody>
          {canAdjust ? (
            <FormActions
              pending={form.pending}
              onCancel={onClose}
              submitLabel="Guardar ajuste"
            />
          ) : (
            <DialogFooter>
              <Button onClick={onClose}>Cerrar</Button>
            </DialogFooter>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
