import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Files, History, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { usePermission } from "@/core/auth/usePermission";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import {
  Alert,
  Button,
  ExportButton,
  Card,
  CheckboxField,
  DataGrid,
  EmptyState,
  FilterBar,
  Page,
  useToast,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { createBomApi } from "./api";
import { DEFAULT_FILTERS, ECO_APPROVE, ECO_CREATE } from "./config";
import { EcoForm } from "./EcoForm";
import { EcoHistory } from "./EcoHistory";
import { EcoDetailDialog } from "./EcoDetail";
import { Paperwork } from "./Files";
import type { BomFilters, BomItem, EcoRow } from "./types";
import "./module.css";
const columns: TableColumn<BomItem>[] = [
  {
    id: "part",
    width: "11%",
    header: "NÚMERO DE PARTE",
    cell: (row) => row.numeroParte,
    sortValue: (row) => row.numeroParte,
  },
  {
    id: "type",
    width: "8%",
    header: "TIPO DE MATERIAL",
    cell: (row) => row.tipoMaterial,
    sortValue: (row) => row.tipoMaterial,
  },
  {
    id: "classification",
    width: "10.5%",
    header: "CLASSIFICATION",
    cell: (row) => row.classification,
    sortValue: (row) => row.classification,
  },
  {
    id: "spec",
    width: "13.5%",
    header: "ESPECIFICACIÓN DE MATERIAL",
    cell: (row) => row.especificacionMaterial,
    sortValue: (row) => row.especificacionMaterial,
  },
  {
    id: "maker",
    width: "7%",
    header: "MAKER",
    cell: (row) => row.vender,
    sortValue: (row) => row.vender,
  },
  {
    id: "qty",
    width: "8%",
    header: "CANTIDAD TOTAL",
    cell: (row) => row.cantidadTotal ?? "—",
    sortValue: (row) => Number(row.cantidadTotal),
  },
  {
    id: "location",
    width: "8.5%",
    header: "UBICACIÓN",
    cell: (row) => row.ubicacion,
    sortValue: (row) => row.ubicacion,
  },
  {
    id: "alternate",
    width: "8%",
    header: "MATERIAL SUSTITUTO",
    cell: (row) => row.materialSustituto || "—",
    sortValue: (row) => row.materialSustituto,
  },
  {
    id: "original",
    width: "8%",
    header: "MATERIAL ORIGINAL",
    cell: (row) =>
      ["CHECKED", "UNCHECKED"].includes(
        String(row.materialOriginal).toUpperCase(),
      ) ? (
        <CheckboxField
          aria-label={`Material original ${row.numeroParte}`}
          disabled
          checked={String(row.materialOriginal).toUpperCase() === "CHECKED"}
        />
      ) : (
        row.materialOriginal || "—"
      ),
    textValue: (row) => row.materialOriginal || "",
    sortValue: (row) => row.materialOriginal,
  },
  {
    id: "registrar",
    width: "9.5%",
    header: "REGISTRADOR",
    cell: (row) => row.registrador,
    sortValue: (row) => row.registrador,
  },
  {
    id: "date",
    width: "8%",
    header: "FECHA DE REGISTRO",
    cell: (row) => row.fechaRegistro,
    sortValue: (row) => row.fechaRegistro,
  },
];
export default function BomPage() {
  const { mode, scope } = useAuth();
  const api = useMemo(() => createBomApi(mode), [mode]);
  const [filters, setFilters] = useState<BomFilters>({ ...DEFAULT_FILTERS });
  const [applied, setApplied] = useState<BomFilters>({ ...DEFAULT_FILTERS });
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<
    | { type: "create" | "history" | "paperwork" }
    | { type: "detail"; row: EcoRow }
    | null
  >(null);
  const models = useQuery({
    queryKey: ["bom", scope, "models"],
    queryFn: ({ signal }) => api.models(signal),
  });
  const model = useDebouncedValue(filters.modelo.trim().toUpperCase()).value;
  const revisions = useQuery({
    queryKey: ["bom", scope, "revisions", model],
    queryFn: ({ signal }) => api.revisions(model, signal),
    enabled: !!model && !!models.data?.includes(model),
  });
  const list = useQuery({
    queryKey: ["bom", scope, "list", applied],
    queryFn: ({ signal }) => api.list(applied, signal),
    enabled: !!applied.modelo,
  });
  const create = usePermission(ECO_CREATE);
  const approve = usePermission(ECO_APPROVE);
  const canCreate = create.data === true && !create.isError;
  const canApprove = approve.data === true && !approve.isError;
  const client = useQueryClient();
  const toast = useToast();
  const exportFile = useMutation({
    mutationFn: () => api.export(applied),
    onSuccess: () => toast("BOM descargado."),
  });
  function changed(message: string) {
    toast(message);
    void client.invalidateQueries({ queryKey: ["bom", scope] });
  }
  const fields: FilterField<BomFilters>[] = [
    {
      key: "modelo",
      label: "Modelo",
      type: "search",
      placeholder: "Selecciona o busca un modelo…",
      suggestions: models.data || [],
    },
    {
      key: "bom_revision",
      label: "Revisión BOM",
      type: "select",
      options: [
        { value: "", label: "Vigente" },
        ...(model === filters.modelo.trim().toUpperCase()
          ? revisions.data || []
          : []
        ).map((revision) => ({
          value: revision.bom_rev,
          label: `${revision.bom_rev}${revision.is_current ? " · vigente" : ""}${revision.eco_no ? ` · ${revision.eco_no}` : ""}`,
        })),
      ],
    },
    {
      key: "classification",
      label: "Classification",
      type: "select",
      options: ["TODOS", "IMD", "SMD", "MAIN"].map((value) => ({
        value,
        label: value,
      })),
    },
  ];
  return (
    <Page className="bom-module" banner={<DemoBanner />}>
      <FilterBar
        actions={
          <>
            <Button
              size="sm"
              icon={<RefreshCw size={15} />}
              disabled={list.isFetching || models.isFetching}
              onClick={() => {
                void models.refetch();
                if (applied.modelo) void list.refetch();
              }}
            >
              Actualizar
            </Button>
            {canCreate && (
              <Button
                size="sm"
                variant="success"
                icon={<Plus size={15} />}
                onClick={() => setDialog({ type: "create" })}
              >
                Crear ECO
              </Button>
            )}
            <Button
              size="sm"
              icon={<History size={15} />}
              onClick={() => setDialog({ type: "history" })}
            >
              Ver ECO / ECN
            </Button>
            <Button
              size="sm"
              icon={<Files size={15} />}
              disabled={!applied.modelo}
              onClick={() => setDialog({ type: "paperwork" })}
            >
              Papelería
            </Button>
            <ExportButton
              size="sm"
              icon={<Download size={15} />}
              loading={exportFile.isPending}
              disabled={!applied.modelo || list.isError || list.isFetching}
              onClick={() => exportFile.mutate()}
            >
              {mode === "demo" ? "Exportar ejemplo" : "Exportar Excel"}
            </ExportButton>
          </>
        }
        fields={fields}
        values={filters}
        defaults={DEFAULT_FILTERS}
        onChange={(patch) =>
          setFilters((previous) => ({
            ...previous,
            ...patch,
            ...(patch.modelo !== undefined ? { bom_revision: "" } : {}),
          }))
        }
        onSubmit={() => {
          const modelo = filters.modelo.trim().toUpperCase();
          if (!modelo || modelo === "TODOS") {
            setError("Selecciona un modelo específico para consultar su BOM.");
            return;
          }
          setError("");
          void client.invalidateQueries({
            queryKey: ["bom", scope, "list"],
            refetchType: "none",
          });
          if (
            JSON.stringify({ ...filters, modelo }) === JSON.stringify(applied)
          )
            void list.refetch();
          setApplied({ ...filters, modelo });
        }}
        onReset={() => {
          setFilters({ ...DEFAULT_FILTERS });
          setApplied({ ...DEFAULT_FILTERS });
          setError("");
        }}
        pending={list.isFetching}
      />
      <Card
        fill
        label={
          applied.modelo ? `Componentes · ${applied.modelo}` : "Componentes BOM"
        }
      >
        {(error ||
          models.error ||
          revisions.error ||
          exportFile.error ||
          create.error ||
          approve.error) && (
          <Alert className="table-notice" tone="warning">
            {error ||
              models.error?.message ||
              revisions.error?.message ||
              exportFile.error?.message ||
              create.error?.message ||
              approve.error?.message}
          </Alert>
        )}
        <DataGrid
          label="Componentes BOM"
          rows={list.data || []}
          columns={columns}
          rowKey={(row) =>
            `${row.modelo}:${row.id}:${row.numeroParte}:${row.ubicacion}`
          }
          layout="fixed"
          minWidth={1080}
          itemLabel="componentes"
          resetKey={JSON.stringify(applied)}
          loading={!!applied.modelo && list.isPending}
          error={applied.modelo ? list.error : null}
          onRetry={() => void list.refetch()}
          emptyState={
            <EmptyState
              title={
                applied.modelo
                  ? "Sin componentes para estos filtros"
                  : "Selecciona un modelo"
              }
              message={
                applied.modelo
                  ? "Consulta otra revisión o clasificación."
                  : "Elige un modelo y pulsa Consultar para cargar su BOM."
              }
            />
          }
        />
      </Card>
      {dialog?.type === "create" && canCreate && (
        <EcoForm
          api={api}
          scope={scope}
          model={applied.modelo}
          models={models.data || []}
          demo={mode === "demo"}
          onClose={() => setDialog(null)}
          onCreated={(row) => {
            changed(
              "Borrador ECO creado. Revisa las diferencias antes de aprobar.",
            );
            setDialog({ type: "detail", row });
          }}
        />
      )}
      {dialog?.type === "history" && (
        <EcoHistory
          api={api}
          scope={scope}
          demo={mode === "demo"}
          canCreate={canCreate}
          canApprove={canApprove}
          onClose={() => setDialog(null)}
          onChanged={changed}
        />
      )}
      {dialog?.type === "detail" && (
        <EcoDetailDialog
          row={dialog.row}
          api={api}
          scope={scope}
          canCreate={canCreate}
          canApprove={canApprove}
          onClose={() => setDialog(null)}
          onChanged={changed}
        />
      )}
      {dialog?.type === "paperwork" && (
        <Paperwork
          part={applied.modelo}
          api={api}
          scope={scope}
          onClose={() => setDialog(null)}
        />
      )}
    </Page>
  );
}
