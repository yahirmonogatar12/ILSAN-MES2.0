import { Filter, Search, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Button, IconButton } from "./Button";
import {
  CheckboxField,
  TextField,
  TextareaField,
  SelectField,
  type SelectOption,
} from "./Fields";
import { Card } from "./Layout";
import { DialogBody, Modal } from "./Modal";

export interface FilterField<T> {
  key: Extract<keyof T, string>;
  label: string;
  type:
    "search" | "select" | "text" | "date" | "number" | "checkbox" | "textarea";
  options?: readonly SelectOption[];
  suggestions?: readonly string[];
  placeholder?: string;
  maxLength?: number;
  min?: number;
  step?: number | "any";
  autoFocus?: boolean;
  icon?: ReactNode;
}
export interface FilterBarProps<T> {
  fields: readonly FilterField<T>[];
  values: T;
  defaults: T;
  onChange: (patch: Partial<T>) => void;
  onSubmit: () => void;
  onReset: () => void;
  pending?: boolean;
  title?: string;
}
/** String-valued filters, injected by each module. Persistence and queries are external. */
export function FilterBar<T extends object>({
  fields,
  values,
  defaults,
  onChange,
  onSubmit,
  onReset,
  pending,
  title,
}: FilterBarProps<T>) {
  const compact = useMediaQuery(
    "(max-height: 500px), (max-width: 560px) and (max-height: 700px)",
  );
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!compact) setExpanded(false);
  }, [compact]);
  const active = fields.filter(
    (field) =>
      String(values[field.key] ?? "") !== String(defaults[field.key] ?? ""),
  );
  const update = (key: keyof T, value: string) =>
    onChange({ [key]: value } as Partial<T>);
  const form = (
    <form
      className="filter-bar"
      aria-label={title || "Filtros de búsqueda"}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
        if (compact) setExpanded(false);
      }}
    >
      {fields.map((field) => (
        <div
          className={`filter-field ${field.type === "search" ? "filter-search" : ""}`}
          key={field.key}
        >
          {field.type === "checkbox" ? (
            <CheckboxField
              label={field.label}
              aria-label={field.label}
              checked={String(values[field.key]) === "1"}
              onChange={(event) =>
                update(field.key, event.target.checked ? "1" : "0")
              }
            />
          ) : field.type === "select" ? (
            <SelectField
              label={
                <>
                  {field.icon}
                  {field.label}
                </>
              }
              value={String(values[field.key] ?? "")}
              aria-label={field.label}
              options={field.options || []}
              onChange={(event) => update(field.key, event.target.value)}
            />
          ) : field.type === "textarea" ? (
            <TextareaField
              label={field.label}
              aria-label={field.label}
              value={String(values[field.key] ?? "")}
              rows={2}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              onChange={(event) => update(field.key, event.target.value)}
            />
          ) : (
            <div className="search-field-wrap">
              <TextField
                initialFocus={compact && field.key === fields[0]?.key}
                autoFocus={!compact && field.autoFocus}
                label={
                  <>
                    {field.icon}
                    {field.label}
                  </>
                }
                aria-label={field.label}
                type={field.type}
                maxLength={field.maxLength}
                min={field.min}
                step={field.step}
                value={String(values[field.key] ?? "")}
                placeholder={field.placeholder}
                suggestions={field.suggestions}
                onChange={(event) => update(field.key, event.target.value)}
              />
              {field.type === "search" && String(values[field.key] ?? "") && (
                <IconButton
                  label={`Limpiar ${field.label.toLocaleLowerCase()}`}
                  icon={<X size={13} />}
                  className="search-clear"
                  onClick={() =>
                    update(field.key, String(defaults[field.key] ?? ""))
                  }
                />
              )}
            </div>
          )}
        </div>
      ))}
      <Button
        variant="primary"
        type="submit"
        icon={<Search size={15} />}
        disabled={pending}
      >
        Consultar
      </Button>
      <Button onClick={onReset}>Limpiar</Button>
    </form>
  );
  return (
    <>
      <Card
        title={compact ? undefined : title}
        icon={<Filter size={16} />}
        className="filters-panel"
      >
        {compact ? (
          <div className="filter-compact-toolbar">
            <Button
              size="sm"
              icon={<Filter size={14} />}
              aria-haspopup="dialog"
              aria-expanded={expanded}
              onClick={() => setExpanded(true)}
            >
              {title || "Filtros"}
              {active.length ? ` (${active.length})` : ""}
            </Button>
            {active.length > 0 && (
              <Button size="sm" onClick={onReset}>
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          form
        )}
        {!compact && active.length > 0 && (
          <div className="active-filters">
            <Filter size={13} />
            <span>Filtros activos</span>
            {active.map((field) => (
              <span className="filter-chip" key={field.key}>
                {field.type === "checkbox"
                  ? field.label
                  : field.options?.find(
                      (option) => option.value === String(values[field.key]),
                    )?.label || String(values[field.key])}
                <IconButton
                  label={`Quitar filtro ${field.label}`}
                  icon={<X size={12} />}
                  onClick={() =>
                    update(field.key, String(defaults[field.key] ?? ""))
                  }
                />
              </span>
            ))}
            <Button variant="plain" className="text-button" onClick={onReset}>
              Limpiar todos
            </Button>
          </div>
        )}
      </Card>
      {compact && expanded && (
        <Modal
          title={title || "Filtros"}
          className="filter-dialog"
          onClose={() => setExpanded(false)}
        >
          <DialogBody>{form}</DialogBody>
        </Modal>
      )}
    </>
  );
}
