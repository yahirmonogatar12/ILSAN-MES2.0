import { actionPayloads } from "./requests";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  ActionGroup,
  Alert,
  Button,
  Card,
  DataGrid,
  ExportButton,
  FilterBar,
  Page,
  TableRowActions,
  type FilterField,
} from "@/shared/ui";
import {
  FormDialog,
  ReportDialog,
  ResultNotice,
} from "./components";
import { exportRows } from "./exportRows";
import { usePlanning } from "./usePlanning";
import {
  LOT_SPECS,
  makeColumns,
  numeric,
  rows,
  text,
  today,
  TURNOS,
  validDate,
} from "./model";
import type { Action, Field, Row } from "./types";
import "./module.css";
const GENERATE = [
  { id: "generate", label: "Generar desde proyección" },
  { id: "generate-faltantes", label: "Generar faltantes sin línea" },
  { id: "generate-schedule", label: "Generar desde schedule" },
  { id: "acomodar-ia", label: "Acomodar con IA" },
  { id: "confirm-lots", label: "Confirmar día" },
] as const;
type Dialog =
  | { type: "action"; action: Action }
  | { type: "field"; field: string; row: Row }
  | { type: "delete"; row: Row }
  | { type: "add" | "config" | "omitted" }
  | null;
export default function ProjectedPage() {
  const auth = usePlanning(),
    [initial] = useState(() => ({ fecha: today() })),
    [draft, setDraft] = useState(initial),
    [applied, setApplied] = useState(initial),
    [dialog, setDialog] = useState<Dialog>(null),
    [error, setError] = useState("");
  const [result, setResult] = useState<Row | null>(null);
  const query = useQuery({
    queryKey: auth.key("lots", applied.fecha),
    queryFn: ({ signal }) => auth.api.lots(applied.fecha, signal),
  });
  const records = useMemo(
    () => (query.data ? rows(query.data.lotes) : []),
    [query.data],
  );
  const lineas =
    query.data && Array.isArray(query.data.lineas_activas)
      ? query.data.lineas_activas.map(text)
      : [];
  const summary =
    query.data && Array.isArray(query.data.lineas)
      ? rows(query.data.lineas)
      : [];
  const writable = !!query.data && !query.isError && !query.isFetching;
  const columns = useMemo(
    () => [
      ...makeColumns(LOT_SPECS, {
        lot_no: (row) => text(row.lot_no) || "Sin numerar",
        ...Object.fromEntries(
          ["qty_plan", "linea", "turno", "fisico", "comentario"].map(
            (field) => [
              field,
              (row: Row) => {
                const allowed =
                  row.status === "PENDIENTE" ||
                  ["fisico", "comentario"].includes(field);
                return allowed ? (
                  <Button
                    variant="plain"
                    className="production-planning-cell"
                    disabled={!writable}
                    title={
                      field === "qty_plan" && row.warn_pack
                        ? "La cantidad no es múltiplo del empaque."
                        : undefined
                    }
                    aria-label={`Editar ${field} ${text(row.lot_no ?? row.part_no)}`}
                    onClick={() => setDialog({ type: "field", field, row })}
                  >
                    {text(row[field]) || "—"}
                  </Button>
                ) : (
                  text(row[field])
                );
              },
            ],
          ),
        ),
        falta: (row) => (
          <span
            className={
              Number(row.falta) < 0 ? "production-planning-negative" : undefined
            }
          >
            {numeric(row.falta)}
          </span>
        ),
      }).map((column) => ({
        ...column,
        width: `${parseFloat(String(column.width)) * 0.94}%`,
      })),
      {
        id: "actions",
        header: "ACCIONES",
        width: "6%",
        filterable: false,
        cell: (row: Row) => (
          <TableRowActions
            actions={[
              {
                id: "delete",
                label: `${row.status === "CONFIRMADO" ? "Cancelar" : "Eliminar"} lote ${text(row.lot_no ?? row.part_no)}`,
                icon: <Trash2 size={15} />,
                tone: "danger",
                onClick: () => setDialog({ type: "delete", row }),
              },
            ]}
          />
        ),
      },
    ],
    [writable],
  );
  const exported = useMutation({
    mutationFn: () =>
      exportRows(`Plan_proyectado_${applied.fecha}`, LOT_SPECS, records),
  });
  const fields: FilterField<{ fecha: string }>[] = [
    { key: "fecha", label: "Fecha del plan", type: "date" },
  ];
  const omitted =
    result && Array.isArray(result.no_incluidos)
      ? result.no_incluidos.map((item) =>
          typeof item === "object" && item
            ? (item as Row)
            : { motivo: text(item) },
        )
      : [];
  let formFields: Field[] = [],
    values: Row = { fecha: applied.fecha },
    action: Action = "generate",
    title = "",
    description: string | undefined;
  if (dialog?.type === "action") {
    action = dialog.action;
    title =
      GENERATE.find((item) => item.id === action)?.label ?? "Actualizar plan";
    description = action.startsWith("generate")
      ? "Se reemplazarán los lotes PENDIENTES de la fecha; los lotes confirmados se conservan. Revisa el resultado antes de confirmar el día."
      : action === "confirm-lots"
        ? "Se numerarán los lotes pendientes y sus cantidades se agregarán al schedule. El servidor comprobará la capacidad de las líneas."
        : "Se asignarán líneas a los lotes pendientes con las reglas y capacidad del servidor.";
  }
  if (dialog?.type === "add") {
    title = "Agregar lote manual";
    action = "add-lot";
    values = { fecha: applied.fecha, part_no: "", qty: "", linea: "" };
    formFields = [
      { key: "part_no", label: "Número de parte", required: true },
      {
        key: "qty",
        label: "Cantidad",
        required: true,
        type: "number",
        min: 1,
        step: 1,
      },
      { key: "linea", label: "Línea (opcional)", suggestions: lineas },
    ];
  }
  if (dialog?.type === "config") {
    title = "Líneas activas";
    action = "config-lines";
    values = { lineas: lineas.join(",") };
    formFields = [
      { key: "lineas", label: "Líneas separadas por coma", required: true },
    ];
    description =
      "Los cambios de líneas se usarán en las siguientes generaciones de lotes.";
  }
  if (dialog?.type === "delete") {
    title =
      dialog.row.status === "CONFIRMADO"
        ? "Cancelar lote confirmado"
        : "Eliminar lote pendiente";
    action = "delete-lot";
    values = { id: dialog.row.id };
    description =
      dialog.row.status === "CONFIRMADO"
        ? "El lote se cancelará y su cantidad se restará del schedule. Se conserva su historial."
        : "Se eliminará este lote pendiente.";
  }
  if (dialog?.type === "field") {
    const field = dialog.field;
    title = `Editar ${field.replaceAll("_", " ")} · ${text(dialog.row.lot_no ?? dialog.row.part_no)}`;
    action = "update-lot";
    values = { id: dialog.row.id, field, value: dialog.row[field] ?? "" };
    formFields = [
      field === "turno"
        ? {
            key: "value",
            label: "Turno",
            type: "select",
            options: TURNOS.map((value) => ({ value, label: value })),
          }
        : field === "linea"
          ? { key: "value", label: "Línea", suggestions: lineas }
          : field === "comentario"
            ? { key: "value", label: "Comentario", type: "textarea" }
            : {
                key: "value",
                label:
                  field === "fisico" ? "Cantidad física" : "Cantidad planeada",
                type: "number",
                step: 1,
                min: field === "fisico" ? 0 : 1,
                required: field === "qty_plan",
              },
    ];
  }
  function done(response: Row) {
    setDialog(null);
    setResult(response);
    auth.saved();
  }
  return (
    <Page className="production-planning-module" banner={<DemoBanner />}>
      <FilterBar
        actions={
          <>
            <Button
              size="sm"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              disabled={!writable || !records.length}
              loading={exported.isPending}
              onClick={() => exported.mutate()}
            />
            <ActionGroup
              label="Acciones del plan"
              actions={[
                {
                  id: "lines",
                  label: "Líneas activas",
                  disabled: !writable,
                  onClick: () => setDialog({ type: "config" }),
                },
                {
                  id: "add",
                  label: "Agregar parte",
                  disabled: !writable,
                  onClick: () => setDialog({ type: "add" }),
                },
                ...GENERATE.map((item) => ({
                  ...item,
                  disabled: !writable,
                  onClick: () => setDialog({ type: "action", action: item.id }),
                })),
              ]}
            />
          </>
        }
        fields={fields}
        values={draft}
        defaults={initial}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={() => {
          if (!validDate(draft.fecha)) {
            setError("Selecciona la fecha del plan.");
            return;
          }
          setError("");
          setApplied({ ...draft });
          if (draft.fecha === applied.fecha) void query.refetch();
        }}
        onReset={() => {
          const next = { fecha: today() };
          setDraft(next);
          setApplied(next);
          setError("");
        }}
        pending={query.isFetching}
      />
      <Card fill label="Plan proyectado · Lotes del día">
        {(error || exported.error) && (
          <Alert tone="warning" className="table-notice">
            {error || exported.error?.message}
          </Alert>
        )}
        <ResultNotice result={result} onClose={() => setResult(null)} />
        {omitted.length > 0 && (
          <div className="production-planning-summary">
            <Button size="sm" onClick={() => setDialog({ type: "omitted" })}>
              Ver partes no incluidas ({omitted.length})
            </Button>
          </div>
        )}
        {summary.length > 0 && (
          <div
            className="production-planning-summary"
            aria-label="Capacidad por línea"
          >
            {summary.map((line, index) => (
              <span
                key={index}
                className={
                  line.excede ? "production-planning-negative" : undefined
                }
              >
                {text(line.linea)}: {numeric(line.horas)} /{" "}
                {numeric(line.horas_max)} h · {numeric(line.lotes)} lotes
              </span>
            ))}
          </div>
        )}
        <DataGrid
          label="Lotes del plan proyectado"
          rows={records}
          columns={columns}
          rowKey={(row) => Number(row.id)}
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          minWidth={1450}
          layout="fixed"
          resetKey={applied.fecha}
        />
      </Card>
      {dialog && dialog.type !== "omitted" && (
        <FormDialog
          title={title}
          description={description}
          fields={formFields}
          initial={values}
          onClose={() => setDialog(null)}
          onDone={done}
          label={
            dialog.type === "action"
              ? "Confirmar"
              : dialog.type === "delete"
                ? "Confirmar eliminación o cancelación"
                : "Guardar"
          }
          onSubmit={(data) => {
            const payload = { ...data };
            if (action === "add-lot") payload.qty = Number(payload.qty);
            if (
              action === "update-lot" &&
              dialog.type === "field" &&
              ["qty_plan", "fisico"].includes(dialog.field)
            )
              payload.value =
                payload.value === "" ? null : Number(payload.value);
            return auth.api.action(action, actionPayloads[action](payload));
          }}
        />
      )}
      {dialog?.type === "omitted" && (
        <ReportDialog
          title="Partes no incluidas en la generación"
          records={omitted}
          onClose={() => setDialog(null)}
        />
      )}
    </Page>
  );
}
