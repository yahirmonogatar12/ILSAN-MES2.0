import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { useForm } from "@/shared/hooks/useForm";
import {
  ActionGroup,
  Alert,
  Button,
  Card,
  DataGrid,
  DialogBody,
  DialogFooter,
  ExportButton,
  FilterBar,
  FormMessages,
  Modal,
  SelectField,
  TextareaField,
  TextField,
  useToast,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { createWarehouseApi } from "./api";
import {
  filtersFor,
  formatQuantity,
  number,
  rangeError,
  rowKey,
  text,
} from "./model";
import type { Filters, ListKind, Row } from "./types";
import "./module.css";

export function useWarehouse() {
  const auth = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const api = useMemo(() => createWarehouseApi(auth.mode), [auth.mode]);
  const scope = ["shipping-warehouse", auth.scope];
  return {
    api,
    profile: auth.profile,
    key: (...parts: unknown[]) => [...scope, ...parts],
    saved: (result?: Row, fallback = "Cambios guardados.") => {
      void client.invalidateQueries({ queryKey: scope });
      toast(text(result?.message) || fallback);
    },
  };
}
export type Warehouse = ReturnType<typeof useWarehouse>;
export function useFilters(kind: ListKind | "qa") {
  const [defaults] = useState(() => filtersFor(kind));
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [error, setError] = useState("");
  const change = (patch: Partial<Filters>) =>
    setDraft((previous) => ({ ...previous, ...patch }));
  const submit = (refresh?: () => void) => {
    const issue = rangeError(draft);
    setError(issue);
    if (issue) return;
    if (JSON.stringify(applied) === JSON.stringify(draft)) refresh?.();
    else setApplied({ ...draft });
  };
  const reset = () => {
    setDraft(defaults);
    setApplied(defaults);
    setError("");
  };
  return { defaults, draft, applied, error, change, submit, reset };
}
export type FilterState = ReturnType<typeof useFilters>;
const all = { value: "", label: "Todos" };
const moveOptions = [
  all,
  { value: "entry", label: "Entradas" },
  { value: "exit", label: "Salidas" },
  { value: "return", label: "Retornos" },
];
export function SearchBar({
  kind,
  state,
  pending,
  refresh,
  actions,
}: {
  kind: ListKind | "qa";
  state: FilterState;
  pending?: boolean;
  refresh?: () => void;
  actions?: ReactNode;
}) {
  const fields: FilterField<Filters>[] = [
    {
      key: "search",
      label:
        kind === "qa"
          ? "No. parte / modelo / caja / folio"
          : kind === "inventory" || kind === "returns"
            ? "No. parte"
            : "Buscar",
      type: "search",
    },
  ];
  if (kind !== "inventory" && kind !== "catalog")
    fields.push(
      { key: "fecha_desde", label: "Fecha desde", type: "date" },
      { key: "fecha_hasta", label: "Fecha hasta", type: "date" },
    );
  if (kind === "returns")
    fields.push({
      key: "tipo",
      label: "Tipo",
      type: "select",
      options: [
        all,
        { value: "Exceso", label: "Exceso" },
        { value: "OS&D", label: "OS&D" },
      ],
    });
  if (kind === "movements" || kind === "audit")
    fields.push({
      key: "tipo",
      label: "Tipo",
      type: "select",
      options: moveOptions,
    });
  if (kind === "audit")
    fields.push({
      key: "accion",
      label: "Acción",
      type: "select",
      options: [
        all,
        { value: "update", label: "Modificaciones" },
        { value: "delete", label: "Eliminaciones" },
      ],
    });
  if (kind === "catalog")
    fields.push({
      key: "status",
      label: "Estatus",
      type: "select",
      options: [
        all,
        { value: "activo", label: "Activo" },
        { value: "inactivo", label: "Inactivo" },
      ],
    });
  return (
    <>
      <FilterBar
        actions={actions}
        fields={fields}
        values={state.draft}
        defaults={state.defaults}
        pending={pending}
        onChange={state.change}
        onReset={state.reset}
        onSubmit={() => state.submit(refresh)}
      />
      {state.error && (
        <Alert tone="warning" className="table-notice">
          {state.error}
        </Alert>
      )}
    </>
  );
}
export function useListing(warehouse: Warehouse, kind: ListKind) {
  const filters = useFilters(kind);
  const query = useQuery({
    queryKey: warehouse.key(kind, filters.applied),
    queryFn: ({ signal }) => warehouse.api.list(kind, filters.applied, signal),
  });
  return { filters, query };
}
export type ListState = ReturnType<typeof useListing>;
export type ColumnSpec = readonly [
  key: string,
  label: string,
  width: number,
  quantity?: boolean,
];
export function columnsFor(specs: readonly ColumnSpec[]): TableColumn<Row>[] {
  const total = specs.reduce((sum, spec) => sum + spec[2], 0);
  return specs.map(([id, header, width, quantity]) => ({
    id,
    header,
    width: (100 * width) / total + "%",
    cell: (row) =>
      row[id] == null || row[id] === ""
        ? "—"
        : quantity
          ? formatQuantity(row[id])
          : text(row[id]),
    textValue: (row) => text(row[id]),
    sortValue: (row) => (quantity ? number(row[id]) : text(row[id])),
  }));
}
export function Stats({
  items,
}: {
  items: readonly (readonly [string, unknown])[];
}) {
  return (
    <div className="shipping-warehouse-stats">
      {items.map(([label, value]) => (
        <span key={label}>
          {label}{" "}
          <strong>
            {typeof value === "number"
              ? formatQuantity(value)
              : text(value) || "—"}
          </strong>
        </span>
      ))}
    </div>
  );
}
export function ExportAction({
  run,
  disabled,
  label,
}: {
  run: () => Promise<void>;
  disabled?: boolean;
  label?: string;
}) {
  const form = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: run,
  });
  return (
    <>
      <ExportButton
        size="sm"
        disabled={disabled}
        loading={form.pending}
        title="Exporta la consulta con sus filtros generales."
        onClick={() => void form.submit()}
      >
        {label || "Exportar Excel"}
      </ExportButton>
      {form.error && <Alert tone="danger">{form.error.message}</Alert>}
    </>
  );
}
export function ListingCard({
  state,
  warehouse,
  kind,
  title,
  columns,
  width,
  actions,
  summary,
}: {
  state: ListState;
  warehouse: Warehouse;
  kind: ListKind;
  title: string;
  columns: readonly TableColumn<Row>[];
  width?: number;
  actions?: readonly {
    id: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }[];
  summary?: (rows: readonly Row[]) => ReactNode;
}) {
  const { filters, query } = state;
  const rows = query.data?.rows ?? [];
  return (
    <>
      <SearchBar
        kind={kind}
        state={filters}
        pending={query.isFetching}
        refresh={() => void query.refetch()}
        actions={
          <>
            <Button
              size="sm"
              icon={<RefreshCw size={14} />}
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Actualizar
            </Button>
            <ExportAction
              run={() => warehouse.api.exportList(kind, filters.applied)}
              disabled={query.isFetching || !rows.length}
            />
            {actions?.length ? (
              <ActionGroup label="Acciones de almacén" actions={actions} />
            ) : null}
          </>
        }
      />
      <Card fill label={title}>
        <DataGrid
          label={title}
          rows={rows}
          columns={columns}
          rowKey={rowKey}
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          fetching={query.isFetching}
          layout="fixed"
          minWidth={width ?? 950}
          resetKey={JSON.stringify(filters.applied)}
          summary={summary}
        />
      </Card>
    </>
  );
}

