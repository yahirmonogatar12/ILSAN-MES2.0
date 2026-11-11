import { useState } from "react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  SelectField,
  TextField,
} from "@/shared/ui";
import {
  columnsFor,
  ExportAction,
  Fields,
  Stats,
  type Field,
  type Warehouse,
} from "./components";
import { integer, rowKey, text } from "./model";
import type { BatchPreview, Row } from "./types";

const now = () =>
  new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Mexico_City" })
    .replace(" ", "T")
    .slice(0, 16);
const previewColumns = columnsFor([
  ["part_number", "NO. PARTE", 150],
  ["quantity", "CANTIDAD", 100, true],
  ["current_quantity", "ACTUAL", 100, true],
  ["new_quantity", "NUEVO", 100, true],
  ["product_model", "MODELO", 130],
  ["closureImpactCount", "CIERRES AFECTADOS", 130, true],
]);
const manualFields: Field[] = [
  {
    key: "movementAt",
    label: "Fecha del movimiento",
    type: "datetime-local",
    required: true,
  },
  { key: "partNumber", label: "No. parte", required: true },
  {
    key: "quantity",
    label: "Cantidad",
    type: "number",
    min: 1,
    step: 1,
    required: true,
  },
  { key: "reason", label: "Motivo", required: true },
];

export function AdjustmentDialog({
  warehouse,
  kind,
  close,
}: {
  warehouse: Warehouse;
  kind: "entries" | "exits";
  close: () => void;
}) {
  const [mode, setMode] = useState("manual");
  const [draft, setDraft] = useState<Row>({
    movementAt: now(),
    partNumber: "",
    quantity: "",
    reason: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const batchId = preview?.batchId;
  const form = useForm({
    initialValues: { action: "manual" },
    validate: ({ action }) => {
      if (action === "manual")
        return [
          ...(!text(draft.partNumber).trim()
            ? ["Captura el número de parte."]
            : []),
          ...(integer(draft.quantity) === null
            ? ["Captura una cantidad entera mayor a cero."]
            : []),
          ...(!text(draft.reason).trim()
            ? ["Captura el motivo del movimiento."]
            : []),
          ...(!draft.movementAt ? ["Captura la fecha del movimiento."] : []),
        ];
      if (action === "preview")
        return [
          ...(!file || !/\.(csv|xlsx|xls)$/i.test(file.name)
            ? ["Selecciona un archivo CSV o Excel."]
            : []),
          ...(!draft.movementAt || !text(draft.reason).trim()
            ? ["La fecha y el motivo son obligatorios."]
            : []),
        ];
      return action === "confirm" && !batchId
        ? ["Primero valida el archivo."]
        : [];
    },
    onSubmit: async ({ action }) => {
      if (action === "manual") {
        const result = await warehouse.api.manualAdjustment(kind, {
          partNumber: text(draft.partNumber).trim(),
          quantity: integer(draft.quantity)!,
          reason: text(draft.reason).trim(),
          movementAt: text(draft.movementAt),
        });
        warehouse.saved(result);
        close();
      } else if (action === "preview" && file) {
        setPreview(
          await warehouse.api.previewAdjustment(
            kind,
            file,
            text(draft.reason).trim(),
            text(draft.movementAt),
          ),
        );
      } else if (action === "confirm" && batchId) {
        const result = await warehouse.api.adjustmentBatch(
          kind,
          "confirm",
          batchId,
        );
        warehouse.saved({
          message: `${numberResult(result.insertedRows)} movimientos aplicados. ${numberResult(result.updatedClosureRows)} cierres recalculados.`,
        });
        close();
      } else {
        if (batchId)
          await warehouse.api.adjustmentBatch(kind, "cancel", batchId);
        if (action === "close") close();
        else {
          setFile(null);
          setPreview(null);
          setInputKey((previous) => previous + 1);
        }
      }
    },
  });
  const locked = form.pending || !!batchId;
  const change = (key: string, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setPreview(null);
  };
  const requestClose = () =>
    batchId ? void form.submit({ action: "close" }) : close();
  return (
    <Modal
      title={
        kind === "entries"
          ? "Registrar entrada de embarques"
          : "Registrar salida de embarques"
      }
      size="xl"
      className="shipping-warehouse-dialog"
      busy={form.pending}
      closeOnBackdrop={false}
      onClose={requestClose}
    >
      <DialogBody>
        <SelectField
          label="Forma de registro"
          value={mode}
          disabled={locked}
          options={[
            { value: "manual", label: "Manual" },
            { value: "file", label: "Por archivo" },
          ]}
          onChange={(event) => {
            setMode(event.target.value);
            setPreview(null);
          }}
        />
        <Fields
          fields={
            mode === "manual"
              ? manualFields
              : manualFields.filter(
                  (field) =>
                    field.key === "movementAt" || field.key === "reason",
                )
          }
          values={draft}
          change={change}
          disabled={locked}
        />
        {mode === "file" && (
          <TextField
            key={inputKey}
            type="file"
            label="Archivo CSV/XLSX"
            accept=".csv,.xlsx,.xls"
            disabled={locked}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        )}
        <FormMessages
          errors={[...form.errors, ...(preview?.errors ?? [])]}
          error={form.error}
        />
        {preview && (
          <>
            {batchId && (
              <Stats
                items={[
                  ["Lote", preview.batchCode],
                  ["Registros", preview.summary.totalRows],
                  ["Piezas", preview.summary.totalQuantity],
                ]}
              />
            )}
            {preview.closureImpact.affected === true && (
              <Alert tone="warning">
                El ajuste afecta {text(preview.closureImpact.affectedRows)}{" "}
                registros de cierres anteriores.
              </Alert>
            )}
            {preview.rows.length > 0 && (
              <DataGrid
                label="Vista previa de ajustes"
                rows={preview.rows}
                columns={previewColumns}
                rowKey={rowKey}
                layout="fixed"
                minWidth={730}
              />
            )}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button disabled={form.pending} onClick={requestClose}>
          Cerrar
        </Button>
        {mode === "manual" ? (
          <Button
            variant="success"
            loading={form.pending}
            onClick={() => void form.submit({ action: "manual" })}
          >
            Registrar
          </Button>
        ) : (
          <>
            <ExportAction
              label="Descargar plantilla"
              run={() => warehouse.api.adjustmentTemplate(kind)}
              disabled={form.pending}
            />
            {batchId ? (
              <>
                <Button
                  disabled={form.pending}
                  onClick={() => void form.submit({ action: "reset" })}
                >
                  Descartar vista previa
                </Button>
                <Button
                  variant="success"
                  loading={form.pending}
                  onClick={() => void form.submit({ action: "confirm" })}
                >
                  Confirmar lote
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                loading={form.pending}
                onClick={() => void form.submit({ action: "preview" })}
              >
                Validar archivo
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </Modal>
  );
}
const numberResult = (value: unknown) => Number(value) || 0;
