import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  ExportButton,
  FilterBar,
  Page,
  type FilterField,
} from "@/shared/ui";
import { useQuality } from "./useQuality";
import { oqcColumns } from "./reportColumns";
import { number, text } from "./model";
import { oqcDefaults, reportDateIssue } from "./reportModel";
import type { OqcFilters } from "./reportTypes";
import "./reports.css";

const fields: FilterField<OqcFilters>[] = [
  {
    key: "search",
    label: "Buscar",
    type: "search",
    maxLength: 160,
    placeholder: "Folio, caja, parte, modelo o inspector…",
  },
  { key: "fecha_desde", label: "Fecha desde", type: "date" },
  { key: "fecha_hasta", label: "Fecha hasta", type: "date" },
];
export default function OqcReleasePage() {
  const context = useQuality();
  const [draft, setDraft] = useState(oqcDefaults),
    [filters, setFilters] = useState(oqcDefaults),
    [issue, setIssue] = useState("");
  const query = useQuery({
    queryKey: context.key("oqc-release", filters),
    queryFn: ({ signal }) => context.api.oqcRecords(filters, signal),
  });
  const download = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () => context.api.exportOqc(filters),
  });
  return (
    <Page className="quality-control-page" banner={<DemoBanner />}>
      <FilterBar
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
              title="Exporta hasta 10,000 cajas con los filtros generales consultados."
              onClick={() => void download.submit()}
            />
          </>
        }
        fields={fields}
        values={draft}
        defaults={oqcDefaults}
        pending={query.isFetching}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onReset={() => {
          setDraft(oqcDefaults);
          setFilters(oqcDefaults);
          setIssue("");
        }}
        onSubmit={() => {
          const error = reportDateIssue(
            draft.fecha_desde,
            draft.fecha_hasta,
            false,
          );
          setIssue(error);
          if (error) return;
          if (JSON.stringify(filters) === JSON.stringify(draft))
            void query.refetch();
          else setFilters({ ...draft });
        }}
      />
      <Card fill label="Liberaciones OQC">
        {(issue || download.error) && (
          <Alert tone="danger" className="table-notice">
            {issue || download.error?.message}
          </Alert>
        )}
        {query.data?.truncated && (
          <Alert tone="info" className="table-notice">
            Se muestran {query.data.rows.length.toLocaleString("es-MX")} de{" "}
            {number(query.data.summary.total_boxes).toLocaleString("es-MX")}{" "}
            cajas. Aplica fechas o búsqueda para consultar otros registros.
          </Alert>
        )}
        <DataGrid
          label="Liberaciones OQC"
          rows={query.data?.rows ?? []}
          columns={oqcColumns}
          rowKey={(row) => text(row.id)}
          minWidth={1020}
          layout="fixed"
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          resetKey={JSON.stringify(filters)}
          summary={(rows) => (
            <div className="quality-control-stats">
              <span>
                Cajas mostradas{" "}
                <strong>{rows.length.toLocaleString("es-MX")}</strong>
              </span>
              <span>
                Piezas mostradas{" "}
                <strong>
                  {rows
                    .reduce((sum, row) => sum + number(row.quantity), 0)
                    .toLocaleString("es-MX")}
                </strong>
              </span>
            </div>
          )}
        />
      </Card>
    </Page>
  );
}
