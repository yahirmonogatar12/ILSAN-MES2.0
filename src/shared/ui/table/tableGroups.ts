import type { TableGrouping } from "./types";

/** Keeps groups contiguous while retaining the order of records inside each group. */
export function groupTableRows<T>(
  rows: readonly T[],
  grouping: Pick<TableGrouping<T>, "key" | "order" | "showEmpty">,
) {
  const buckets = new Map<string, T[]>();
  for (const key of grouping.order ?? []) buckets.set(key, []);
  for (const row of rows) {
    const key = grouping.key(row);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }
  return [...buckets]
    .filter(([, items]) => items.length || grouping.showEmpty)
    .map(([key, items]) => ({ key, rows: items }));
}
