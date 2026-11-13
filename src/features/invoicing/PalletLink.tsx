import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import {
  Button,
  DialogBody,
  DialogFooter,
  ErrorState,
  FormMessages,
  Loading,
  Modal,
  SelectField,
  TextField,
} from "@/shared/ui";
import { useInvoicing } from "./useInvoicing";
import { amount, object, text } from "./model";
import type { DataRow, InvoiceScope } from "./types";
export function PalletLink({
  id,
  scope,
  row,
  onClose,
  onSaved,
}: {
  id: number;
  scope: InvoiceScope;
  row: DataRow;
  onClose: () => void;
  onSaved: (result: DataRow) => void;
}) {
  const auth = useInvoicing();
  const code = text(row.ejemplo_codigo);
  const targets = useQuery({
    queryKey: auth.key("partial", scope, id, code),
    queryFn: ({ signal }) => auth.invoices.partial(scope, id, code, signal),
  });
  const form = useForm({
    initialValues: { target: "", note: "" },
    validate: (values) =>
      targets.isSuccess &&
      targets.data.records.some((row) => text(row.id) === values.target)
        ? []
        : ["Selecciona un packing destino de la consulta actual."],
    onSubmit: async (values) => {
      const result = await auth.invoices.link(
        scope,
        id,
        code,
        Number(values.target),
        values.note,
      );
      if (amount(result.aplicados) < 1) {
        const skipped = Array.isArray(result.skipped)
          ? result.skipped[0]
          : null;
        throw new Error(
          object(skipped) ? text(skipped.error) : "El lote no se pudo aplicar.",
        );
      }
      onSaved(result);
    },
  });
  return (
    <Modal
      title="Confirmar pallet distinto"
      subtitle={`Lote ${code} · pallet recibido ${text(row.pallet_no)}`}
      onClose={onClose}
      busy={form.pending}
      size="lg"
    >
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          {targets.isPending ? (
            <Loading />
          ) : targets.error ? (
            <ErrorState
              error={targets.error}
              onRetry={() => void targets.refetch()}
            />
          ) : (
            <>
              <p>
                El servidor registrará que el material llegó en un pallet
                distinto del esperado.
              </p>
              <SelectField
                label="Packing destino"
                value={form.values.target}
                options={[
                  { value: "", label: "Selecciona un destino" },
                  ...targets.data.records.map((row) => ({
                    value: text(row.id),
                    label: `#${text(row.line_no)} · pallet ${text(row.pallet_no)} · pendiente ${text(row.cantidad_pendiente)} de ${text(row.cantidad_packing)}`,
                  })),
                ]}
                onChange={(event) =>
                  form.setField("target", event.target.value)
                }
              />
              <TextField
                label="Nota de aplicación"
                maxLength={255}
                value={form.values.note}
                onChange={(event) => form.setField("note", event.target.value)}
              />
              {!targets.data.records.length && (
                <p>No hay packing parciales de esta parte disponibles.</p>
              )}
            </>
          )}
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
            disabled={!targets.isSuccess || !targets.data.records.length}
          >
            Confirmar y vincular
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
