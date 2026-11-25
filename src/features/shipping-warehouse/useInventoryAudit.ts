import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { inventoryAuditDefaults, inventoryAuditFilterParams } from "./model";
import type { InventoryAuditFilters, Row } from "./types";
import type { Warehouse } from "./hooks";

export function useInventoryAudit(warehouse: Warehouse) {
  const [defaults] = useState(inventoryAuditDefaults);
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const history = useQuery({
    queryKey: warehouse.key("inventory-audits", applied),
    queryFn: ({ signal }) =>
      warehouse.api.inventoryAuditHistory(applied, signal),
    refetchOnWindowFocus: false,
  });
  const detail = useQuery({
    queryKey: warehouse.key("inventory-audit", selected),
    queryFn: ({ signal }) =>
      warehouse.api.inventoryAuditDetail(selected!, signal),
    enabled: selected !== null,
    refetchOnWindowFocus: false,
  });

  const change = (patch: Partial<InventoryAuditFilters>) =>
    setDraft((previous) => ({ ...previous, ...patch }));
  const submit = () => {
    try {
      inventoryAuditFilterParams(draft);
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : "Rango de fechas inválido.",
      );
      return;
    }
    setError("");
    setApplied({ ...draft });
    setSelected(null);
  };
  const reset = () => {
    setDraft(defaults);
    setApplied(defaults);
    setError("");
    setSelected(null);
  };
  const select = (row: Row) => {
    const id = Number(row.id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (selected === id) void detail.refetch();
    else setSelected(id);
  };

  return {
    defaults,
    draft,
    applied,
    error,
    history,
    detail,
    selected,
    change,
    submit,
    reset,
    select,
  };
}

export type InventoryAuditState = ReturnType<typeof useInventoryAudit>;
