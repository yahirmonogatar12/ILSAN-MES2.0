import { useRef, useState, type FormEvent } from "react";

export interface FormOptions<T> {
  initialValues: T;
  validate: (values: T) => string[];
  onSubmit: (values: T) => Promise<unknown>;
}
/** Async form orchestration. Domain validation is injected, never hard-coded. */
export function useForm<T>({
  initialValues,
  validate,
  onSubmit,
}: FormOptions<T>) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  function setField<K extends keyof T>(key: K, value: T[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }
  /** Submit an explicit snapshot for forms with several distinct submit actions. */
  async function submit(nextValues: T = values) {
    if (submitting.current) return;
    const issues = validate(nextValues);
    setErrors(issues);
    setError(null);
    if (issues.length) return;
    submitting.current = true;
    setPending(true);
    try {
      await onSubmit(nextValues);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure : new Error("No se pudo guardar."),
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await submit();
  }
  return {
    values,
    setValues,
    setField,
    errors,
    error,
    pending,
    submit,
    handleSubmit,
  };
}
