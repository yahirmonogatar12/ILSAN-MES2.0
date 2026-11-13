import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/shared/ui";
import { createWarehouseApi } from "./api";
import { filtersFor, rangeError, text } from "./model";
import type { Filters, ListKind, Row } from "./types";

export function useWarehouse() {
  const auth = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const api = useMemo(() => createWarehouseApi(auth.mode), [auth.mode]);
  const scope = ["shipping-warehouse", auth.scope];
  return {
    api,
    profile: auth.profile,
    key: (...parts: unknown[]) => [...scope, ...parts],
    saved: (result?: Row, fallback = "Cambios guardados.") => {
      void client.invalidateQueries({ queryKey: scope });
      toast(text(result?.message) || fallback);
    },
  };
}

export type Warehouse = ReturnType<typeof useWarehouse>;

export function useFilters(kind: ListKind | "qa") {
  const [defaults] = useState(() => filtersFor(kind));
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [error, setError] = useState("");
  const change = (patch: Partial<Filters>) =>
    setDraft((previous) => ({ ...previous, ...patch }));
  const submit = (refresh?: () => void) => {
    const issue = rangeError(draft);
    setError(issue);
    if (issue) return;
    if (JSON.stringify(applied) === JSON.stringify(draft)) refresh?.();
    else setApplied({ ...draft });
  };
  const reset = () => {
    setDraft(defaults);
    setApplied(defaults);
    setError("");
  };
  return { defaults, draft, applied, error, change, submit, reset };
}

export type FilterState = ReturnType<typeof useFilters>;

export function useListing(warehouse: Warehouse, kind: ListKind) {
  const filters = useFilters(kind);
  const query = useQuery({
    queryKey: warehouse.key(kind, filters.applied),
    queryFn: ({ signal }) => warehouse.api.list(kind, filters.applied, signal),
  });
  return { filters, query };
}

export type ListState = ReturnType<typeof useListing>;
