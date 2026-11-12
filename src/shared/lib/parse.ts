/** Finite numeric conversion used by report cells. Keeps Number's conversion and errors. */
export function number(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

/** Matches the existing API guards, accepting non-null objects and excluding arrays. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Common assertion for APIs that share this exact error contract. */
export function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value))
    throw new Error("El servidor devolvió un registro inválido.");
  return value;
}
