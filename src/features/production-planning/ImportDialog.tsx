import { useRef, useState } from "react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  FormMessages,
  KeyValueGrid,
  Modal,
  SelectField,
  SpreadsheetPreview,
  TextField,
} from "@/shared/ui";
import { usePlanning } from "./usePlanning";
import {
  fileIssue,
  makeColumns,
  object,
  rows,
  text,
  today,
  validDate,
} from "./model";
import type { FileAction, Row, Upload } from "./types";
const titles: Record<
  Exclude<FileAction, "preview-lg" | "confirm-lg"> | "lg",
  string
> = {
  lg: "Importar Plan LG",
  inventory: "Importar inventario · Part 10",
  "sync-schedule": "Sincronizar schedule desde Excel",
  "wo-excel": "Importar plan de producción desde Excel",
};
export function ImportDialog({
  kind,
  onDone,
  onClose,
}: {
  kind: "lg" | "inventory" | "sync-schedule" | "wo-excel";
  onDone: (value: Row) => void;
  onClose: () => void;
}) {
  const auth = usePlanning(),
    frozen = useRef<Upload | null>(null),
    [preview, setPreview] = useState<Row | null>(null),
    [showExcel, setShowExcel] = useState(false);
  const form = useForm({
    initialValues: {
      file: null as File | null,
      year: "",
      mode: "upsert",
      includeZero: true,
      date: today(),
    },
    validate: (values) => {
      if (preview)
        return kind === "lg" && !text(preview.file_sha256)
          ? ["Vuelve a analizar el archivo antes de confirmar."]
          : [];
      const issue = fileIssue(values.file);
      if (kind === "wo-excel" && !validDate(values.date))
        return ["Selecciona la fecha de operación."];
      return issue
        ? [issue]
        : values.year &&
            (!/^\d{4}$/.test(values.year) || Number(values.year) < 1900)
          ? ["El año del plan no es válido."]
          : [];
    },
    onSubmit: async (values) => {
      if (!preview) {
        const upload: Upload = {
          file: values.file!,
          ...(kind === "lg"
            ? {
                plan_year: values.year || undefined,
                import_mode: values.mode,
                include_zero: values.includeZero ? "1" : "0",
              }
            : {}),
          ...(kind === "wo-excel" ? { fecha_operacion: values.date } : {}),
        };
        frozen.current = upload;
        setPreview(
          kind === "lg"
            ? await auth.api.upload("preview-lg", upload)
            : {
                file: { name: upload.file.name },
                summary: { fecha_operacion: upload.fecha_operacion },
              },
        );
        return;
      }
      if (!frozen.current) throw new Error("Selecciona el archivo otra vez.");
      const result = await auth.api.upload(
        kind === "lg" ? "confirm-lg" : kind,
        {
          ...frozen.current,
          ...(kind === "lg" ? { file_sha256: text(preview.file_sha256) } : {}),
        },
      );
      onDone(result);
    },
  });
  const sample =
    preview && Array.isArray(preview.sample_rows)
      ? rows(preview.sample_rows)
      : [];
  const summary = preview && object(preview.summary) ? preview.summary : {};
  const labels: Record<string, string> = {
    plan_year: "Año",
    date_from: "Desde",
    date_to: "Hasta",
    parts_count: "Partes",
    dates_count: "Fechas",
    records_count: "Registros",
    zero_records_count: "Ceros",
    duplicates_count: "Duplicados",
    fecha_operacion: "Fecha de operación",
  };
  return (
    <>
      <Modal
        title={titles[kind]}
        onClose={onClose}
        busy={form.pending}
        size={preview && kind === "lg" ? "xl" : "lg"}
        className={
          preview && kind === "lg"
            ? "production-planning-dialog"
            : "production-planning-form"
        }
      >
        <form
          onSubmit={form.handleSubmit}
          className={
            preview && kind === "lg"
              ? "production-planning-dialog-form"
              : undefined
          }
        >
          <DialogBody>
            {!preview ? (
              <div className="production-planning-fields">
                <TextField
                  label="Archivo Excel"
                  type="file"
                  accept=".xlsx,.xls,.xlsm,.xltx,.xltm"
                  disabled={form.pending}
                  onChange={(event) =>
                    form.setField("file", event.target.files?.[0] ?? null)
                  }
                />
                {kind === "lg" && (
                  <>
                    <TextField
                      label="Año del plan"
                      disabled={form.pending}
                      placeholder="Detectar desde el archivo"
                      value={form.values.year}
                      onChange={(event) =>
                        form.setField("year", event.target.value)
                      }
                    />
                    <SelectField
                      label="Modo de importación"
                      disabled={form.pending}
                      value={form.values.mode}
                      onChange={(event) =>
                        form.setField("mode", event.target.value)
                      }
                      options={[
                        { value: "upsert", label: "Insertar y actualizar" },
                        {
                          value: "only_positive",
                          label: "Solo cantidades positivas",
                        },
                        { value: "only_new", label: "Solo registros nuevos" },
                      ]}
                    />
                    <CheckboxField
                      label="Incluir cantidades en cero"
                      disabled={form.pending}
                      checked={form.values.includeZero}
                      onChange={(event) =>
                        form.setField("includeZero", event.target.checked)
                      }
                    />
                  </>
                )}
                {kind === "wo-excel" && (
                  <TextField
                    label="Fecha de operación"
                    disabled={form.pending}
                    type="date"
                    value={form.values.date}
                    onChange={(event) =>
                      form.setField("date", event.target.value)
                    }
                  />
                )}
              </div>
            ) : (
              <>
                <Alert tone={kind === "sync-schedule" ? "warning" : "info"}>
                  <p>Archivo: {frozen.current?.file.name}</p>
                  <p>
                    {kind === "lg"
                      ? `Modo: ${({ upsert: "Insertar y actualizar", only_positive: "Solo cantidades positivas", only_new: "Solo registros nuevos" } as Record<string, string>)[frozen.current?.import_mode ?? ""]}. Revisa el resumen antes de confirmar.`
                      : kind === "inventory"
                        ? "Se actualizarán el inventario semanal y las capturas incluidas en Part 10."
                        : kind === "sync-schedule"
                          ? "Se sincronizarán las capturas con el archivo; las capturas ausentes en su alcance pueden eliminarse."
                          : `Se importará el plan para ${frozen.current?.fecha_operacion}.`}
                  </p>
                </Alert>
                <KeyValueGrid
                  items={Object.entries(labels)
                    .filter(([key]) => summary[key] !== undefined)
                    .map(([key, label]) => ({
                      label,
                      value: text(summary[key]),
                    }))}
                />
                {Array.isArray(preview.warnings) &&
                  preview.warnings.length > 0 && (
                    <Alert tone="warning">
                      {preview.warnings.map((warning, index) => (
                        <p key={index}>{text(warning)}</p>
                      ))}
                    </Alert>
                  )}
                {kind === "lg" && (
                  <DataGrid
                    label="Muestra del Plan LG"
                    rows={sample}
                    columns={makeColumns([
                      ["part_no", "NÚMERO DE PARTE", 180],
                      ["plan_date", "FECHA", 100],
                      ["plan_qty", "PLAN LG", 100],
                    ])}
                    rowKey={(_, index) => index}
                    minWidth={650}
                    layout="fixed"
                  />
                )}
              </>
            )}
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <DialogFooter>
            <Button disabled={form.pending} onClick={onClose}>
              Cancelar
            </Button>
            {preview && (
              <>
                <Button
                  disabled={form.pending}
                  onClick={() => {
                    setPreview(null);
                    frozen.current = null;
                    form.setField("file", null);
                  }}
                >
                  Cambiar archivo u opciones
                </Button>
                <Button
                  disabled={form.pending}
                  onClick={() => setShowExcel(true)}
                >
                  Ver Excel original
                </Button>
              </>
            )}
            <Button type="submit" variant="primary" loading={form.pending}>
              {preview
                ? "Confirmar importación"
                : kind === "lg"
                  ? "Analizar archivo"
                  : "Revisar archivo"}
            </Button>
          </DialogFooter>
        </form>
      </Modal>
      {showExcel && frozen.current && (
        <Modal
          title="Excel original"
          subtitle={frozen.current.file.name}
          onClose={() => setShowExcel(false)}
          size="xl"
          className="production-planning-dialog"
        >
          <DialogBody>
            <SpreadsheetPreview
              blob={frozen.current.file}
              name={frozen.current.file.name}
            />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setShowExcel(false)}>Cerrar</Button>
          </DialogFooter>
        </Modal>
      )}
    </>
  );
}
