import { Plus, RefreshCw } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  ExportButton,
  FilterBar,
  Page,
  type FilterField,
} from "@/shared/ui";
import { ResultNotice } from "./components";
import { orderDefaults, text, PO_STATES, WO_STATES } from "./model";
import { OrderDialogs } from "./OrderDialogs";
import { useOrderColumns } from "./orderColumns";
import { useOrders } from "./useOrders";
import type { OrderFilters } from "./types";
import "./module.css";
export function OrdersPage({ kind }: { kind: "po" | "wo" }) {
  const state = useOrders(kind);
  const {
    initial,
    draft,
    setDraft,
    applied,
    setApplied,
    error,
    setError,
    result,
    setResult,
    selected,
    setSelected,
    setDialog,
    list,
    records,
    exported,
    ready,
    submit,
  } = state;
  const columns = useOrderColumns(state);
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
      <OrderDialogs state={state} />
    </Page>
  );
}
export default function ShippingPage() {
  return <OrdersPage kind="po" />;
}
