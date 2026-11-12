import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePermission } from "@/core/auth/usePermission";
import { exportRows, usePlanning } from "./components";
import { orderDefaults, PO_SPECS, WO_SPECS, rangeIssue } from "./model";
import type { Row } from "./types";
export type OrderDialog =
  | { type: "new" | "edit" | "remove" | "state" | "linked-wo"; row?: Row }
  | { type: "import" }
  | { type: "bulk" }
  | null;
export function useOrders(kind: "po" | "wo") {
  const canCreateWO = usePermission({
    pagina: "LISTA_CONTROLDEPRODUCCION",
    seccion: "Control de plan de produccion",
    boton: "Crear Plan de produccion",
  });
  const auth = usePlanning();
  const [initial] = useState(orderDefaults);
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<OrderDialog>(null);
  const [result, setResult] = useState<Row | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const list = useQuery({
    queryKey: auth.key("orders", kind, applied),
    queryFn: ({ signal }) => auth.api.orders(kind, applied, signal),
  });
  const models = useQuery({
    queryKey: auth.key("models"),
    queryFn: ({ signal }) => auth.api.models(signal),
    enabled: !!dialog && ["new", "edit", "linked-wo"].includes(dialog.type),
  });
  const records = list.data ?? [],
    specs = kind === "po" ? PO_SPECS : WO_SPECS;
  const exported = useMutation({
    mutationFn: () =>
      kind === "wo"
        ? auth.api.exportWO(applied)
        : exportRows("PurchaseOrders", specs, records),
  });
  function submit() {
    const issue = rangeIssue(draft.fecha_desde, draft.fecha_hasta);
    setError(issue);
    if (issue) return;
    setApplied({ ...draft });
    setSelected(new Set());
    if (JSON.stringify(draft) === JSON.stringify(applied)) void list.refetch();
  }
  function done(response: Row) {
    setDialog(null);
    setResult(response);
    setSelected(new Set());
    auth.saved(
      Array.isArray(response.errors) && response.errors.length
        ? "Operación procesada con observaciones."
        : undefined,
    );
  }
  const ready = !!list.data && !list.isError && !list.isFetching;
  return {
    kind,
    auth,
    canCreateWO,
    initial,
    draft,
    setDraft,
    applied,
    setApplied,
    error,
    setError,
    dialog,
    setDialog,
    result,
    setResult,
    selected,
    setSelected,
    list,
    models,
    records,
    specs,
    exported,
    ready,
    submit,
    done,
  };
}
export type OrdersController = ReturnType<typeof useOrders>;
