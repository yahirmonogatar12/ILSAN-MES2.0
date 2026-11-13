import { useMemo } from "react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  SelectField,
  TextField,
  TextareaField,
} from "@/shared/ui";
import { makeColumns } from "./columns";
import { fieldIssues, record, text } from "./model";
import type { Field, Row, Spec } from "./types";
export function Fields({
  fields,
  values,
  pending,
  change,
}: {
  fields: readonly Field[];
  values: Row;
  pending: boolean;
  change: (key: string, value: unknown) => void;
}) {
  return (
    <div className="process-production-fields">
      {fields.map((field) =>
        field.type === "checkbox" ? (
          <CheckboxField
            key={field.key}
            label={field.label}
            checked={!!values[field.key]}
            disabled={pending || field.readOnly}
            onChange={(event) => change(field.key, event.target.checked)}
          />
        ) : field.type === "select" ? (
          <SelectField
            key={field.key}
            label={field.label}
            required={field.required}
            disabled={pending || field.readOnly}
            value={text(values[field.key])}
            options={field.options ?? []}
            onChange={(event) => change(field.key, event.target.value)}
          />
        ) : field.type === "textarea" ? (
          <TextareaField
            key={field.key}
            label={field.label}
            value={text(values[field.key])}
            disabled={pending}
            readOnly={field.readOnly}
            onChange={(event) => change(field.key, event.target.value)}
          />
        ) : (
          <TextField
            key={field.key}
            label={field.label}
            type={field.type ?? "text"}
            required={field.required}
            disabled={pending}
            readOnly={field.readOnly}
            min={field.min}
            max={field.max}
            step={field.step ?? (field.type === "number" ? "any" : undefined)}
            value={text(values[field.key])}
            onChange={(event) => change(field.key, event.target.value)}
          />
        ),
      )}
    </div>
  );
}
export function FormDialog({
  title,
  description,
  fields,
  initial,
  onSave,
  onDone,
  onClose,
  label = "Guardar",
  validate,
}: {
  title: string;
  description?: string;
  fields: readonly Field[];
  initial: Row;
  onSave: (value: Row) => Promise<Row>;
  onDone: (value: Row) => void;
  onClose: () => void;
  label?: string;
  validate?: (value: Row) => string[];
}) {
  const form = useForm({
    initialValues: initial,
    validate: (value) => [
      ...fieldIssues(fields, value),
      ...(validate?.(value) ?? []),
    ],
    onSubmit: async (value) => onDone(await onSave(value)),
  });
  return (
    <Modal
      title={title}
      subtitle={description}
      className="process-production-form"
      size="lg"
      busy={form.pending}
      closeOnBackdrop={false}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          <Fields
            fields={fields}
            values={form.values}
            pending={form.pending}
            change={form.setField}
          />
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
export function ResultNotice({ result }: { result: Row | null }) {
  if (!result) return null;
  const notes = [
    result.errors,
    result.omitidos,
    result.warnings,
    result.errores,
    result.detalles && record(result.detalles).errores,
  ].flatMap((value) => (Array.isArray(value) ? value : []));
  const counts = Object.entries({
    imported: "Importados",
    imported_count: "Importados",
    created: "Creados",
    insertados: "Insertados",
    aplicados: "Aplicados",
    updated_count: "Actualizados",
    lot_no: "Lote",
    lot_top: "TOP ligado",
    imported_top: "TOP",
    tops_omitidos: "TOP omitidos",
  })
    .filter(([key]) => result[key] !== undefined)
    .map(([key, label]) => `${label}: ${text(result[key])}`)
    .join(" · ");
  return (
    <Alert
      className="process-production-result"
      tone={notes.length ? "warning" : "info"}
    >
      {text(result.message) || counts || "Operación completada."}
      {!!result.message && !!counts && <p>{counts}</p>}
      {notes.map((note, index) => (
        <p key={index}>{typeof note === "string" ? note : text(note)}</p>
      ))}
    </Alert>
  );
}
export function Records({
  title,
  records,
  specs,
}: {
  title: string;
  records: Row[];
  specs?: readonly Spec[];
}) {
  const columns = useMemo(
    () =>
      makeColumns(
        specs ??
          [...new Set(records.flatMap((row) => Object.keys(row)))].map(
            (key) => [key, key.replaceAll("_", " ").toUpperCase(), 120] as Spec,
          ),
      ),
    [records, specs],
  );
  return (
    <DataGrid
      label={title}
      rows={records}
      columns={columns}
      rowKey={(_, index) => index}
      minWidth={700}
      layout="fixed"
    />
  );
}
