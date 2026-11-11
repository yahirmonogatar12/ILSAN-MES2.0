import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  FilterBar,
  Page,
  MasterDetailLayout,
  type FilterField,
} from "@/shared/ui";
import { ExportButton, ResultNotice, useInvoicing } from "./components";
import { PURCHASES, makeColumns } from "./columns";
import { EMPTY_ROWS, dateIssue, purchaseDefaults, text } from "./model";
import { PurchaseDetail } from "./PurchaseDetail";
import { UploadPanel } from "./UploadPanel";
import { PurchaseFiles } from "./PurchaseFiles";
import type { DataRow, PurchaseFilters } from "./types";
import "./module.css";
const fields: FilterField<PurchaseFilters>[] = [
  {
    key: "q",
    label: "Buscar",
    type: "search",
    placeholder: "Transacción, parte o proveedor",
  },
  {
    key: "tipo",
    label: "Tipo",
    type: "select",
    options: [
      { value: "", label: "Todos" },
      { value: "LG", label: "LG" },
      { value: "OVEN", label: "OVEN" },
    ],
  },
  {
    key: "estado",
    label: "Estado",
    type: "select",
    options: [
      { value: "", label: "Todos" },
      { value: "ABIERTA", label: "Abierta · almacén" },
      { value: "CERRADA", label: "Cerrada · histórico" },
      { value: "APLICADA", label: "Aplicada · recibida" },
    ],
  },
  { key: "fecha_inicio", label: "Desde", type: "date" },
  { key: "fecha_fin", label: "Hasta", type: "date" },
];
export default function PurchasesPage() {
  const auth = useInvoicing();
  const [defaults] = useState(purchaseDefaults);
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [error, setError] = useState("");
  const [gridVersion, setGridVersion] = useState(0);
  const [result, setResult] = useState<DataRow | null>(null);
  const [selected, setSelected] = useState<{
    number: string;
    kind: string;
  } | null>(null);
  const [files, setFiles] = useState(false);
  const query = useQuery({
    queryKey: auth.key("purchases", applied),
    queryFn: ({ signal }) => auth.purchases.list(applied, signal),
  });
  const initial = useQuery({
    queryKey: auth.key("purchase-initial"),
    queryFn: ({ signal }) => auth.purchases.initial(signal),
  });
  const records = query.data?.records || EMPTY_ROWS;
  const columns = useMemo(
    () =>
      makeColumns(PURCHASES, {
        numero_transaccion: (row) => (
          <Button
            variant="plain"
            className="text-link"
            onClick={() =>
              setSelected({
                number: text(row.numero_transaccion),
                kind: text(row.tipo),
              })
            }
          >
            {text(row.numero_transaccion)}
          </Button>
        ),
      }),
    [],
  );
  function submit() {
    const issue = dateIssue(draft);
    setError(issue);
    if (issue) return;
    void auth.client.invalidateQueries({
      queryKey: auth.key("purchases"),
      refetchType: "none",
    });
    setApplied({ ...draft });
    if (JSON.stringify(draft) === JSON.stringify(applied)) void query.refetch();
  }
  return (
    <Page
      className="invoicing-module invoicing-original"
      banner={<DemoBanner />}
    >
      <MasterDetailLayout
        sideLabel="Cargar lista de compras"
        side={
          initial.data ? (
            <UploadPanel
              kind="purchase"
              api={auth.purchases}
              initial={initial.data}
              disabled={initial.isFetching}
              onLoaded={(result) => {
                setResult(result);
                auth.saved("Carga de compras completada.");
              }}
            />
          ) : (
            <Card title="Cargar lista">
              <p className="invoicing-note">Verificando cargas iniciales…</p>
            </Card>
          )
        }
        list={
          <>
            <FilterBar
              fields={fields}
              values={draft}
              defaults={defaults}
              onChange={(patch) =>
                setDraft((previous) => ({ ...previous, ...patch }))
              }
              onSubmit={submit}
              onReset={() => {
                const next = purchaseDefaults();
                setGridVersion((previous) => previous + 1);
                setDraft(next);
                setApplied(next);
                setError("");
                void auth.client.invalidateQueries({
                  queryKey: auth.key("purchases"),
                });
              }}
              pending={query.isFetching}
            />
            <Card
              fill
              title="Lista de compras"
              icon={<ShoppingCart size={18} />}
              badge={query.data?.total ?? "—"}
              actions={
                <>
                  <Button
                    size="sm"
                    disabled={query.isFetching || initial.isFetching}
                    onClick={() => {
                      void query.refetch();
                      void initial.refetch();
                    }}
                  >
                    Actualizar
                  </Button>
                  <ExportButton
                    name="lista_compras"
                    specs={PURCHASES}
                    rows={records}
                  />
                  <Button size="sm" onClick={() => setFiles(true)}>
                    Ver Excel original
                  </Button>
                </>
              }
            >
              {error && (
                <Alert tone="warning" className="table-notice">
                  {error}
                </Alert>
              )}
              {initial.error && (
                <Alert tone="warning" className="table-notice">
                  No se pudo verificar la carga inicial: {initial.error.message}{" "}
                  <Button size="sm" onClick={() => void initial.refetch()}>
                    Reintentar
                  </Button>
                </Alert>
              )}
              <ResultNotice result={result} />
              {records.length >= 500 && (
                <Alert tone="info" className="table-notice">
                  El servidor devuelve hasta 500 transacciones. Aplica filtros
                  para consultar otro conjunto.
                </Alert>
              )}
              <DataGrid
                label="Transacciones de compra"
                rows={records}
                columns={columns}
                rowKey={(row) =>
                  `${text(row.tipo)}:${text(row.numero_transaccion)}`
                }
                loading={query.isPending}
                error={query.error}
                onRetry={() => void query.refetch()}
                layout="fixed"
                minWidth={820}
                itemLabel="transacciones"
                resetKey={JSON.stringify(applied)}
                key={gridVersion}
              />
            </Card>
          </>
        }
        detail={
          selected && (
            <PurchaseDetail
              key={`${selected.kind}:${selected.number}`}
              number={selected.number}
              type={selected.kind}
              onClose={() => setSelected(null)}
            />
          )
        }
      />
      {files && <PurchaseFiles onClose={() => setFiles(false)} />}
    </Page>
  );
}
