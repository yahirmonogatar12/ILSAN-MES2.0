import type { TableColumn } from "@/shared/ui";

export function columnsFor<T>(
  specs: readonly (readonly [keyof T & string, string, number])[],
): TableColumn<T>[] {
  const total = specs.reduce((sum, spec) => sum + spec[2], 0);
  const text = (value: unknown) =>
    Array.isArray(value)
      ? value.join(", ")
      : value == null
        ? ""
        : String(value);
  return specs.map(([id, header, width]) => ({
    id,
    header,
    width: `${(width / total) * 100}%`,
    cell: (row) => text(row[id]) || "—",
    textValue: (row) => text(row[id]),
    sortValue: (row) =>
      typeof row[id] === "number" ? (row[id] as number) : text(row[id]),
  }));
}
