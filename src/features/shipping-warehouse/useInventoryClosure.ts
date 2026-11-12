import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import { records } from "./api";
import type { Warehouse } from "./components";
import { recordId, text } from "./model";
import type { BatchPreview, Row } from "./types";

export function useInventoryClosure(warehouse: Warehouse) {
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [historyOverride, setHistoryOverride] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const bootstrap = useQuery({
    queryKey: warehouse.key("closure-bootstrap"),
    queryFn: ({ signal }) => warehouse.api.closureBootstrap(signal),
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
  const detail = useQuery({
    queryKey: warehouse.key("closure-detail", selected),
    queryFn: ({ signal }) => warehouse.api.closureDetail(selected!, signal),
    enabled: selected !== null,
    staleTime: 0,
  });
  useEffect(() => {
    if (
      selected === null ||
      !detail.data ||
      detail.isFetching ||
      detail.isError
    )
      return;
    const { batch, ...data } = detail.data;
    const draft = batch.status === "draft";
    setPreview({
      ...data,
      valid: draft,
      batchId: draft ? recordId(batch.id) : null,
      batchCode: text(batch.closure_label),
      history: [],
      errors: [],
      closureImpact: {},
      metadata: {
        ...data.metadata,
        closureDate: data.metadata.closureDate || batch.closed_at,
        closureUser:
          batch.confirmed_by || batch.created_by || data.metadata.closureUser,
        closureMonthLabel:
          data.metadata.closureMonthLabel || batch.closure_month,
      },
    });
    setStatus(
      draft
        ? "Preview pendiente retomado · " + text(batch.closure_label)
        : "Consultando " + text(batch.closure_label) + ".",
    );
    setSelected(null);
  }, [selected, detail.data, detail.isFetching, detail.isError]);
  const form = useForm({
    initialValues: { action: "preview" as "preview" | "confirm" | "reset" },
    validate: ({ action }) => {
      if (action === "preview")
        return file && /\.csv$/i.test(file.name)
          ? []
          : ["Debes seleccionar un archivo CSV para validar."];
      if (action === "confirm" && (!preview?.valid || !preview.batchId))
        return ["No hay un preview válido para confirmar."];
      return [];
    },
    onSubmit: async ({ action }) => {
      setSelected(null);
      if (action === "preview" && file) {
        setStatus("Validando archivo CSV…");
        // The previous draft remains cancellable if the new request fails.
        setPreview((current) =>
          current ? { ...current, valid: false } : current,
        );
        const result = await warehouse.api.closurePreview(file);
        setPreview(result);
        setHistoryOverride(result.history);
        setStatus(
          result.valid
            ? "Preview validado. Ya puedes confirmar el cierre."
            : "El CSV contiene errores y no se puede confirmar.",
        );
      } else if (action === "reset") {
        setStatus("Reiniciando carga del cierre…");
        if (preview?.batchId)
          await warehouse.api.closureBatch("cancel", preview.batchId);
        setPreview(null);
        setFile(null);
        setFileKey((current) => current + 1);
        setHistoryOverride(null);
        await bootstrap.refetch({ throwOnError: true });
        setStatus("Baseline cargado. Descarga la plantilla y valida el CSV.");
      } else if (action === "confirm" && preview?.valid && preview.batchId) {
        setStatus("Confirmando cierre de inventario…");
        const result = await warehouse.api.closureBatch(
          "confirm",
          preview.batchId,
        );
        setPreview({ ...preview, valid: false, batchId: null });
        setStatus(text(result.message) || "Cierre confirmado correctamente.");
        warehouse.saved(result, "Cierre confirmado correctamente.");
        if (Array.isArray(result.history))
          setHistoryOverride(records(result.history));
        else setHistoryOverride(null);
      }
    },
  });
  const data = preview ?? bootstrap.data;
  const busy = form.pending || (selected !== null && detail.isFetching);
  return {
    file,
    fileKey,
    preview,
    bootstrap,
    data,
    busy,
    pendingAction: form.pending ? form.values.action : null,
    history: historyOverride ?? bootstrap.data?.history ?? [],
    error: form.error || (selected !== null ? detail.error : null),
    errors: [...form.errors, ...(preview?.errors ?? [])],
    status:
      status ||
      (bootstrap.isSuccess
        ? "Baseline cargado. Descarga la plantilla y valida el CSV."
        : "Cargando contexto del cierre…"),
    canConfirm: !!preview?.valid && !!preview.batchId && !busy,
    selectFile: (next: File | null) => {
      if (busy) return;
      setFile(next);
      setPreview((current) =>
        current ? { ...current, valid: false } : current,
      );
      setStatus(
        next ? "Archivo seleccionado. Valida el preview para continuar." : "",
      );
    },
    submit: (action: "preview" | "confirm" | "reset") => {
      if (!busy) {
        form.setValues({ action });
        void form.submit({ action });
      }
    },
    selectHistory: (row: Row) => {
      if (busy) return;
      setStatus("Consultando detalle del cierre…");
      const id = recordId(row.id);
      if (selected === id) void detail.refetch();
      else setSelected(id);
    },
  };
}
