import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { createResultsApi } from "./api";

export function useResults() {
  const { mode, scope } = useAuth();
  const api = useMemo(() => createResultsApi(mode), [mode]);
  const client = useQueryClient();
  return {
    api,
    mode,
    scope,
    key: (...parts: unknown[]) => ["production-results", scope, ...parts],
    refresh: () =>
      client.invalidateQueries({ queryKey: ["production-results", scope] }),
  };
}
