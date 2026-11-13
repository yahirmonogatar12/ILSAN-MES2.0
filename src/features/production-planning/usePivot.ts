import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DEFAULT_PAGE_SIZE } from "@/shared/ui";
import { exportRows } from "./exportRows";
import { usePlanning } from "./usePlanning";
import { object, rangeIssue, text, week } from "./model";
import { pivotExport, pivotRows } from "./pivot";
import { usePivotCells } from "./usePivotCells";
import type { Row } from "./types";
export type PivotDialog =
  | { type: "import"; kind: "lg" | "inventory" | "sync-schedule" }
  | { type: "history" }
  | { type: "proposal" }
  | null;
export function usePivot(projection: boolean) {
  const auth = usePlanning(),
    [initial] = useState(week),
    [draft, setDraft] = useState(initial),
    [applied, setApplied] = useState(initial),
    [page, setPage] = useState(1),
    [size, setSize] = useState(DEFAULT_PAGE_SIZE),
    [error, setError] = useState("");
  const [dialog, setDialog] = useState<PivotDialog>(null),
    [result, setResult] = useState<Row | null>(null);
  const key = JSON.stringify(applied);
  const query = useQuery({
    queryKey: auth.key("pivot", projection, key, page, size),
    queryFn: ({ signal }) => auth.api.pivot(applied, page, size, signal),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === projection &&
      previousQuery.queryKey[4] === key
        ? previous
        : undefined,
  });
  useEffect(() => {
    if (query.data && !query.isFetching && !query.isPlaceholderData) {
      const last = Math.max(1, Math.ceil(query.data.total_parts / size));
      if (page > last) setPage(last);
    }
  }, [query.data, query.isFetching, query.isPlaceholderData, page, size]);
  const history = useQuery({
    queryKey: auth.key("imports"),
    queryFn: ({ signal }) => auth.api.history(signal),
    enabled: dialog?.type === "history",
  });
  const dates = query.data?.dates ?? [],
    records = useMemo(
      () => pivotRows(query.data?.rows ?? [], projection),
      [query.data, projection],
    );
  const writable = !!query.data && !query.error && !query.isPlaceholderData;
  const lineSuggestions = useMemo(
    () => [
      ...new Set(
        (query.data?.rows ?? [])
          .map((row) => (object(row.inv) ? text(row.inv.line) : ""))
          .filter(Boolean),
      ),
    ],
    [query.data],
  );

  const cells = usePivotCells(auth, setError, setResult);
  const exported = useMutation({
    mutationFn: () => {
      const sheet = pivotExport(dates, records, projection);
      return exportRows(
        projection ? `Proyeccion_pagina_${page}` : `Plan_LG_pagina_${page}`,
        sheet.specs,
        sheet.rows,
      );
    },
  });
  function done(response: Row) {
    setDialog(null);
    setResult(response);
    auth.saved();
  }
  function submit() {
    const issue = rangeIssue(draft.date_from, draft.date_to, 120);
    setError(issue);
    if (issue) return;
    setPage(1);
    setApplied({ ...draft });
    if (page === 1 && JSON.stringify(draft) === key) void query.refetch();
  }

  function reset() {
    const next = week();
    setDraft(next);
    setApplied(next);
    setPage(1);
    setError("");
  }
  return {
    initial,
    draft,
    setDraft,
    applied,
    key,
    page,
    size,
    setPage,
    setSize,
    error,
    setError,
    dialog,
    setDialog,
    result,
    setResult,
    query,
    history,
    dates,
    records,
    writable,
    lineSuggestions,
    cells,
    exported,
    done,
    submit,
    reset,
  };
}
