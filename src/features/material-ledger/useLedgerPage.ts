import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { DEFAULT_PAGE_SIZE } from "@/shared/ui";
import type { LedgerPage } from "./types";
/** One remote paging controller for histories and inventory lots. */
export function useLedgerPage(
  key: readonly unknown[],
  load: (
    page: number,
    size: number,
    signal: AbortSignal,
  ) => Promise<LedgerPage>,
  enabled = true,
) {
  const { scope } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setSize] = useState(DEFAULT_PAGE_SIZE);
  const query = useQuery({
    queryKey: ["material-ledger", scope, ...key, page, pageSize],
    queryFn: ({ signal }) => load(page, pageSize, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
  useEffect(() => {
    if (query.data && !query.isFetching) {
      const last = Math.max(1, Math.ceil(query.data.total / pageSize));
      if (page > last) setPage(last);
    }
  }, [query.data, query.isFetching, page, pageSize]);
  const reset = useCallback(() => setPage(1), []);
  const setPageSize = useCallback((size: number) => {
    setPage(1);
    setSize(size);
  }, []);
  return { query, page, pageSize, setPage, setPageSize, reset };
}
