import { useCallback, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { usePersistentState } from "@/shared/hooks/usePersistentState";
import { useToast } from "@/shared/ui/useToast";
import { createMaterialsApi } from "./api";
import { decodeFilters, DEFAULT_FILTERS, materialKeys } from "./config";
import { EMPTY_CATALOGS, type Filters, type Material } from "./types";

export type MaterialDialog =
  | { type: "create" }
  | { type: "detail" | "edit" | "history" | "delete"; record: Material }
  | null;
/** All domain queries/state live here; the page composes shared presentation. */
export function useMaterials() {
  const { mode, scope } = useAuth();
  const gateway = useMemo(() => createMaterialsApi(mode), [mode]);
  const client = useQueryClient();
  const notify = useToast();
  const [filters, setFilters] = usePersistentState(
    `mes-v2:material-filters:${scope}`,
    DEFAULT_FILTERS,
    decodeFilters,
  );
  const search = useDebouncedValue(filters.q);
  const requestFilters = useMemo(
    () => ({ ...filters, q: search.value }),
    [filters, search.value],
  );
  const list = useQuery({
    queryKey: materialKeys.list(scope, requestFilters),
    queryFn: ({ signal }) => gateway.list(requestFilters, signal),
    placeholderData: keepPreviousData,
  });
  const catalogs = useQuery({
    queryKey: materialKeys.catalogs(scope),
    queryFn: ({ signal }) => gateway.catalogs(signal),
  });
  const [dialog, setDialog] = useState<MaterialDialog>(null);
  const [openingCode, setOpeningCode] = useState("");
  const opening = useRef(false);
  const [actionError, setActionError] = useState<Error | null>(null);
  const exportFile = useMutation({
    mutationFn: () => gateway.export(requestFilters),
    onSuccess: () => notify("Archivo descargado correctamente."),
  });
  function updateFilters(patch: Partial<Filters>) {
    setFilters((previous) => ({ ...previous, ...patch }));
    exportFile.reset();
  }
  function clearFilters() {
    setFilters({ ...DEFAULT_FILTERS });
    exportFile.reset();
  }
  function submitFilters() {
    search.flush();
    if (filters.q === search.value) void list.refetch();
  }
  async function afterSave(message: string) {
    setDialog(null);
    await client.invalidateQueries({ queryKey: materialKeys.all(scope) });
    notify(message);
  }
  const openRecord = useCallback(
    async function openRecord(
      record: Material,
      type: "edit" | "detail" | "history" | "delete",
    ) {
      if (opening.current) return;
      opening.current = true;
      setOpeningCode(record.numero_parte);
      setActionError(null);
      try {
        setDialog({ type, record: await gateway.detail(record.numero_parte) });
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error
            : new Error("No se pudo consultar el material."),
        );
      } finally {
        opening.current = false;
        setOpeningCode("");
      }
    },
    [gateway],
  );
  return {
    mode,
    scope,
    gateway,
    filters,
    requestFilters,
    searchPending: filters.q !== search.value,
    updateFilters,
    clearFilters,
    submitFilters,
    list,
    catalogs,
    catalogData: catalogs.data || EMPTY_CATALOGS,
    dialog,
    setDialog,
    openingCode,
    actionError,
    exportFile,
    afterSave,
    openRecord,
  };
}
