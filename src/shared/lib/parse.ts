/** Finite numeric conversion used by report cells. Keeps Number's conversion and errors. */
export function number(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

/** Matches the existing API guards, accepting non-null objects and excluding arrays. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Legacy JSON quantities may be numeric strings or null. Preserve their wire representation. */
export function isNumericValue(
  value: unknown,
): value is number | string | null {
  return (
    value === null ||
    ((typeof value === "number" || typeof value === "string") &&
      Number.isFinite(Number(value)))
  );
}

export function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Falta el campo ${field}.`);
  return value.trim();
}

export function requiredNumber(value: unknown, field: string): number {
  if (value == null || value === "" || !isNumericValue(value))
    throw new Error(`El campo ${field} debe ser numérico.`);
  return Number(value);
}

export function positiveIntegerList(value: unknown, message: string): number[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => Number.isSafeInteger(item) && item > 0)
  )
    throw new Error(message);
  return value;
}

/** Common assertion for APIs that share this exact error contract. */
export function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value))
    throw new Error("El servidor devolvió un registro inválido.");
  return value;
}