export interface Field {
  key: string;
  label: string;
  type?:
    "date" | "datetime-local" | "time" | "number" | "password" | "textarea";
  options?: readonly { value: string; label: string }[];
  min?: number;
  step?: number | "any";
  required?: boolean;
  readOnly?: boolean;
  maxLength?: number;
}
export const deleteFields: Field[] = [
  {
    key: "password",
    label: "Contraseña actual",
    type: "password",
    required: true,
  },
  {
    key: "notes",
    label: "Comentario de eliminación",
    type: "textarea",
    required: true,
  },
];
export function Fields({
  fields,
  values,
  change,
  disabled,
}: {
  fields: readonly Field[];
  values: Row;
  change: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="shipping-warehouse-fields">
      {fields.map((field) => {
        const props = {
          label: field.label,
          value: text(values[field.key]),
          disabled,
          required: field.required,
          onChange: (
            event: React.ChangeEvent<
              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            >,
          ) => change(field.key, event.target.value),
        };
        if (field.options)
          return (
            <SelectField
              key={field.key}
              {...props}
              options={field.options}
              disabled={disabled || field.readOnly}
            />
          );
        if (field.type === "textarea")
          return (
            <TextareaField
              key={field.key}
              {...props}
              readOnly={field.readOnly}
              maxLength={field.maxLength}
            />
          );
        return (
          <TextField
            key={field.key}
            {...props}
            type={field.type}
            readOnly={field.readOnly}
            min={field.min}
            step={field.step}
            maxLength={field.maxLength}
            autoComplete={
              field.type === "password" ? "current-password" : undefined
            }
          />
        );
      })}
    </div>
  );
}
export function MutationDialog({
  title,
  fields,
  initial,
  children,
  label = "Guardar",
  danger,
  validate,
  run,
  close,
}: {
  title: string;
  fields: readonly Field[];
  initial: Row;
  children?: ReactNode;
  label?: string;
  danger?: boolean;
  validate?: (value: Row) => string[];
  run: (value: Row) => Promise<unknown>;
  close: () => void;
}) {
  const form = useForm({
    initialValues: initial,
    validate: (value) => [
      ...fields
        .filter((field) => field.required && !text(value[field.key]).trim())
        .map((field) => field.label + " es obligatorio."),
      ...(validate?.(value) ?? []),
    ],
    onSubmit: async (value) => {
      await run(value);
      close();
    },
  });
  return (
    <Modal
      title={title}
      size="lg"
      busy={form.pending}
      closeOnBackdrop={false}
      onClose={close}
    >
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          {children}
          <Fields
            fields={fields}
            values={form.values}
            change={form.setField}
            disabled={form.pending}
          />
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <DialogFooter>
          <Button disabled={form.pending} onClick={close}>
            Cancelar
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            type="submit"
            loading={form.pending}
          >
            {label}
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
