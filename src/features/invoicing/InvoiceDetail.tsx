import { Activity, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, RefreshCw } from "lucide-react";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import {
  Button,
  ActionGroup,
  DataGrid,
  DialogBody,
  DetailPanel,
  DialogFooter,
  ErrorState,
  Loading,
  Modal,
  TabBar,
  TableRowActions,
} from "@/shared/ui";
import {
  ActionDialog,
  ExportButton,
  ResultNotice,
} from "./components";
import { useInvoicing } from "./useInvoicing";
import {
  LINES,
  LINKS,
  LOTS,
  MANUAL,
  PACKING,
  makeColumns,
  reserveWidth,
  PACKING_EXPORT,
  LINKS_EXPORT,
  PACKING_LOTS_EXPORT,
} from "./columns";
import { amount, enabled, rows, text } from "./model";
import { InvoiceFile } from "./InvoiceFile";
import { LineForm } from "./LineForm";
import { PalletLink } from "./PalletLink";
import type { DataRow, InvoiceAction, InvoiceScope } from "./types";
function packingSheets(panel: { id: string; rows: DataRow[] }) {
  return panel.id === "packing"
    ? [
        {
          name: "Detallado",
          specs: PACKING_LOTS_EXPORT,
          rows: panel.rows.flatMap((packing) =>
            Array.isArray(packing.lotes)
              ? rows(packing.lotes).map((lote) => ({
                  ...lote,
                  packing_line_no: packing.line_no,
                  packing_pallet: packing.pallet_no,
                  packing_part: packing.numero_parte_sistema,
                  packing_quantity: packing.cantidad_packing,
                }))
              : [],
          ),
        },
      ]
    : [];
}
type Dialog =
  | { type: "file" }
  | { type: "action"; action: InvoiceAction }
  | { type: "edit" | "delete" | "manual" | "link" | "lots"; row: DataRow };
