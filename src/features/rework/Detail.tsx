import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import {
  Alert,
  Button,
  ConfirmDialog,
  DataGrid,
  DialogBody,
  DialogFooter,
  ErrorState,
  KeyValueGrid,
  Loading,
  Modal,
  TabBar,
  tabIds,
} from "@/shared/ui";
import { AreaBadges, columnsFor, StateBadge } from "./components";
import { ORIGINS, STAGES } from "./model";
import type {
  Component,
  Programming,
  ReworkApi,
  Scan,
  Shipment,
} from "./types";
const PROGRAM_COLUMNS = columnsFor<Programming>([
  ["ic_location", "UBICACIÓN", 90],
  ["micom_part_no", "MICOM", 130],
  ["programming_label", "ETIQUETA", 190],
  ["fpa_folio", "FPA", 160],
  ["fpa_status", "ESTADO FPA", 110],
]).map((col) =>
  col.id === "fpa_folio"
    ? {
        ...col,
        cell: (row: Programming) => row.fpa_folio || row.fpa_request_id || "—",
        textValue: (row: Programming) =>
          String(row.fpa_folio || row.fpa_request_id || ""),
      }
    : col,
);
const COMPONENT_COLUMNS = columnsFor<Component>([
  ["tipo", "TIPO", 80],
  ["ubicacion", "UBICACIÓN", 100],
  ["np_anterior", "NP ANTERIOR", 200],
  ["np_nuevo", "NP NUEVO", 200],
]);
const SHIPMENT_COLUMNS = columnsFor<Shipment>([
  ["folio", "FOLIO SALIDA", 130],
  ["part_number", "NP", 130],
  ["cantidad", "CANTIDAD", 70],
  ["cajas", "CAJAS", 230],
  ["registrado_por", "ASIGNÓ", 120],
  ["created_at", "FECHA", 160],
]);
const SCAN_COLUMNS = columnsFor<Scan>([
  ["etapa", "ETAPA", 160],
  ["qr_smd_anterior", "QR SMD ANTERIOR", 190],
  ["qr_smd_nuevo", "QR SMD NUEVO", 190],
  ["qr_assy_anterior", "QR ASSY ANTERIOR", 190],
  ["qr_assy_nuevo", "QR ASSY NUEVO", 190],
  ["usuario", "USUARIO", 100],
  ["created_at", "FECHA", 150],
]).map((col) =>
  col.id === "etapa"
    ? {
        ...col,
        cell: (row: Scan) => STAGES[row.etapa] ?? row.etapa,
        textValue: (row: Scan) => STAGES[row.etapa] ?? row.etapa,
      }
    : col,
);
export function Detail({
  api,
  scope,
  id,
  onClose,
  onCancelled,
}: {
  api: ReworkApi;
  scope: string;
  id: number;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const client = useQueryClient(),
    prefix = useId(),
    compact = useMediaQuery("(max-width: 700px)");
  const [tab, setTab] = useState("programming"),
    [confirm, setConfirm] = useState(false),
    [notices, setNotices] = useState<string[]>([]),
    [cancelled, setCancelled] = useState(false);
  const query = useQuery({
    queryKey: ["rework", scope, "detail", id],
    queryFn: ({ signal }) => api.detail(id, signal),
  });
  const cancel = useMutation({
    mutationFn: () => api.cancel(id),
    onSuccess: (result) => {
      client.setQueryData(["rework", scope, "detail", id], result.record);
      setNotices(result.avisos);
      setCancelled(true);
      setConfirm(false);
      onCancelled();
    },
  });
  const record = query.data,
    ids = tabIds(prefix, tab);
  return (
    <>
      <Modal
        title={record ? `Retrabajo ${record.folio}` : "Detalle de retrabajo"}
        size="xl"
        className="rework-detail"
        busy={cancel.isPending}
        onClose={onClose}
      >
        <DialogBody>
          {cancelled && (
            <Alert tone={notices.length ? "warning" : "success"}>
              Solicitud cancelada.
              {notices.map((notice, index) => (
                <p key={index}>{notice}</p>
              ))}
            </Alert>
          )}
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <ErrorState
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          ) : (
            record && (
              <>
                <details className="rework-information" open={!compact}>
                  <summary>Datos y avance de la solicitud</summary>
                  <div className="rework-information-body">
                    <KeyValueGrid
                      items={[
                        { label: "NP origen", value: record.np_origen },
                        { label: "NP destino", value: record.np_destino },
                        { label: "Cantidad", value: String(record.cantidad) },
                        {
                          label: "Material",
                          value:
                            record.tipo_material === "ASSY"
                              ? "ASSY"
                              : "IMD-SMD",
                        },
                        {
                          label: "Estado",
                          value: <StateBadge state={record.estado} />,
                        },
                        {
                          label: "Lote impresión",
                          value: record.lote_impresion,
                        },
                        { label: "Solicitó", value: record.solicitado_por },
                        { label: "Fecha", value: record.created_at },
                      ]}
                    />
                    {record.cancelado_por && (
                      <p>
                        Cancelada por {record.cancelado_por} ·{" "}
                        {record.cancelado_at}
                      </p>
                    )}
                    {record.comentarios && (
                      <p className="rework-comments">{record.comentarios}</p>
                    )}
                    <AreaBadges areas={record.areas} />
                    <div className="rework-badges">
                      {record.origenes.map((origin) => (
                        <span className="rework-badge" key={origin.origen}>
                          {ORIGINS.find((item) => item.value === origin.origen)
                            ?.label ?? origin.origen}
                          : {origin.cantidad}
                        </span>
                      ))}
                    </div>
                  </div>
                </details>
                <TabBar
                  id={prefix}
                  label="Detalle de retrabajo"
                  activeId={tab}
                  onChange={setTab}
                  items={[
                    {
                      id: "programming",
                      label: `Programación (${record.programaciones.length})`,
                    },
                    {
                      id: "components",
                      label: `Componentes (${record.componentes.length})`,
                    },
                    {
                      id: "shipments",
                      label: `Salidas de Embarques (${record.salidas_embarques.length})`,
                    },
                    {
                      id: "scans",
                      label: `Escaneos (${record.escaneos.length})`,
                    },
                  ]}
                />
                <div
                  className="rework-tab-content"
                  role="tabpanel"
                  id={ids.panel}
                  aria-labelledby={ids.tab}
                >
                  {tab === "programming" && (
                    <DataGrid
                      label="Programación MICOM del retrabajo"
                      rows={record.programaciones}
                      columns={PROGRAM_COLUMNS}
                      rowKey={(row, index) => `${row.ic_location}:${index}`}
                      layout="fixed"
                      minWidth={700}
                    />
                  )}
                  {tab === "components" && (
                    <DataGrid
                      label="Componentes del retrabajo"
                      rows={record.componentes}
                      columns={COMPONENT_COLUMNS}
                      rowKey={(_, index) => index}
                      layout="fixed"
                      minWidth={600}
                    />
                  )}
                  {tab === "shipments" && (
                    <DataGrid
                      label="Salidas de Embarques del retrabajo"
                      rows={record.salidas_embarques}
                      columns={SHIPMENT_COLUMNS}
                      rowKey={(row, index) => `${row.folio}:${index}`}
                      layout="fixed"
                      minWidth={850}
                    />
                  )}
                  {tab === "scans" && (
                    <DataGrid
                      label="Escaneos del retrabajo"
                      rows={record.escaneos}
                      columns={SCAN_COLUMNS}
                      rowKey={(_, index) => index}
                      layout="fixed"
                      minWidth={1100}
                    />
                  )}
                </div>
              </>
            )
          )}
        </DialogBody>
        <DialogFooter>
          {record?.status === "ACTIVA" && !query.error && (
            <Button
              variant="danger"
              disabled={cancel.isPending || query.isFetching}
              onClick={() => {
                cancel.reset();
                setConfirm(true);
              }}
            >
              Cancelar solicitud
            </Button>
          )}
          <Button
            disabled={cancel.isPending || query.isFetching}
            onClick={() => void query.refetch()}
          >
            Actualizar detalle
          </Button>
          <Button disabled={cancel.isPending} onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </Modal>
      {confirm && record && (
        <ConfirmDialog
          title="Cancelar solicitud de retrabajo"
          pending={cancel.isPending}
          error={cancel.error}
          onClose={() => setConfirm(false)}
          onConfirm={() => cancel.mutate()}
          confirmLabel="Confirmar cancelación"
        >
          <p>
            Se cancelará {record.folio} y su lote de impresión. Las etiquetas
            MICOM se ajustarán a lo consumido. El historial se conservará.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
