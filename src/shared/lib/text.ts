/** Accent-insensitive text search; never use to normalize identifiers/payloads. */
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

/** Plain conversion for report values. Objects retain their native string representation. */
export const text = (value: unknown): string =>
  value == null ? "" : String(value);

/** Display conversion for the domains that serialize object values as JSON. */
export const jsonText = (value: unknown): string =>
  value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

/** Case-insensitive matching that retains accents. Callers own trimming and object serialization. */
export function containsText(
  value: unknown,
  search: string,
  locale?: string,
): boolean {
  return text(value)
    .toLocaleLowerCase(locale)
    .includes(search.toLocaleLowerCase(locale));
}
