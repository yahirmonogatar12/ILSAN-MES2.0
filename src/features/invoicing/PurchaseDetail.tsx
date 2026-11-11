import { Activity, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
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
  TabBar,
} from "@/shared/ui";
import {
  ActionDialog,
  ExportButton,
  ResultNotice,
  useInvoicing,
} from "./components";
import { PURCHASE_LINES, PURCHASE_LINKS, makeColumns } from "./columns";
import { PurchaseFiles } from "./PurchaseFiles";
import { text } from "./model";
import type { DataRow } from "./types";
export function PurchaseDetail({
  number,
  type,
  onClose,
}: {
  number: string;
  type: string;
  onClose: () => void;
}) {
  const auth = useInvoicing();
  const compact = useMediaQuery("(max-width: 700px)");
  const detail = useQuery({
    queryKey: auth.key("purchase", type, number),
    queryFn: ({ signal }) => auth.purchases.detail(number, type, signal),
  });
  const [files, setFiles] = useState(false);
  const [tab, setTab] = useState("lines");
  const [action, setAction] = useState<"close" | "unapply" | "reapply" | null>(
    null,
  );
  const [result, setResult] = useState<DataRow | null>(null);
  const panels = useMemo(
    () =>
      detail.data
        ? [
            {
              id: "lines",
              label: "Líneas de compra",
              rows: detail.data.lineas,
              specs: PURCHASE_LINES,
              columns: makeColumns(PURCHASE_LINES),
              minWidth: 1300,
            },
            {
              id: "links",
              label: "Lotes vinculados",
              rows: detail.data.links,
              specs: PURCHASE_LINKS,
              columns: makeColumns(PURCHASE_LINKS),
              minWidth: 950,
            },
          ]
        : [],
    [detail.data],
  );
  const closed = detail.data?.transaccion.cerrada === true;
  const activePanel = panels.find((panel) => panel.id === tab);
  return (
    <>
      <DetailPanel
        title={`Transacción · ${number}`}
        subtitle={`${type} · ${text(detail.data?.transaccion.estado)}`}
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
                <Button size="sm" onClick={() => setFiles(true)}>
                  Ver Excel original
                </Button>
                <ActionGroup
                  label="Acciones de compra"
                  actions={[
                    {
                      id: "close",
                      label: closed
                        ? "Reabrir transacción"
                        : "Cerrar transacción",
                      disabled: detail.isFetching,
                      onClick: () => setAction("close"),
                    },
                    ...(detail.data?.links.some(
                      (row) => row.estado === "APLICADO",
                    )
                      ? [
                          {
                            id: "unapply",
                            label: "Desaplicar lotes",
                            disabled: detail.isFetching,
                            onClick: () => setAction("unapply"),
                          },
                        ]
                      : []),
                    ...(detail.data?.links.some(
                      (row) => row.estado === "DESAPLICADO",
                    )
                      ? [
                          {
                            id: "reapply",
                            label: "Reaplicar lotes",
                            disabled: detail.isFetching,
                            onClick: () => setAction("reapply"),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
              <ResultNotice result={result} />
              <TabBar
                id={`purchase-${type}-${number}`}
                label="Detalle de compra"
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
                          name={`compras_${type}_${number}_${panel.id}`}
                          specs={panel.specs}
                          rows={panel.rows}
                        />
                      )}
                      {panel.id === "links" && panel.rows.length >= 500 && (
                        <span className="invoicing-note">
                          Se muestran los últimos 500 vínculos.
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
          )}
        </DialogBody>
        <DialogFooter>
          {compact && activePanel && (
            <ExportButton
              name={`compras_${type}_${number}_${activePanel.id}`}
              specs={activePanel.specs}
              rows={activePanel.rows}
            />
          )}
          <Button onClick={onClose}>Ocultar detalle</Button>
        </DialogFooter>
      </DetailPanel>
      {files && (
        <PurchaseFiles
          type={type}
          loadIds={[
            ...new Set(
              (detail.data?.lineas ?? [])
                .map((row) => Number(row.carga_id))
                .filter((id) => id > 0),
            ),
          ]}
          onClose={() => setFiles(false)}
        />
      )}
      {action && (
        <ActionDialog
          title={
            action === "close"
              ? closed
                ? "Reabrir transacción"
                : "Cerrar transacción"
              : action === "unapply"
                ? "Desaplicar lotes"
                : "Reaplicar lotes"
          }
          message={
            action === "close"
              ? "Cambiará el estado de esta transacción en el almacén y conservará su historial."
              : action === "unapply"
                ? "Los lotes aplicados dejarán de costearse desde esta compra. Se conservará el historial de vínculos."
                : "Intentará reaplicar los lotes desaplicados. El servidor omitirá los que ya tengan otra compra activa."
          }
          onClose={() => setAction(null)}
          onConfirm={() =>
            auth.purchases.action(
              number,
              type,
              action,
              action === "close" ? { cerrado: !closed } : {},
            )
          }
          onDone={(result) => {
            setResult(result);
            setAction(null);
            auth.saved();
          }}
        />
      )}
    </>
  );
}
