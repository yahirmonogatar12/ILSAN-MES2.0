import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Eye, RefreshCw } from "lucide-react";
import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  DialogBody,
  DialogFooter,
  ErrorState,
  ExportButton,
  FilterBar,
  IconButton,
  KeyValueGrid,
  Loading,
  Modal,
  type TableColumn,
} from "@/shared/ui";
import { PanelLayout } from "./PanelLayout";
import { auditData, auditDefaults, auditFilterIssue } from "./auditModel";
import { panelKeys, usePanel } from "./usePanel";
import type { AuditRecord, PanelApi } from "./panelTypes";

function AuditDetail({
  id,
  api,
  scope,
  onClose,
}: {
  id: number;
  api: PanelApi;
  scope: string;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: [...panelKeys.data(scope, "audit-detail"), id],
    queryFn: ({ signal }) => api.auditDetail(id, signal),
  });
  const row = query.data;
  return (
    <Modal
      title="Detalle de auditoría"
      className="administration-panel-audit-detail"
      size="xl"
      onClose={onClose}
    >
      <DialogBody>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          row && (
            <>
              <KeyValueGrid
                items={[
                  { label: "Usuario", value: row.usuario },
                  { label: "Fecha y hora", value: row.fecha_hora },
                  { label: "Módulo", value: row.modulo },
                  { label: "Acción", value: row.accion },
                  { label: "Resultado", value: row.resultado },
                  { label: "Dirección IP", value: row.ip_address },
                  { label: "Endpoint", value: row.endpoint },
                  {
                    label: "Duración",
                    value:
                      row.duracion_ms == null ? "—" : row.duracion_ms + " ms",
                  },
                ]}
              />
              <p>{row.descripcion}</p>
              <div className="administration-panel-changes">
                <section>
                  <h3>Antes</h3>
                  <pre>
                    {auditData(row.datos_antes_json ?? row.datos_antes)}
                  </pre>
                </section>
                <section>
                  <h3>Después</h3>
                  <pre>
                    {auditData(row.datos_despues_json ?? row.datos_despues)}
                  </pre>
                </section>
              </div>
            </>
          )
        )}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
