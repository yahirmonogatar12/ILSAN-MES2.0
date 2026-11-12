import { useMemo } from "react";
import {
  Download,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  Tag,
} from "lucide-react";
import {
  Alert,
  Button,
  ExportButton,
  Card,
  DataGrid,
  EmptyState,
  FilterBar,
  Page,
  type FilterField,
} from "@/shared/ui";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useMaterials } from "./useMaterials";
import { materialColumns } from "./columns";
import { DEFAULT_FILTERS } from "./config";
import { MaterialForm } from "./MaterialForm";
import { CostHistory, DeleteMaterial, MaterialDetail } from "./MaterialDialogs";
import type { Filters } from "./types";
import "./materials.css";

/** Composition only: definitions/state are in this feature; controls are shared. */
export default function MaterialsPage() {
  const state = useMaterials();
  const { dialog, setDialog } = state;
  const columns = useMemo(
    () =>
      materialColumns({
        openingCode: state.openingCode,
        open: (record, action) => void state.openRecord(record, action),
      }),
    [state.openingCode, state.openRecord],
  );
  const rows = state.list.data?.records || [];
  const fields: FilterField<Filters>[] = [
    {
      key: "q",
      label: "Buscar materiales",
      type: "search",
      placeholder: "Número de parte, especificación o vendedor...",
      maxLength: 120,
      icon: <Search size={12} />,
    },
    {
      key: "clasificacion",
      label: "Filtrar por clasificación",
      type: "select",
      icon: <Tag size={12} />,
      options: [
        { value: "", label: "Todas" },
        ...[
          ...new Set([
            ...state.catalogData.clasificaciones,
            ...(state.filters.clasificacion
              ? [state.filters.clasificacion]
              : []),
          ]),
        ].map((value) => ({ value, label: value })),
      ],
    },
  ];
  const filtered = !!state.filters.q || !!state.filters.clasificacion;
  return (
    <Page className="materials-module" banner={<DemoBanner />}>
      <FilterBar
        actions={
          <>
            <Button
              size="sm"
              icon={
                <RefreshCw
                  size={17}
                  className={state.list.isFetching ? "spin" : ""}
                />
              }
              aria-label="Actualizar catálogo"
              disabled={state.list.isFetching || state.catalogs.isFetching}
              onClick={() => {
                void state.list.refetch();
                void state.catalogs.refetch();
              }}
            >
              Actualizar
            </Button>
            <ExportButton
              size="sm"
              icon={<Download size={16} />}
              loading={state.exportFile.isPending}
              disabled={
                !state.list.data ||
                state.list.isFetching ||
                !!state.list.error ||
                state.searchPending
              }
              onClick={() => state.exportFile.mutate()}
            >
              {state.mode === "demo" ? "Exportar CSV" : "Exportar Excel"}
            </ExportButton>
            <Button
              size="sm"
              variant="success"
              icon={<Plus size={15} />}
              disabled={state.list.isPending}
              onClick={() => setDialog({ type: "create" })}
            >
              Nuevo material
            </Button>
          </>
        }
        fields={fields}
        values={state.filters}
        defaults={DEFAULT_FILTERS}
        onChange={state.updateFilters}
        onSubmit={state.submitFilters}
        onReset={state.clearFilters}
        pending={state.list.isFetching}
      />
      <Card fill label="Materiales Registrados">
        {state.catalogs.error && (
          <Alert tone="warning" className="table-notice">
            No se pudieron cargar las opciones de los catálogos.{" "}
            <Button
              variant="plain"
              className="text-button"
              onClick={() => void state.catalogs.refetch()}
            >
              Reintentar
            </Button>
          </Alert>
        )}
        {(state.actionError || state.exportFile.error) && (
          <Alert tone="danger" className="table-notice">
            {state.actionError?.message || state.exportFile.error?.message}
          </Alert>
        )}
        {rows.length >= 2000 && (
          <Alert tone="warning" className="table-notice">
            La consulta alcanzó el límite de 2,000 materiales. Aplica filtros
            para acotar los resultados.
          </Alert>
        )}
        <DataGrid
          label="Materiales registrados"
          rows={rows}
          columns={columns}
          rowKey={(row) => row.numero_parte}
          itemLabel="materiales"
          minWidth={1240}
          initialSort={{ columnId: "part", direction: "asc" }}
          resetKey={JSON.stringify(state.requestFilters)}
          loading={state.list.isPending}
          loadingText="Cargando materiales…"
          fetching={state.list.isPlaceholderData}
          error={state.list.error}
          onRetry={() => void state.list.refetch()}
          emptyState={
            <EmptyState
              title={
                filtered
                  ? "No encontramos materiales"
                  : "Tu catálogo comienza aquí"
              }
              message={
                filtered
                  ? "Prueba con otro número de parte, descripción o clasificación."
                  : "Registra tu primer material para consultar sus datos y costos."
              }
              icon={<PackageSearch size={29} />}
              action={
                <Button
                  onClick={
                    filtered
                      ? state.clearFilters
                      : () => setDialog({ type: "create" })
                  }
                >
                  {filtered ? "Limpiar filtros" : "Registrar material"}
                </Button>
              }
            />
          }
        />
      </Card>
      {dialog?.type === "create" && (
        <MaterialForm
          record={null}
          catalogs={state.catalogData}
          gateway={state.gateway}
          onClose={() => setDialog(null)}
          onSaved={state.afterSave}
        />
      )}
      {dialog?.type === "edit" && (
        <MaterialForm
          record={dialog.record}
          catalogs={state.catalogData}
          gateway={state.gateway}
          onClose={() => setDialog(null)}
          onSaved={state.afterSave}
        />
      )}
      {dialog?.type === "detail" && (
        <MaterialDetail
          record={dialog.record}
          onClose={() => setDialog(null)}
          onEdit={() => setDialog({ type: "edit", record: dialog.record })}
          onHistory={() =>
            setDialog({ type: "history", record: dialog.record })
          }
        />
      )}
      {dialog?.type === "history" && (
        <CostHistory
          record={dialog.record}
          gateway={state.gateway}
          scope={state.scope}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "delete" && (
        <DeleteMaterial
          record={dialog.record}
          gateway={state.gateway}
          onClose={() => setDialog(null)}
          onDeleted={() =>
            state.afterSave("Material dado de baja correctamente.")
          }
        />
      )}
    </Page>
  );
}
