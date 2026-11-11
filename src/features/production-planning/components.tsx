import { useMemo } from "react";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/AuthProvider";
import { useForm } from "@/shared/hooks/useForm";
import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import {
  Alert,
  Button,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  FormMessages,
  IconButton,
  Modal,
  SelectField,
  TextField,
  TextareaField,
  useToast,
} from "@/shared/ui";
import { createPlanningApi } from "./api";
import { makeColumns, object, text } from "./model";
import type { Field, Row, Spec } from "./types";
export function usePlanning() {
  const auth = useAuth(),
    client = useQueryClient(),
    toast = useToast(),
    api = useMemo(() => createPlanningApi(auth.mode), [auth.mode]);
  return {
    ...auth,
    api,
    client,
    key: (...parts: unknown[]) => ["production-planning", auth.scope, ...parts],
    saved: (message = "Cambios guardados.") => {
      toast(message);
      void client.invalidateQueries({
        queryKey: ["production-planning", auth.scope],
      });
    },
  };
}
export function FormDialog({
  title,
  description,
  fields,
  initial,
  onSubmit,
  onDone,
  onClose,
  label = "Guardar",
  validate,
}: {
  title: string;
  description?: string;
  fields: readonly Field[];
  initial: Row;
  onSubmit: (values: Row) => Promise<Row>;
  onDone: (result: Row) => void;
  onClose: () => void;
  label?: string;
  validate?: (values: Row) => string[];
}) {
  const form = useForm({
    initialValues: initial,
    validate: (values) => {
      const errors = fields.flatMap((field) => {
        const value = values[field.key],
          raw = text(value).trim();
        if (field.required && !raw) return [`${field.label} es obligatorio.`];
        if (
          field.type === "number" &&
          raw &&
          (!Number.isFinite(Number(raw)) ||
            (field.min !== undefined && Number(raw) < field.min) ||
            (field.step === 1 && !Number.isInteger(Number(raw))))
        )
          return [`${field.label} no es válido.`];
        return [];
      });
      return [...errors, ...(validate?.(values) ?? [])];
    },
    onSubmit: async (values) => onDone(await onSubmit(values)),
  });
  return (
    <Modal
      title={title}
      subtitle={description}
      onClose={onClose}
      busy={form.pending}
      size="lg"
      className="production-planning-form"
    >
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          <div className="production-planning-fields">
            {fields.map((field) =>
              field.type === "checkbox" ? (
                <CheckboxField
                  key={field.key}
                  label={field.label}
                  checked={Boolean(form.values[field.key])}
                  disabled={form.pending}
                  onChange={(event) =>
                    form.setField(field.key, event.target.checked)
                  }
                />
              ) : field.type === "select" ? (
                <SelectField
                  key={field.key}
                  label={field.label}
                  options={field.options ?? []}
                  value={text(form.values[field.key])}
                  disabled={form.pending}
                  onChange={(event) =>
                    form.setField(field.key, event.target.value)
                  }
                />
              ) : field.type === "textarea" ? (
                <TextareaField
                  key={field.key}
                  label={field.label}
                  value={text(form.values[field.key])}
                  disabled={form.pending}
                  onChange={(event) =>
                    form.setField(field.key, event.target.value)
                  }
                />
              ) : (
                <TextField
                  key={field.key}
                  label={field.label}
                  hint={field.hint}
                  type={field.type ?? "text"}
                  min={field.min}
                  step={field.step}
                  readOnly={field.readOnly}
                  suggestions={field.suggestions}
                  value={text(form.values[field.key])}
                  disabled={form.pending}
                  onChange={(event) =>
                    form.setField(field.key, event.target.value)
                  }
                />
              ),
            )}
          </div>
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <DialogFooter>
          <Button disabled={form.pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={form.pending}>
            {label}
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
export function ResultNotice({
  result,
  onClose,
}: {
  result: Row | null;
  onClose?: () => void;
}) {
  if (!result) return null;
  const details = object(result.detalles) ? result.detalles : {};
  const errors = Array.isArray(result.errors)
    ? result.errors
    : Array.isArray(details.errores)
      ? details.errores
      : [];
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const labels: Record<string, string> = {
    inserted: "Nuevos",
    updated: "Actualizados",
    unchanged: "Sin cambios",
    registros_procesados: "Procesados",
    imported: "Importados",
    generados: "Generados",
    confirmados: "Confirmados",
    aplicadas: "Aplicadas",
    modificadas: "Modificadas",
    excluidas: "Excluidas",
    asignados: "Asignados",
    sin_asignar: "Sin asignar",
    total_qty: "Piezas",
    parts: "Partes",
    schedules: "Capturas de schedule",
    errores: "Errores",
  };
  return (
    <Alert
      tone={
        errors.length || warnings.length || Number(result.errores) > 0
          ? "warning"
          : "success"
      }
      className="production-planning-result"
    >
      <div className="production-planning-result-heading">
        <span>{text(result.message) || "Operación completada."}</span>
        {onClose && (
          <IconButton
            label="Ocultar resultado"
            icon={<X size={14} />}
            onClick={onClose}
          />
        )}
      </div>
      <p>
        {Object.entries(labels)
          .filter(([key]) => result[key] !== undefined)
          .map(([key, label]) => `${label}: ${text(result[key])}`)
          .join(" · ")}
      </p>
      {[...errors, ...warnings].map((error, index) => (
        <p key={index}>
          {typeof error === "string"
            ? error
            : text(
                object(error)
                  ? (error.motivo ?? error.error ?? error.message)
                  : error,
              )}
        </p>
      ))}
    </Alert>
  );
}
export function ReportDialog({
  title,
  records,
  specs,
  onClose,
  loading,
  error,
  onRetry,
}: {
  title: string;
  records: Row[];
  specs?: readonly Spec[];
  onClose: () => void;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const configured =
    specs ??
    [...new Set(records.flatMap((row) => Object.keys(row)))].map(
      (key) => [key, key.replaceAll("_", " ").toUpperCase(), 120] as Spec,
    );
  return (
    <Modal
      title={title}
      size="xl"
      onClose={onClose}
      className="production-planning-dialog"
    >
      <DialogBody>
        <DataGrid
          label={title}
          rows={records}
          columns={makeColumns(configured)}
          rowKey={(_, index) => index}
          minWidth={Math.min(1400, Math.max(700, configured.length * 110))}
          layout="fixed"
          loading={loading}
          error={error}
          onRetry={onRetry}
        />
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
export async function exportRows(
  name: string,
  specs: readonly Spec[],
  records: readonly Row[],
) {
  await exportSpreadsheet(`${name}.xlsx`, [
    {
      name: "Consulta",
      rows: [
        specs.map((spec) => spec[1]),
        ...records.map((row) =>
          specs.map(([key]) => {
            const value = row[key];
            return typeof value === "number" || typeof value === "boolean"
              ? value
              : text(value);
          }),
        ),
      ],
    },
  ]);
}
