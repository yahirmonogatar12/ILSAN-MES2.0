import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { usePermission } from "@/core/auth/usePermission";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  Card,
  CheckboxField,
  DataGrid,
  ExportButton,
  FilterBar,
  Page,
  TableRowActions,
  type FilterField,
} from "@/shared/ui";
import {
  FormDialog,
  ResultNotice,
  exportRows,
  usePlanning,
} from "./components";
import { ImportDialog } from "./ImportDialog";
import {
  makeColumns,
  orderDefaults,
  PO_SPECS,
  rangeIssue,
  text,
  today,
  WO_SPECS,
} from "./model";
import type { Action, Field, OrderFilters, Row } from "./types";
import "./module.css";
const PO_STATES = [
    "PLAN",
    "PREPARACION",
    "EMBARCADO",
    "EN_TRANSITO",
    "ENTREGADO",
  ],
  WO_STATES = ["CREADA", "PLANIFICADA", "EN_PRODUCCION", "CERRADA"];
type Dialog =
  | { type: "new" | "edit" | "remove" | "state" | "linked-wo"; row?: Row }
  | { type: "import" }
  | { type: "bulk" }
  | null;
export function OrdersPage({ kind }: { kind: "po" | "wo" }) {
  const canCreateWO = usePermission({
    pagina: "LISTA_CONTROLDEPRODUCCION",
    seccion: "Control de plan de produccion",
    boton: "Crear Plan de produccion",
  });
  const auth = usePlanning(),
    [initial] = useState(orderDefaults),
    [draft, setDraft] = useState(initial),
    [applied, setApplied] = useState(initial),
    [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null),
    [result, setResult] = useState<Row | null>(null),
    [selected, setSelected] = useState<Set<number>>(new Set());
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
  const columns = useMemo(
    () => [
      ...(kind === "wo"
        ? [
            {
              id: "selection",
              header: "SELECCIÓN",
              filterable: false,
              width: "5%",
              cell: (row: Row) => (
                <CheckboxField
                  aria-label={`Seleccionar ${text(row.codigo_wo)}`}
                  checked={selected.has(Number(row.id))}
                  disabled={
                    row.estado !== "CREADA" ||
                    !Number(row.id) ||
                    list.isFetching
                  }
                  onChange={(event) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (event.target.checked) next.add(Number(row.id));
                      else next.delete(Number(row.id));
                      return next;
                    })
                  }
                />
              ),
            },
          ]
        : []),
      ...makeColumns(specs).map((col) => ({
        ...col,
        width: `${parseFloat(String(col.width)) * (kind === "wo" ? 0.84 : 0.9)}%`,
      })),
      {
        id: "actions",
        header: "ACCIONES",
        filterable: false,
        width: kind === "wo" ? "11%" : "10%",
        cell: (row: Row) =>
          kind === "po" ? (
            canCreateWO.data && !canCreateWO.isError ? (
              <Button
                size="sm"
                disabled={list.isFetching}
                onClick={() => setDialog({ type: "linked-wo", row })}
              >
                Crear WO
              </Button>
            ) : null
          ) : (
            <TableRowActions
              actions={[
                ...(row.estado === "CREADA"
                  ? [
                      {
                        id: "edit",
                        label: `Editar ${text(row.codigo_wo)}`,
                        icon: <Pencil size={15} />,
                        disabled: list.isFetching || list.isError,
                        onClick: () => setDialog({ type: "edit", row }),
                      },
                      {
                        id: "delete",
                        label: `Eliminar ${text(row.codigo_wo)}`,
                        icon: <Trash2 size={15} />,
                        disabled: list.isFetching || list.isError,
                        tone: "danger" as const,
                        onClick: () => setDialog({ type: "remove", row }),
                      },
                    ]
                  : []),
                {
                  id: "state",
                  label: `Cambiar estado ${text(row.codigo_wo)}`,
                  icon: <RefreshCw size={15} />,
                  disabled: list.isFetching || list.isError,
                  onClick: () => setDialog({ type: "state", row }),
                },
              ]}
            />
          ),
      },
    ],
    [
      kind,
      specs,
      selected,
      list.isFetching,
      canCreateWO.data,
      canCreateWO.isError,
    ],
  );
  const fields: FilterField<OrderFilters>[] = [
    { key: "fecha_desde", label: "Fecha desde", type: "date" },
    { key: "fecha_hasta", label: "Fecha hasta", type: "date" },
    {
      key: "estado",
      label: "Estado",
      type: "select",
      options: [
        { value: "", label: "Todos" },
        ...(kind === "po" ? PO_STATES : WO_STATES).map((value) => ({
          value,
          label: value,
        })),
      ],
    },
    ...(kind === "po"
      ? [
          {
            key: "cliente",
            label: "Cliente",
            type: "select",
            options: [
              { value: "", label: "Todos" },
              { value: "LG_REFRIS", label: "LG_REFRIS" },
              { value: "LG_ESTUFAS", label: "LG_ESTUFAS" },
            ],
          } as FilterField<OrderFilters>,
        ]
      : [
          {
            key: "modelo",
            label: "Modelo",
            type: "search",
          } as FilterField<OrderFilters>,
        ]),
  ];
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
  const row = dialog && "row" in dialog ? dialog.row : undefined;
  let formFields: Field[] = [],
    values: Row = {},
    operation: Action = "create-wo",
    title = "";
  if (dialog?.type === "new" && kind === "po") {
    title = "Registrar Purchase Order";
    operation = "create-po";
    values = {
      nombre_po: "",
      fecha_registro: today(),
      modelo: "",
      cliente: "LG_REFRIS",
      proveedor: "",
      total_cantidad_entregada: "",
      cantidad_entregada: "0",
      fecha_entrega: "",
      codigo_entrega: "",
      estado: "PLAN",
    };
    formFields = [
      { key: "nombre_po", label: "Nombre de PO", required: true },
      {
        key: "fecha_registro",
        label: "Fecha de registro",
        type: "date",
        required: true,
      },
      {
        key: "modelo",
        label: "Modelo",
        required: true,
        suggestions: models.data,
      },
      {
        key: "cliente",
        label: "Cliente",
        required: true,
        type: "select",
        options: [
          { value: "LG_REFRIS", label: "LG_REFRIS" },
          { value: "LG_ESTUFAS", label: "LG_ESTUFAS" },
        ],
      },
      { key: "proveedor", label: "Proveedor" },
      {
        key: "total_cantidad_entregada",
        label: "Cantidad planeada",
        type: "number",
        min: 0,
        step: 1,
        required: true,
      },
      {
        key: "cantidad_entregada",
        label: "Cantidad entregada",
        type: "number",
        min: 0,
        step: 1,
      },
      { key: "fecha_entrega", label: "Fecha de entrega", type: "date" },
      { key: "codigo_entrega", label: "Código de entrega" },
    ];
  } else if (dialog && ["new", "linked-wo", "edit"].includes(dialog.type)) {
    const editing = dialog.type === "edit";
    title = editing
      ? `Editar WO · ${text(row?.codigo_wo)}`
      : dialog.type === "linked-wo"
        ? `Crear WO vinculada a ${text(row?.codigo_po)}`
        : "Registrar Work Order";
    operation = editing ? "update-wo" : "create-wo";
    values = {
      codigo_wo: text(row?.codigo_wo),
      modelo: text(row?.codigo_modelo ?? row?.modelo),
      codigo_po: text(row?.codigo_po),
      cantidad_planeada: text(
        row?.cantidad_planeada ?? row?.total_cantidad_entregada,
      ),
      fecha_operacion: today(),
      usuario_creador: auth.profile?.username ?? "",
    };
    formFields = [
      ...(editing
        ? [{ key: "codigo_wo", label: "Código WO", readOnly: true }]
        : []),
      {
        key: "modelo",
        label: "Modelo",
        required: true,
        suggestions: models.data,
      },
      {
        key: "cantidad_planeada",
        label: "Cantidad planeada",
        type: "number",
        required: true,
        min: 1,
        step: 1,
      },
      { key: "codigo_po", label: "Código PO" },
      ...(!editing
        ? [
            {
              key: "fecha_operacion",
              label: "Fecha de operación",
              type: "date" as const,
              required: true,
            },
          ]
        : []),
    ];
  } else if (dialog?.type === "state") {
    title = `Cambiar estado · ${text(row?.codigo_wo)}`;
    operation = "state-wo";
    values = {
      codigo_wo: row?.codigo_wo,
      estado: row?.estado,
      modificador: auth.profile?.username,
    };
    formFields = [
      {
        key: "estado",
        label: "Estado",
        type: "select",
        options: WO_STATES.map((value) => ({ value, label: value })),
      },
    ];
  } else if (dialog?.type === "remove") {
    title = `Eliminar WO · ${text(row?.codigo_wo)}`;
    operation = "delete-wo";
    values = { codigo_wo: row?.codigo_wo };
  } else if (dialog?.type === "bulk") {
    title = "Crear plan con WO seleccionadas";
    operation = "import-wos";
    values = { import_date: today(), wo_ids: [...selected] };
    formFields = [
      {
        key: "import_date",
        label: "Fecha de operación",
        type: "date",
        required: true,
      },
    ];
  }
  const ready = !!list.data && !list.isError && !list.isFetching;
  return (
    <Page className="production-planning-module" banner={<DemoBanner />}>
      <FilterBar
        actions={
          <>
            <Button
              size="sm"
              icon={<RefreshCw size={15} />}
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              Actualizar
            </Button>
            <ExportButton
              title={
                kind === "wo"
                  ? "Exporta todas las WO del período; los filtros de estado/modelo y de columna no modifican ese Excel."
                  : "Exporta todas las PO de la consulta general cargada."
              }
              size="sm"
              loading={exported.isPending}
              disabled={!ready || !records.length}
              onClick={() => exported.mutate()}
            />
            {kind === "wo" && (
              <>
                <Button
                  size="sm"
                  disabled={!ready}
                  onClick={() =>
                    setSelected(
                      selected.size
                        ? new Set()
                        : new Set(
                            records
                              .filter(
                                (item) =>
                                  item.estado === "CREADA" &&
                                  Number(item.id) > 0,
                              )
                              .map((item) => Number(item.id)),
                          ),
                    )
                  }
                >
                  {selected.size ? "Limpiar selección" : "Seleccionar creadas"}
                </Button>
                <Button size="sm" onClick={() => setDialog({ type: "import" })}>
                  Importar Excel
                </Button>
                <Button
                  size="sm"
                  disabled={!ready || !selected.size}
                  onClick={() => setDialog({ type: "bulk" })}
                >
                  Crear plan ({selected.size})
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="success"
              icon={<Plus size={15} />}
              onClick={() => setDialog({ type: "new" })}
            >
              Registrar {kind.toUpperCase()}
            </Button>
          </>
        }
        fields={fields}
        values={draft}
        defaults={initial}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={submit}
        onReset={() => {
          const next = orderDefaults();
          setDraft(next);
          setApplied(next);
          setError("");
          setSelected(new Set());
        }}
        pending={list.isFetching}
      />
      <Card fill label={kind === "po" ? "Purchase Orders" : "Work Orders"}>
        {(error || exported.error) && (
          <Alert tone="warning" className="table-notice">
            {error || exported.error?.message}
          </Alert>
        )}
        <ResultNotice result={result} onClose={() => setResult(null)} />
        <DataGrid
          label={kind === "po" ? "Purchase Orders" : "Work Orders"}
          rows={records}
          columns={columns}
          rowKey={(item) =>
            text(kind === "po" ? item.codigo_po : item.codigo_wo)
          }
          layout="fixed"
          minWidth={kind === "po" ? 1250 : 1100}
          loading={list.isPending}
          error={list.error}
          onRetry={() => void list.refetch()}
          resetKey={JSON.stringify(applied)}
        />
      </Card>
      {dialog &&
        dialog.type !== "import" &&
        (dialog.type !== "linked-wo" ||
          (canCreateWO.data && !canCreateWO.isError)) && (
          <FormDialog
            title={title}
            description={
              dialog.type === "remove"
                ? "Se eliminará esta WO. Solo se permite eliminar órdenes en estado CREADA."
                : dialog.type === "bulk"
                  ? `Se generarán lotes para ${selected.size} órdenes. Los duplicados y errores se mostrarán en el resultado.`
                  : undefined
            }
            fields={formFields}
            initial={values}
            label={
              dialog.type === "remove"
                ? "Eliminar WO"
                : dialog.type === "bulk"
                  ? "Confirmar creación de plan"
                  : "Guardar"
            }
            onClose={() => setDialog(null)}
            onDone={done}
            onSubmit={(data) =>
              auth.api.action(operation, {
                ...data,
                ...("cantidad_planeada" in data
                  ? { cantidad_planeada: Number(data.cantidad_planeada) }
                  : {}),
                ...("total_cantidad_entregada" in data
                  ? {
                      total_cantidad_entregada: Number(
                        data.total_cantidad_entregada,
                      ),
                      cantidad_entregada: Number(data.cantidad_entregada),
                    }
                  : {}),
              })
            }
          />
        )}
      {dialog?.type === "import" && (
        <ImportDialog
          kind="wo-excel"
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
    </Page>
  );
}
export default function ShippingPage() {
  return <OrdersPage kind="po" />;
}
