import { useForm } from "@/shared/hooks/useForm";
import {
  Button,
  CheckboxField,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  SelectField,
  TextField,
} from "@/shared/ui";
import { stationIssues, stationTypes } from "./model";
import type { Station, StationDraft } from "./types";
import type { QualityApi } from "./api";

export function StationForm({
  record,
  api,
  saved,
  close,
}: {
  record?: Station;
  api: QualityApi;
  saved: (message: string) => void;
  close: () => void;
}) {
  const form = useForm<StationDraft>({
    initialValues: {
      station_code: record?.station_code ?? "",
      station_name: record?.station_name ?? "",
      station_type: record?.station_type ?? "ICT",
      host_name: record?.host_name ?? "",
      is_active: record?.is_active ?? true,
    },
    validate: stationIssues,
    onSubmit: async (value) => {
      await api.saveStation(value, record?.id);
      saved(record ? "Estación actualizada." : "Estación creada.");
      close();
    },
  });
  return (
    <Modal
      title={
        record ? `Editar estación · ${record.station_code}` : "Nueva estación"
      }
      size="lg"
      busy={form.pending}
      closeOnBackdrop={false}
      onClose={close}
    >
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          <div className="quality-control-form">
            <TextField
              label="Código"
              initialFocus
              required
              maxLength={32}
              autoComplete="off"
              value={form.values.station_code}
              disabled={form.pending}
              onChange={(event) =>
                form.setField("station_code", event.target.value)
              }
            />
            <TextField
              label="Nombre"
              required
              maxLength={128}
              autoComplete="off"
              value={form.values.station_name}
              disabled={form.pending}
              onChange={(event) =>
                form.setField("station_name", event.target.value)
              }
            />
            <SelectField
              label="Tipo"
              required
              options={stationTypes.map((value) => ({ value, label: value }))}
              value={form.values.station_type}
              disabled={form.pending}
              onChange={(event) =>
                form.setField(
                  "station_type",
                  event.target.value as StationDraft["station_type"],
                )
              }
            />
            <TextField
              label="Línea"
              maxLength={128}
              autoComplete="off"
              value={form.values.host_name}
              disabled={form.pending}
              onChange={(event) =>
                form.setField("host_name", event.target.value)
              }
            />
            <CheckboxField
              label="Estación activa"
              checked={form.values.is_active}
              disabled={form.pending}
              onChange={(event) =>
                form.setField("is_active", event.target.checked)
              }
            />
          </div>
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <DialogFooter>
          <Button disabled={form.pending} onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" loading={form.pending}>
            Guardar
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