export function InvoiceDetail({
  scope,
  id,
  onClose,
}: {
  scope: InvoiceScope;
  id: number;
  onClose: () => void;
}) {
  const compact = useMediaQuery("(max-width: 700px)");
  const auth = useInvoicing();
  const detail = useQuery({
    queryKey: auth.key("invoice", scope, id),
    queryFn: ({ signal }) => auth.invoices.detail(scope, id, signal),
  });
  const [tab, setTab] = useState("lines");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [result, setResult] = useState<DataRow | null>(null);
  const data = detail.data;
  const writable =
    !!data &&
    !detail.isError &&
    !detail.isFetching &&
    data.invoice.estado !== "CANCELADA";
  const done = (result: DataRow) => {
    setDialog(null);
    setResult(result);
    auth.saved();
  };
  const lineColumns = useMemo(
    () => [
      ...reserveWidth(makeColumns(LINES), 9),
      {
        id: "actions",
        header: "ACCIONES",
        filterable: false,
        width: "9%",
        cell: (row: DataRow) =>
          writable && amount(row.links_activos) === 0 ? (
            <TableRowActions
              actions={[
                {
                  id: "edit",
                  label: `Editar línea ${text(row.line_no)}`,
                  icon: <Pencil size={15} />,
                  onClick: () => setDialog({ type: "edit", row }),
                },
                {
                  id: "delete",
                  label: `Eliminar línea ${text(row.line_no)}`,
                  icon: <Trash2 size={15} />,
                  tone: "danger" as const,
                  onClick: () => setDialog({ type: "delete", row }),
                },
              ]}
            />
          ) : (
            "—"
          ),
      },
    ],
    [writable],
  );
  const packingColumns = useMemo(
    () =>
      makeColumns(
        scope === "EMBARQUES"
          ? PACKING.filter((spec) => !spec[0].startsWith("pallet_no"))
          : PACKING,
        {
          line_no: (row) => (
            <>
              {text(row.line_no) || "—"}
              {Array.isArray(row.lotes) && row.lotes.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDialog({ type: "lots", row })}
                >
                  Ver lotes ({row.lotes.length})
                </Button>
              )}
            </>
          ),
          estado_match: (row) => (
            <span
              className={
                row.estado_match === "DIFERENCIA_PALLET" ||
                amount(row.cantidad_exceso) > 0
                  ? "invoicing-warning"
                  : undefined
              }
            >
              {row.confirmacion_manual_estado === "RECIBIDO"
                ? "RECIBIDO"
                : text(row.estado_match)}
              {amount(row.cantidad_exceso) > 0 &&
                ` · EXCESO +${text(row.cantidad_exceso)}`}
            </span>
          ),
          mensaje_match: (row) =>
            scope === "ALMACEN" &&
            writable &&
            row.estado_match === "DIFERENCIA_PALLET" ? (
              <Button
                size="sm"
                onClick={() => setDialog({ type: "link", row })}
              >
                Confirmar y vincular
              </Button>
            ) : scope === "ALMACEN" &&
              writable &&
              row.id &&
              Number(row.tiene_part_system) === 0 ? (
              <>
                <Button
                  size="sm"
                  onClick={() => setDialog({ type: "manual", row })}
                >
                  {row.confirmacion_manual_estado === "RECIBIDO"
                    ? "Revertir recepción"
                    : "Marcar recibido"}
                </Button>
                <small>
                  {text(row.confirmacion_manual_usuario)}{" "}
                  {text(row.confirmacion_manual_fecha)}
                </small>
              </>
            ) : (
              text(row.mensaje_match) || "—"
            ),
        },
      ),
    [scope, writable],
  );
  const panels = useMemo(
    () =>
      data
        ? [
            {
              id: "lines",
              label: "Líneas invoice",
              rows: data.lines,
              specs: LINES,
              columns: lineColumns,
              minWidth: 1050,
            },
            {
              id: "packing",
              label: "Packing",
              rows: [...data.packing].sort(
                (a, b) =>
                  Number(b.estado_match === "DIFERENCIA_PALLET") -
                  Number(a.estado_match === "DIFERENCIA_PALLET"),
              ),
              specs: PACKING_EXPORT,
              columns: packingColumns,
              minWidth: scope === "EMBARQUES" ? 1050 : 1250,
            },
            {
              id: "links",
              label: "Links",
              rows: data.links,
              specs: LINKS_EXPORT,
              columns: makeColumns(LINKS),
              minWidth: 1150,
            },
            {
              id: "manual",
              label: "Recepciones manuales",
              rows: data.manual_receipts,
              specs: MANUAL,
              columns: makeColumns(MANUAL),
              minWidth: 950,
            },
          ]
        : [],
    [data, lineColumns, packingColumns, scope],
  );
  const activePanel = panels.find((panel) => panel.id === tab);
  const action = dialog?.type === "action" ? dialog.action : null;
  const titles: Record<InvoiceAction, string> = {
    apply: "Aplicar automáticamente",
    unapply: "Desaplicar invoice",
    reapply: "Reaplicar invoice",
    close: enabled(data?.invoice.cerrado_manual)
      ? "Reabrir invoice"
      : "Cerrar invoice",
  };
  return (
    <>
      <DetailPanel
        title={`Invoice · ${text(data?.invoice.numero_invoice) || id}`}
        subtitle={
          data
            ? `${text(data.invoice.estado)} · ${text(data.invoice.tipo)} · ${text(data.invoice.archivo_nombre)}`
            : undefined
        }
        onClose={onClose}
      >
        <DialogBody>
          {detail.isPending ? (
            <Loading />
          ) : detail.error ? (
            <ErrorState
              error={detail.error}
              onRetry={() => void detail.refetch()}
            />
          ) : (
            data && (
              <>
                <div className="invoicing-toolbar">
                  <Button
                    size="sm"
                    disabled={detail.isFetching}
                    aria-label="Actualizar detalle"
                    title="Actualizar detalle"
                    icon={compact ? <RefreshCw size={14} /> : undefined}
                    onClick={() => void detail.refetch()}
                  >
                    {compact ? null : "Actualizar"}
                  </Button>
                  <Button size="sm" onClick={() => setDialog({ type: "file" })}>
                    Ver Excel original
                  </Button>
                  <ActionGroup
                    label="Acciones de invoice"
                    actions={
                      writable
                        ? [
                            ...(scope === "ALMACEN"
                              ? (["apply", "reapply", "unapply"] as const).map(
                                  (action) => ({
                                    id: action,
                                    label: titles[action],
                                    onClick: () =>
                                      setDialog({ type: "action", action }),
                                  }),
                                )
                              : []),
                            {
                              id: "close",
                              label: titles.close,
                              onClick: () =>
                                setDialog({ type: "action", action: "close" }),
                            },
                          ]
                        : []
                    }
                  />
                </div>
                <ResultNotice result={result} />
                <TabBar
                  id={`invoice-${scope}-${id}`}
                  label="Detalle de invoice"
                  items={panels.map((panel) => ({
                    id: panel.id,
                    label: `${panel.label} (${panel.rows.length})`,
                  }))}
                  activeId={tab}
                  onChange={setTab}
                />
                {panels.map((panel) => (
                  <Activity
                    key={panel.id}
                    mode={tab === panel.id ? "visible" : "hidden"}
                  >
                    <div className="invoicing-grid-panel">
                      <div className="invoicing-toolbar">
                        {!compact && (
                          <ExportButton
                            name={`invoice_${id}_${panel.id}`}
                            specs={panel.specs}
                            rows={panel.rows}
                            extraSheets={packingSheets(panel)}
                          />
                        )}
                        {panel.id === "links" && panel.rows.length >= 500 && (
                          <span className="invoicing-note">
                            Se muestran los últimos 500 links.
                          </span>
                        )}
                        {panel.id === "manual" && panel.rows.length >= 1000 && (
                          <span className="invoicing-note">
                            Se muestran los últimos 1,000 eventos.
                          </span>
                        )}
                      </div>
                      <DataGrid
                        label={panel.label}
                        rows={panel.rows}
                        columns={panel.columns}
                        rowKey={(row, index) => `${text(row.id)}:${index}`}
                        layout="fixed"
                        minWidth={panel.minWidth}
                      />
                    </div>
                  </Activity>
                ))}
              </>
            )
          )}
        </DialogBody>
        <DialogFooter>
          {compact && activePanel && (
            <ExportButton
              name={`invoice_${id}_${activePanel.id}`}
              specs={activePanel.specs}
              rows={activePanel.rows}
              extraSheets={packingSheets(activePanel)}
            />
          )}
          <Button onClick={onClose}>Ocultar detalle</Button>
        </DialogFooter>
      </DetailPanel>
      {dialog?.type === "file" && (
        <InvoiceFile scope={scope} id={id} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "edit" && (
        <LineForm
          scope={scope}
          api={auth.invoices}
          id={id}
          row={dialog.row}
          onClose={() => setDialog(null)}
          onSaved={done}
        />
      )}
      {dialog?.type === "delete" && (
        <ActionDialog
          title="Eliminar parte de invoice"
          message={`Se eliminará la línea ${text(dialog.row.line_no)} y su packing, siempre que no tenga material vinculado. Esta acción no se puede deshacer.`}
          onConfirm={() =>
            auth.invoices.removeLine(scope, id, Number(dialog.row.id))
          }
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === "manual" && (
        <ActionDialog
          title={
            dialog.row.confirmacion_manual_estado === "RECIBIDO"
              ? "Revertir recepción manual"
              : "Marcar recibido"
          }
          message="Este cambio registra un evento documental. No genera inventario, lotes ni etiquetas; conserva el historial previo."
          comment
          onConfirm={(comment) =>
            auth.invoices.manual(
              scope,
              id,
              Number(dialog.row.id),
              dialog.row.confirmacion_manual_estado !== "RECIBIDO",
              comment,
            )
          }
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === "link" && (
        <PalletLink
          scope={scope}
          id={id}
          row={dialog.row}
          onClose={() => setDialog(null)}
          onSaved={done}
        />
      )}
      {dialog?.type === "lots" && (
        <Modal
          title="Lotes aplicados al packing"
          size="xl"
          onClose={() => setDialog(null)}
          className="invoicing-dialog"
        >
          <DialogBody>
            <DataGrid
              label="Lotes aplicados al packing"
              rows={rows(dialog.row.lotes)}
              columns={makeColumns(LOTS)}
              rowKey={(row, index) =>
                `${text(row.codigo_material_recibido)}:${index}`
              }
              minWidth={900}
              layout="fixed"
            />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setDialog(null)}>Cerrar</Button>
          </DialogFooter>
        </Modal>
      )}
      {action && (
        <ActionDialog
          title={titles[action]}
          message={
            action === "close"
              ? "Cambia el cierre manual de esta invoice. No elimina su historial."
              : action === "apply"
                ? "Aplicará los costos a los lotes que el servidor pueda conciliar. Las diferencias de pallet se omiten para revisión."
                : action === "unapply"
                  ? "Los lotes dejarán de costearse con esta invoice. El servidor conservará el historial."
                  : "Desaplicará y recalculará los vínculos de esta invoice con las reglas actuales del servidor."
          }
          comment={action !== "close"}
          onConfirm={(comment) =>
            auth.invoices.action(
              scope,
              id,
              action,
              action === "close"
                ? { cerrado: !enabled(data?.invoice.cerrado_manual) }
                : action === "unapply"
                  ? { motivo_desaplicado: comment }
                  : { motivo: comment },
            )
          }
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
    </>
  );
}