function Recent({
  api,
  scope,
  onClose,
}: {
  api: PanelApi;
  scope: string;
  onClose: () => void;
}) {
  const list = useQuery({
    queryKey: panelKeys.data(scope, "recent"),
    queryFn: ({ signal }) => api.recent(signal),
    refetchInterval: 30_000,
  });
  const columns = useMemo<
    TableColumn<
      Awaited<ReturnType<PanelApi["recent"]>>["ultimas_acciones"][number]
    >[]
  >(
    () => [
      {
        id: "date",
        header: "FECHA Y HORA",
        cell: (row) => row.fecha_hora,
        sortValue: (row) => row.fecha_hora,
      },
      {
        id: "user",
        header: "USUARIO",
        cell: (row) => row.usuario,
        sortValue: (row) => row.usuario,
      },
      {
        id: "module",
        header: "MÓDULO",
        cell: (row) => row.modulo,
        sortValue: (row) => row.modulo,
      },
      {
        id: "action",
        header: "ACCIÓN",
        cell: (row) => row.accion,
        sortValue: (row) => row.accion,
      },
      {
        id: "description",
        header: "DESCRIPCIÓN",
        cell: (row) => row.descripcion || "—",
      },
    ],
    [],
  );
  return (
    <Modal
      title="Actividad reciente"
      size="xl"
      className="administration-panel-dialog"
      onClose={onClose}
    >
      <DialogBody>
        {list.data && (
          <div className="administration-panel-live">
            <h3>Usuarios activos en los últimos 15 minutos</h3>
            <div className="administration-panel-tags">
              {list.data.usuarios_activos.length ? (
                list.data.usuarios_activos.map((user) => (
                  <span key={user.usuario} title={user.ultima_accion}>
                    {user.usuario} · {user.hace}
                  </span>
                ))
              ) : (
                <span>Sin actividad reciente</span>
              )}
            </div>
          </div>
        )}
        <DataGrid
          label="Últimas acciones"
          rows={list.data?.ultimas_acciones || []}
          columns={columns}
          rowKey={(row) => `${row.usuario}:${row.fecha_hora}:${row.accion}`}
          minWidth={850}
          loading={list.isPending}
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => void list.refetch()} disabled={list.isFetching}>
          Actualizar
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
export default function PanelAudit() {
  const { api, scope } = usePanel();
  const [defaults] = useState(auditDefaults);
  const [filters, setFilters] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [issue, setIssue] = useState("");
  const [dialog, setDialog] = useState<{ id: number } | "recent" | null>(null);
  const list = useQuery({
    queryKey: [...panelKeys.data(scope, "audit"), applied],
    queryFn: ({ signal }) => api.audit(applied, signal),
  });
  const rows = useMemo(() => list.data?.registros || [], [list.data]);
  const exporter = useMutation({
    mutationFn: async () =>
      exportSpreadsheet("Auditoria.xlsx", [
        {
          name: "Auditoría",
          rows: [
            [
              "Fecha y hora",
              "Usuario",
              "Módulo",
              "Acción",
              "Descripción",
              "Resultado",
              "IP",
              "Endpoint",
              "Duración ms",
            ],
            ...rows.map((row) => [
              row.fecha_hora,
              row.usuario,
              row.modulo,
              row.accion,
              row.descripcion,
              row.resultado,
              row.ip_address,
              row.endpoint,
              row.duracion_ms,
            ]),
          ],
        },
      ]),
  });
  const columns = useMemo<TableColumn<AuditRecord>[]>(
    () => [
      {
        id: "date",
        header: "FECHA Y HORA",
        width: "16%",
        cell: (row) => row.fecha_hora,
        sortValue: (row) => row.fecha_hora,
      },
      {
        id: "user",
        header: "USUARIO",
        cell: (row) => row.usuario,
        sortValue: (row) => row.usuario,
      },
      {
        id: "module",
        header: "MÓDULO",
        cell: (row) => row.modulo,
        sortValue: (row) => row.modulo,
      },
      {
        id: "action",
        header: "ACCIÓN",
        width: "18%",
        cell: (row) => row.accion,
        sortValue: (row) => row.accion,
      },
      {
        id: "description",
        header: "DESCRIPCIÓN",
        width: "24%",
        cell: (row) => row.descripcion || "—",
        sortValue: (row) => row.descripcion,
      },
      {
        id: "result",
        header: "RESULTADO",
        cell: (row) => (
          <span
            className={`administration-panel-status ${row.resultado === "EXITOSO" ? "administration-panel-active" : "administration-panel-warning"}`}
          >
            {row.resultado}
          </span>
        ),
        textValue: (row) => row.resultado,
        sortValue: (row) => row.resultado,
      },
      {
        id: "actions",
        header: "DETALLE",
        width: 85,
        filterable: false,
        cell: (row) => (
          <IconButton
            label={`Ver auditoría ${row.id}`}
            icon={<Eye size={16} />}
            onClick={() => setDialog({ id: row.id })}
          />
        ),
      },
    ],
    [],
  );
  return (
    <PanelLayout className="administration-panel-audit">
      <FilterBar
        actions={
          <>
            <Button
              size="sm"
              icon={<Activity size={15} />}
              onClick={() => setDialog("recent")}
            >
              Actividad reciente
            </Button>
            <Button
              size="sm"
              icon={<RefreshCw size={15} />}
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              loading={exporter.isPending}
              disabled={!list.isSuccess || list.isFetching || !rows.length}
              onClick={() => exporter.mutate()}
            >
              Exportar consulta
            </ExportButton>
          </>
        }
        fields={[
          { key: "fecha_inicio", label: "Fecha desde", type: "date" },
          { key: "fecha_fin", label: "Fecha hasta", type: "date" },
          { key: "usuario", label: "Usuario", type: "search" },
          { key: "accion", label: "Acción", type: "text" },
          {
            key: "modulo",
            label: "Módulo",
            type: "select",
            options: [
              { value: "", label: "Todos" },
              ...[
                "sistema",
                "material",
                "almacen",
                "bom",
                "produccion",
                "calidad",
              ].map((value) => ({ value, label: value })),
            ],
          },
          {
            key: "resultado",
            label: "Resultado",
            type: "select",
            options: [
              { value: "", label: "Todos" },
              ...["EXITOSO", "ERROR", "DENEGADO"].map((value) => ({
                value,
                label: value,
              })),
            ],
          },
          {
            key: "limite",
            label: "Registros a consultar",
            type: "select",
            options: ["500", "1000", "2500", "5000"].map((value) => ({
              value,
              label: value,
            })),
          },
        ]}
        values={filters}
        defaults={defaults}
        onChange={(patch) =>
          setFilters((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={() => {
          const message = auditFilterIssue(filters);
          setIssue(message);
          if (!message) setApplied(filters);
        }}
        onReset={() => {
          setFilters(defaults);
          setApplied(defaults);
          setIssue("");
        }}
        pending={list.isFetching}
      />
      {issue && <Alert tone="warning">{issue}</Alert>}
      <Card fill label="Registro de actividad">
        {exporter.error && <ErrorState error={exporter.error} />}
        {rows.length >= Number(applied.limite) && (
          <p className="administration-panel-limit">
            Últimos {applied.limite} registros. Ajusta los filtros o el límite
            para consultar más.
          </p>
        )}
        <DataGrid
          label="Registro de auditoría"
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          minWidth={1000}
          layout="fixed"
          virtualRows={{ rowHeight: 42 }}
          className="administration-panel-audit-table"
          resetKey={JSON.stringify(applied)}
          loading={list.isPending}
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      </Card>
      {dialog === "recent" && (
        <Recent api={api} scope={scope} onClose={() => setDialog(null)} />
      )}
      {dialog && dialog !== "recent" && (
        <AuditDetail
          id={dialog.id}
          api={api}
          scope={scope}
          onClose={() => setDialog(null)}
        />
      )}
    </PanelLayout>
  );
}
