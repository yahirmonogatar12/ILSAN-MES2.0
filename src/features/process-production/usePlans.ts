import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import { useProcess } from "./useProcess";
import { defaults, rangeIssue } from "./model";
import { planGrouping } from "./PlanGroups";
import {
  autoArrange,
  calculateTimeline,
  moveRow,
  moveToGroup,
  orderPayload,
} from "./timeline";
import type { Kind, Plan, PlanDialog, Row } from "./types";

const EMPTY_PLANS: Plan[] = [];

export function usePlans(kind: Kind) {
  const context = useProcess();
  const [initial] = useState(defaults);
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<PlanDialog>(null);
  const [result, setResult] = useState<Row | null>(null);
  const [localOrder, setLocalOrder] = useState<Plan[] | null>(null);
  const [groups, setGroups] = useState(6);
  const savingOrder = useRef(false);
  const query = useQuery({
    queryKey: context.key("plans", kind, applied.start, applied.end),
    queryFn: ({ signal }) => context.api.plans(kind, applied, signal),
    refetchOnWindowFocus: false,
  });
  const source = localOrder ?? query.data ?? EMPTY_PLANS;
  const calculated = useMemo(
    () => calculateTimeline(kind, source, applied.view),
    [kind, source, applied.view],
  );
  const data = useMemo(
    () =>
      calculated.filter((row) => !applied.line || row.line === applied.line),
    [calculated, applied.line],
  );
  const dirty = localOrder !== null;
  const ready = !query.isFetching && !query.error && !!query.data;
  const orderForm = useForm({
    initialValues: {},
    validate: () =>
      source.length && dirty && ready
        ? []
        : ["No hay cambios de orden para guardar."],
    onSubmit: async () => {
      savingOrder.current = true;
      try {
        const value = await context.api.action(
          kind,
          "order",
          orderPayload(kind, calculateTimeline(kind, source)),
        );
        setLocalOrder(null);
        setResult(value);
        context.saved("Orden guardado.");
      } finally {
        savingOrder.current = false;
      }
    },
  });
  const exportForm = useForm({
    initialValues: {},
    validate: () =>
      dirty ? ["Guarda o descarta el orden antes de exportar."] : [],
    onSubmit: () => context.api.export(kind, data),
  });
  const changeOrder = useCallback(
    (change: () => Plan[], fallback: string) => {
      if (!ready || savingOrder.current)
        return "Espera a que termine la operación actual.";
      try {
        setLocalOrder(change());
        setError("");
        return "";
      } catch (cause) {
        const issue = cause instanceof Error ? cause.message : fallback;
        setError(issue);
        return issue;
      }
    },
    [ready],
  );
  const reorder = useCallback(
    (lot: string, target: string) =>
      changeOrder(
        () => moveRow(kind, calculated, lot, target),
        "No se pudo cambiar el orden.",
      ),
    [changeOrder, kind, calculated],
  );
  const moveGroup = useCallback(
    (lot: string, group: number, date: string) =>
      changeOrder(
        () => moveToGroup(calculated, lot, group, date),
        "No se pudo cambiar de grupo.",
      ),
    [changeOrder, calculated],
  );
  const grouping = useMemo(
    () =>
      planGrouping({
        kind,
        view: applied.view,
        rows: data,
        count: groups,
        date: applied.end,
        canDrop: ready && !orderForm.pending,
        onMove: moveGroup,
      }),
    [
      kind,
      applied.view,
      applied.end,
      data,
      groups,
      ready,
      orderForm.pending,
      moveGroup,
    ],
  );
  function done(value: Row) {
    setDialog(null);
    setResult(value);
    context.saved();
  }
  async function reloadSubAssy(lot: string) {
    const refreshed = await query.refetch({
      throwOnError: true,
      cancelRefetch: false,
    });
    const plan = refreshed.data?.find((row) => row.lot_no === lot);
    if (!plan)
      throw new Error(
        "El plan ya no está disponible. Actualiza la tabla para consultarlo.",
      );
    return plan.sub_assy ?? null;
  }
  function submit() {
    if (dirty || savingOrder.current) return;
    const issue = rangeIssue(draft);
    setError(issue);
    if (!issue) {
      setApplied({ ...draft });
      if (draft.start === applied.start && draft.end === applied.end)
        void query.refetch();
    }
  }
  function reset() {
    if (dirty || savingOrder.current) return;
    const next = defaults();
    setDraft(next);
    setApplied(next);
    setError("");
  }
  return {
    kind,
    context,
    initial,
    draft,
    setDraft,
    applied,
    error,
    dialog,
    setDialog,
    result,
    setResult,
    source,
    calculated,
    data,
    groups,
    setGroups,
    ready,
    dirty,
    orderForm,
    exportForm,
    query,
    grouping,
    reorder,
    moveGroup,
    done,
    reloadSubAssy,
    submit,
    reset,
    discard: () => {
      if (!savingOrder.current) setLocalOrder(null);
    },
    arrange: () =>
      changeOrder(
        () => autoArrange(calculated, groups),
        "No se pudo acomodar.",
      ),
  };
}
export type PlansController = ReturnType<typeof usePlans>;
