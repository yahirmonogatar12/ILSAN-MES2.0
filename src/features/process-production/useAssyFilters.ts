import { useState } from "react";
import type { FilterField } from "@/shared/ui";
import { rangeIssue } from "./model";
import type { Filters } from "./types";
export const ASSY_DATE_FIELDS: FilterField<Filters>[] = [
  { key: "start", label: "Desde", type: "date" },
  { key: "end", label: "Hasta", type: "date" },
];
export function useAssyFilters(initial: Filters) {
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [error, setError] = useState("");
  return {
    draft,
    setDraft,
    applied,
    error,
    reset: () => {
      setDraft(initial);
      setApplied(initial);
      setError("");
    },
    submit: (refetch: () => unknown) => {
      const issue = rangeIssue(draft);
      setError(issue);
      if (issue) return false;
      setApplied({ ...draft });
      if (JSON.stringify(draft) === JSON.stringify(applied)) void refetch();
      return true;
    },
  };
}
