/** Calendar used by plant operations. Operator-local controls use localDate. */
export const PLANT_TIME_ZONE = "America/Mexico_City";
const plantCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLANT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ISO calendar date at the plant, independent of the browser's time zone. */
export function today(date = new Date()): string {
  const parts = plantCalendar.formatToParts(date);
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join("-");
}

/** Date controls that intentionally follow the operator's local calendar. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

/** Ordering and duration only. Each domain owns required/optional dates and validity checks. */
export function rangeIssue(start = "", end = "", maxDays?: number): string {
  if (start && end && start > end)
    return "La fecha inicial no puede ser posterior a la final.";
  if (maxDays && (Date.parse(end) - Date.parse(start)) / 86_400_000 > maxDays)
    return `El rango máximo es de ${maxDays} días.`;
  return "";
}
