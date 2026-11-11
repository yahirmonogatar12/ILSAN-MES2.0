import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Power, Trash2 } from "lucide-react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataGrid,
  ExportButton,
  FilterBar,
  Page,
  TableRowActions,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { stationTypes } from "./model";
import { StationForm } from "./StationForm";
import { useQuality } from "./useQuality";
import type { Station, StationFilters } from "./types";
import "./module.css";

const initial: StationFilters = { q: "", station_type: "" };
const fields: FilterField<StationFilters>[] = [
  {
    key: "q",
    label: "Buscar",
    type: "search",
    maxLength: 80,
    placeholder: "Código, nombre o línea…",
  },
  {
    key: "station_type",
    label: "Tipo",
    type: "select",
    options: [
      { value: "", label: "Todos" },
      ...stationTypes.map((value) => ({ value, label: value })),
    ],
  },
];
const specs = [
  ["host_name", "Línea", 90],
  ["station_code", "Código", 110],
  ["station_name", "Nombre", 190],
  ["station_type", "Tipo", 85],
  ["created_at_utc", "Creado UTC", 150],
  ["updated_at_utc", "Actualizado UTC", 150],
] as const;
type Action = { type: "toggle" | "delete"; row: Station };
function StationAction({
  action,
  close,
  context,
}: {
  action: Action;
  close: () => void;
  context: ReturnType<typeof useQuality>;
}) {
  const { row, type } = action;
  const label =
    type === "delete" ? "Eliminar" : row.is_active ? "Desactivar" : "Activar";
  const form = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: async () => {
      if (type === "delete") await context.api.deleteStation(row.id);
      else await context.api.setActive(row.id, !row.is_active);
      context.stationSaved(
        type === "delete"
          ? "Estación eliminada."
          : "Estado de estación actualizado.",
      );
      close();
    },
  });
  return (
    <ConfirmDialog
      title={`${label} estación`}
      confirmLabel={label}
      confirmVariant={type === "delete" ? "danger" : "primary"}
      pending={form.pending}
      error={form.error}
      onConfirm={() => void form.submit()}
      onClose={close}
    >
      <p>
        {label} <strong>{row.station_code}</strong> de la línea{" "}
        <strong>{row.host_name || "sin línea"}</strong>.
      </p>
      {type === "delete" && <p>Se eliminará su registro de estación.</p>}
    </ConfirmDialog>
  );
}
export default function QualityStationsPage() {
  const context = useQuality();
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [form, setForm] = useState<{ row?: Station } | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const query = useQuery({
    queryKey: context.key("stations", filters),
    queryFn: ({ signal }) => context.api.stations(filters, signal),
  });
  const download = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () => context.api.exportStations(filters),
  });
  const columns = useMemo<TableColumn<Station>[]>(
    () => [
      ...specs.map(([key, header, width]) => ({
        id: key,
        header,
        width: width / 10.5 + "%",
        cell: (row: Station) => (
          <span className="quality-control-cell" title={row[key] || undefined}>
            {row[key] || "—"}
          </span>
        ),
        sortValue: (row: Station) => row[key],
      })),
      {
        id: "active",
        header: "Estado",
        width: "9%",
        cell: (row) => (
          <span
            className={
              row.is_active
                ? "quality-control-active"
                : "quality-control-inactive"
            }
          >
            {row.is_active ? "Activa" : "Inactiva"}
          </span>
        ),
        textValue: (row) => (row.is_active ? "Activa" : "Inactiva"),
        sortValue: (row) => (row.is_active ? 1 : 0),
      },
      {
        id: "actions",
        header: "Acciones",
        width: "17%",
        filterable: false,
        cell: (row) => {
          const name =
            row.station_code + " · " + (row.host_name || "sin línea");
          return (
            <TableRowActions
              actions={[
                {
                  id: "edit",
                  label: "Editar " + name,
                  icon: <Pencil size={14} />,
                  onClick: () => setForm({ row }),
                },
                {
                  id: "toggle",
                  label: (row.is_active ? "Desactivar " : "Activar ") + name,
                  icon: <Power size={14} />,
                  onClick: () => setAction({ type: "toggle", row }),
                },
                {
                  id: "delete",
                  label: "Eliminar " + name,
                  icon: <Trash2 size={14} />,
                  tone: "danger",
                  onClick: () => setAction({ type: "delete", row }),
                },
              ]}
            />
          );
        },
      },
    ],
    [],
  );
  const rows = query.data ?? [];
  const active = rows.filter((row) => row.is_active).length;
  return (
    <Page className="quality-control-page" banner={<DemoBanner />}>
      <FilterBar
        fields={fields}
        values={draft}
        defaults={initial}
        pending={query.isFetching}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onReset={() => {
          setDraft(initial);
          setFilters(initial);
        }}
        onSubmit={() => {
          if (JSON.stringify(filters) === JSON.stringify(draft))
            void query.refetch();
          else setFilters({ ...draft });
        }}
      />
      <Card
        fill
        title="Máquinas de calidad"
        badge={rows.length}
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
              loading={download.pending}
              disabled={query.isPending || query.isError}
              title="Exporta las estaciones con los filtros generales de búsqueda y tipo."
              onClick={() => void download.submit()}
            />
            <Button size="sm" variant="success" onClick={() => setForm({})}>
              Nueva estación
            </Button>
          </>
        }
      >
        {download.error && (
          <Alert tone="danger" className="table-notice">
            {download.error.message}
          </Alert>
        )}
        <DataGrid
          label="Máquinas de calidad"
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          minWidth={970}
          layout="fixed"
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          resetKey={JSON.stringify(filters)}
          summary={() => (
            <div className="quality-control-stats">
              <span>
                Activas <strong>{active}</strong>
              </span>
              <span>
                Inactivas <strong>{rows.length - active}</strong>
              </span>
            </div>
          )}
        />
      </Card>
      {form && (
        <StationForm
          record={form.row}
          api={context.api}
          close={() => setForm(null)}
          saved={context.stationSaved}
        />
      )}
      {action && (
        <StationAction
          action={action}
          close={() => setAction(null)}
          context={context}
        />
      )}
    </Page>
  );
}
