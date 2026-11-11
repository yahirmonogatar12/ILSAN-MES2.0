import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, RefreshCw, Trash2 } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  FilterBar,
  Page,
  MasterDetailLayout,
  TableRowActions,
  type FilterField,
} from "@/shared/ui";
import { ActionDialog, ExportButton, useInvoicing } from "./components";
import {
  INVOICES,
  INVOICES_EXPORT,
  makeColumns,
  reserveWidth,
} from "./columns";
import { EMPTY_ROWS, amount, dateIssue, invoiceDefaults, text } from "./model";
import { InvoiceDetail } from "./InvoiceDetail";
import { InvoiceFile } from "./InvoiceFile";
import { UploadPanel } from "./UploadPanel";
import type { DataRow, InvoiceFilters, InvoiceScope } from "./types";
import "./module.css";
export function InvoicesPage({ scope }: { scope: InvoiceScope }) {
  const auth = useInvoicing();
  const [defaults] = useState(invoiceDefaults);
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [error, setError] = useState("");
  const [gridVersion, setGridVersion] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{
    type: "file" | "remove";
    id: number;
    row?: DataRow;
  } | null>(null);
  const query = useQuery({
    queryKey: auth.key("invoices", scope, applied),
    queryFn: ({ signal }) => auth.invoices.list(scope, applied, signal),
  });
  const records = query.data?.records || EMPTY_ROWS;
  const fields: FilterField<InvoiceFilters>[] = [
    {
      key: "q",
      label: "Buscar",
      type: "search",
      placeholder: "Invoice, tipo o archivo",
    },
    {
      key: "estado",
      label: "Estado",
      type: "select",
      options: [
        { value: "", label: "Todos" },
        { value: "PENDIENTES", label: "Solo abiertos · todas las fechas" },
        ...[
          "VALIDADA",
          "CON_DIFERENCIAS",
          "PARCIALMENTE_APLICADA",
          "APLICADA",
          "CANCELADA",
        ].map((value) => ({ value, label: value })),
      ],
    },
    ...(draft.estado === "PENDIENTES"
      ? []
      : ([
          { key: "fecha_inicio", label: "Desde", type: "date" },
          { key: "fecha_fin", label: "Hasta", type: "date" },
        ] as FilterField<InvoiceFilters>[])),
  ];
  const columns = useMemo(
    () => [
      ...reserveWidth(
        makeColumns(INVOICES, {
          numero_invoice: (row) => (
            <Button
              variant="plain"
              className="text-link"
              onClick={() => setSelected(Number(row.id))}
            >
              {text(row.numero_invoice)}
            </Button>
          ),
        }),
        18,
      ),
      {
        id: "file",
        header: "EXCEL",
        filterable: false,
        width: "12%",
        cell: (row: DataRow) =>
          row.archivo_ruta || row.archivo_nombre ? (
            <Button
              size="sm"
              onClick={() => setDialog({ type: "file", id: Number(row.id) })}
            >
              Ver Excel
            </Button>
          ) : (
            "—"
          ),
      },
      {
        id: "actions",
        header: "ACCIONES",
        filterable: false,
        width: "6%",
        cell: (row: DataRow) =>
          amount(row.links_activos) === 0 ? (
            <TableRowActions
              actions={[
                {
                  id: "remove",
                  label: `Eliminar invoice ${text(row.numero_invoice)}`,
                  icon: <Trash2 size={15} />,
                  tone: "danger",
                  onClick: () =>
                    setDialog({ type: "remove", id: Number(row.id), row }),
                },
              ]}
            />
          ) : (
            "—"
          ),
      },
    ],
    [],
  );
  const template = useMutation({
    mutationFn: () =>
      exportSpreadsheet(`plantilla_invoice_${scope.toLowerCase()}.xlsx`, [
        {
          name: "INVOICE(CONVERTED)",
          rows: [
            ["NUMERO DE INVOICE"],
            scope === "EMBARQUES"
              ? ["PART SYS", "ITEM", "QTY", "UNIDAD", "COSTO", "TOTAL"]
              : [
                  "TARIMA",
                  "PART NO",
                  "PART SYS",
                  "ITEM",
                  "QTY",
                  "UNIDAD",
                  "COSTO",
                  "TOTAL",
                ],
          ],
        },
      ]),
  });
  function submit() {
    const issue = dateIssue(draft);
    setError(issue);
    if (issue) return;
    void auth.client.invalidateQueries({
      queryKey: auth.key("invoices", scope),
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
        sideLabel="Cargar invoice"
        side={
          <UploadPanel
            kind="invoice"
            scope={scope}
            api={auth.invoices}
            template={
              <Button
                size="sm"
                loading={template.isPending}
                onClick={() => template.mutate()}
              >
                Descargar plantilla
              </Button>
            }
            onLoaded={(result) => {
              auth.saved("Invoice cargada.");
              if (Number(result.invoice_id) > 0)
                setSelected(Number(result.invoice_id));
            }}
          />
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
                const next = invoiceDefaults();
                setGridVersion((previous) => previous + 1);
                setDraft(next);
                setApplied(next);
                setError("");
                void auth.client.invalidateQueries({
                  queryKey: auth.key("invoices", scope),
                });
              }}
              pending={query.isFetching}
            />
            <Card
              fill
              title={
                scope === "ALMACEN" ? "Invoice Almacén" : "Invoice Embarques"
              }
              icon={<FileSpreadsheet size={18} />}
              badge={query.data?.total ?? "—"}
              actions={
                <>
                  <Button
                    size="sm"
                    icon={<RefreshCw size={15} />}
                    disabled={query.isFetching}
                    onClick={() => void query.refetch()}
                  >
                    Actualizar
                  </Button>
                  <ExportButton
                    name={`invoices_${scope.toLowerCase()}`}
                    specs={INVOICES_EXPORT}
                    rows={records}
                  />
                </>
              }
            >
              {(error || template.error) && (
                <Alert tone="warning" className="table-notice">
                  {error || template.error?.message}
                </Alert>
              )}
              {records.length >= 300 && (
                <Alert tone="info" className="table-notice">
                  Cada consulta del servidor devuelve hasta 300 invoices. Usa la
                  búsqueda o el estado para acotar los resultados.
                </Alert>
              )}
              <DataGrid
                label={
                  scope === "ALMACEN"
                    ? "Invoices Almacén"
                    : "Invoices Embarques"
                }
                rows={records}
                columns={columns}
                rowKey={(row) => Number(row.id)}
                loading={query.isPending}
                error={query.error}
                onRetry={() => void query.refetch()}
                minWidth={820}
                layout="fixed"
                itemLabel="invoices"
                resetKey={JSON.stringify(applied)}
                key={gridVersion}
              />
            </Card>
          </>
        }
        detail={
          selected !== null && (
            <InvoiceDetail
              key={selected}
              scope={scope}
              id={selected}
              onClose={() => setSelected(null)}
            />
          )
        }
      />
      {dialog?.type === "file" && (
        <InvoiceFile
          scope={scope}
          id={dialog.id}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "remove" && (
        <ActionDialog
          title="Eliminar invoice"
          message={`Se eliminará la invoice ${text(dialog.row?.numero_invoice)}, sus líneas y su archivo. Esta operación no se puede deshacer y el servidor rechazará invoices con vínculos activos.`}
          onConfirm={() => auth.invoices.remove(scope, dialog.id)}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            if (selected === dialog.id) setSelected(null);
            auth.saved("Invoice eliminada.");
          }}
        />
      )}
    </Page>
  );
}
