import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

interface FieldMeta {
  label?: ReactNode;
  hint?: string;
  error?: string;
  containerClassName?: string;
  initialFocus?: boolean;
}
function FieldFrame({
  id,
  label,
  hint,
  error,
  required,
  className = "",
  children,
}: {
  id: string;
  label?: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`ui-field ${className}`}>
      {label && (
        <label htmlFor={id}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <small id={`${id}-help`} role="alert" className="field-error">
          {error}
        </small>
      ) : hint ? (
        <small id={`${id}-help`}>{hint}</small>
      ) : null}
    </div>
  );
}
export interface TextFieldProps
  extends ComponentPropsWithRef<"input">, FieldMeta {
  suggestions?: readonly string[];
}
export function TextField({
  label,
  hint,
  error,
  containerClassName,
  initialFocus,
  suggestions,
  id: suppliedId,
  required,
  ...props
}: TextFieldProps) {
  const generated = useId();
  const id = suppliedId || generated;
  return (
    <FieldFrame
      {...{ id, label, hint, error, required }}
      className={containerClassName}
    >
      <input
        {...props}
        id={id}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={
          error || hint ? `${id}-help` : props["aria-describedby"]
        }
        data-initial-focus={initialFocus}
        list={suggestions ? `${id}-options` : props.list}
      />
      {suggestions && (
        <datalist id={`${id}-options`}>
          {suggestions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      )}
    </FieldFrame>
  );
}
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
/** Inline checkbox with one associated label and optional help text. */
export function CheckboxField({
  label,
  hint,
  error,
  containerClassName = "",
  initialFocus,
  id: suppliedId,
  ...props
}: Omit<TextFieldProps, "suggestions" | "type">) {
  const generated = useId();
  const id = suppliedId || generated;
  return (
    <div className={`ui-check ${containerClassName}`}>
      <label htmlFor={id}>
        <input
          {...props}
          id={id}
          type="checkbox"
          data-initial-focus={initialFocus}
          aria-invalid={!!error || undefined}
          aria-describedby={
            error || hint ? `${id}-help` : props["aria-describedby"]
          }
        />
        <span>{label}</span>
      </label>
      {(error || hint) && (
        <small id={`${id}-help`} role={error ? "alert" : undefined}>
          {error || hint}
        </small>
      )}
    </div>
  );
}
export interface SelectFieldProps
  extends ComponentPropsWithRef<"select">, Omit<FieldMeta, "initialFocus"> {
  options: readonly SelectOption[];
}
export function SelectField({
  label,
  hint,
  error,
  containerClassName,
  options,
  id: suppliedId,
  required,
  ...props
}: SelectFieldProps) {
  const generated = useId();
  const id = suppliedId || generated;
  return (
    <FieldFrame
      {...{ id, label, hint, error, required }}
      className={containerClassName}
    >
      <select
        {...props}
        id={id}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={
          error || hint ? `${id}-help` : props["aria-describedby"]
        }
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}
export interface TextareaFieldProps
  extends ComponentPropsWithRef<"textarea">, FieldMeta {}
export function TextareaField({
  label,
  hint,
  error,
  containerClassName,
  initialFocus,
  id: suppliedId,
  required,
  ...props
}: TextareaFieldProps) {
  const generated = useId();
  const id = suppliedId || generated;
  return (
    <FieldFrame
      {...{ id, label, hint, error, required }}
      className={containerClassName}
    >
      <textarea
        {...props}
        id={id}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={
          error || hint ? `${id}-help` : props["aria-describedby"]
        }
        data-initial-focus={initialFocus}
      />
    </FieldFrame>
  );
}
