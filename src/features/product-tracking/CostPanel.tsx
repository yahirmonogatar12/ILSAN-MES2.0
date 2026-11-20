import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Card,
  DataGrid,
  EmptyState,
  FilterBar,
  type FilterField,
} from "@/shared/ui";
import { costColumns } from "./columns";
import { money, text } from "./model";
import { useTracking } from "./useTracking";
import type { CostView, Filters } from "./types";

const fields: FilterField<Filters>[] = [
  {
    key: "tipo",
    label: "Buscar por",
    type: "select",
    options: [
      { value: "pcb", label: "PCB (QR)" },
      { value: "lote", label: "Lote de producción" },
      { value: "etiqueta", label: "Etiqueta de material" },
    ],
  },
  {
    key: "valor",
    label: "Valor",
    type: "search",
    placeholder: "QR, lote o etiqueta...",
    autoFocus: true,
  },
  { key: "estimado", label: "Ver costo estimado (aparte)", type: "checkbox" },
];
const defaults: Filters = { tipo: "pcb", valor: "", estimado: "0" };

/** Verificación BOM 2.0 (tablas vb2_): material and cost by PCB, lot or label. Read only. */
export function CostPanel({ active }: { active: boolean }) {
  const { api, scope } = useTracking();
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState<Filters | null>(null);
  const [issue, setIssue] = useState("");
  const estimated = applied?.estimado === "1";
  const query = useQuery({
    queryKey: ["product-tracking", scope, "cost", applied],
    queryFn: ({ signal }) =>
      api.cost(applied!.tipo as CostView, applied!.valor, estimated, signal),
    enabled: active && !!applied,
  });
  const data = query.data;
  return (
    <div className="product-tracking-panel">
      <FilterBar
        fields={fields}
        values={draft}
        defaults={defaults}
        pending={query.isFetching}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }) as Filters)
        }
        onReset={() => {
          setDraft(defaults);
          setApplied(null);
          setIssue("");
        }}
        onSubmit={() => {
          const next = { ...draft, valor: draft.valor.trim() };
          setIssue(next.valor ? "" : "Escribe o escanea un valor.");
          if (!next.valor) return;
          if (JSON.stringify(next) === JSON.stringify(applied))
            void query.refetch();
          setApplied(next);
        }}
      />
      <Card fill label="Verificación BOM 2.0">
        {issue ? (
          <Alert tone="danger" className="product-tracking-message">
            {issue}
          </Alert>
        ) : (
          <Alert className="product-tracking-message">
            {data
              ? "Costo real: " +
                money(data.costoReal) +
                (estimated
                  ? " · Estimado (aparte): " + money(data.costoEstimado)
                  : "") +
                (data.sinCostoReal
                  ? " · " + data.sinCostoReal + " filas sin costo real"
                  : "")
              : "Fuente: Verificación BOM 2.0. Solo líneas ya calculadas."}
          </Alert>
        )}
        <DataGrid
          label="Material y costo"
          rows={applied ? data?.items || [] : []}
          columns={estimated ? costColumns.estimated : costColumns.real}
          rowKey={(row, index) =>
            [row.etapa, row.lot_no, row.item_no, row.bolsa, index]
              .map(text)
              .join(":")
          }
          minWidth={1200}
          layout="fixed"
          virtualRows={{ rowHeight: 32 }}
          className="product-tracking-table"
          resetKey={JSON.stringify(applied)}
          loading={!!applied && query.isPending}
          fetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          emptyState={
            <EmptyState
              title={applied ? "Sin registros" : "Escanea un PCB"}
              message={
                applied
                  ? "Sin material calculado para ese valor."
                  : "Escribe o escanea un QR, lote o etiqueta y pulsa Consultar."
              }
            />
          }
        />
      </Card>
    </div>
  );
}
