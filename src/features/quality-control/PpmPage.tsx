import { useEffect, useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useForm } from "@/shared/hooks/useForm";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import {
  Alert,
  Button,
  Card,
  FilterBar,
  MetricChart,
  Page,
  SelectField,
  TabBar,
  TextField,
  tabIds,
  type FilterField,
} from "@/shared/ui";
import { useQuality } from "./useQuality";
import { ppmDefaults, reportDateIssue } from "./reportModel";
import type { PpmFilters, PpmStage } from "./reportTypes";
import { PpmTopTable, PpmTrendTable, PpmWeeklyTable } from "./PpmTables";
import "./reports.css";

function TargetEditor({
  stage,
  target,
  saved,
}: {
  stage: PpmStage;
  target: number;
  saved: () => void;
}) {
  const context = useQuality();
  const form = useForm({
    initialValues: { target: String(target) },
    validate: (value) =>
      /^\d+$/.test(value.target.trim()) &&
      Number.isSafeInteger(Number(value.target))
        ? []
        : ["La meta debe ser un entero mayor o igual a cero."],
    onSubmit: async (value) => {
      const actual = await context.api.savePpmTarget(
        stage,
        Number(value.target),
      );
      form.setField("target", String(actual));
      saved();
    },
  });
  return (
    <form
      className="quality-control-target"
      onSubmit={form.handleSubmit}
      aria-label={"Meta global " + stage.toUpperCase()}
    >
      <TextField
        label="TARGET"
        aria-label={"TARGET " + stage.toUpperCase()}
        type="number"
        min={0}
        step={1}
        required
        value={form.values.target}
        disabled={form.pending}
        onChange={(event) => form.setField("target", event.target.value)}
      />
      <Button type="submit" size="sm" loading={form.pending}>
        Guardar meta
      </Button>
      {(form.errors.length > 0 || form.error) && (
        <Alert tone="danger">
          {form.errors.join(" ") || form.error?.message}
        </Alert>
      )}
    </form>
  );
}
const tabs = [
  { id: "charts", label: "Gráficas" },
  { id: "trend", label: "Tendencia anual" },
  { id: "period", label: "Periodo consultado" },
  { id: "top", label: "Detalle Top 5" },
  { id: "weekly", label: "Por línea y semana" },
];
export function PpmPage({ stage }: { stage: PpmStage }) {
  const compact = useMediaQuery("(max-width: 700px)");
  const [plot, setPlot] = useState("trend");
  const context = useQuality(),
    client = useQueryClient(),
    id = useId();
  const [initial] = useState(ppmDefaults),
    [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial);
  const [knownLines, setKnownLines] = useState<string[]>([]),
    [tab, setTab] = useState("charts"),
    [issue, setIssue] = useState("");
  const query = useQuery({
    queryKey: context.key("ppm", stage, filters),
    queryFn: ({ signal }) => context.api.ppm(stage, filters, signal),
  });
  useEffect(() => {
    if (query.data)
      setKnownLines((previous) => [
        ...new Set([...previous, ...query.data.lines]),
      ]);
  }, [query.data]);
  const data = query.data,
    label = stage.toUpperCase(),
    ids = tabIds(id, tab);
  const fields: FilterField<PpmFilters>[] = [
    { key: "fecha_inicio", label: "Fecha desde", type: "date" },
    { key: "fecha_fin", label: "Fecha hasta", type: "date" },
    ...(stage === "oqc"
      ? [
          {
            key: "group_by" as const,
            label: "Periodo",
            type: "select" as const,
            options: [
              { value: "month", label: "Mes" },
              { value: "week", label: "Semana" },
              { value: "day", label: "Día" },
            ],
          },
        ]
      : []),
    {
      key: "linea",
      label: "Línea",
      type: "select",
      options: [
        { value: "", label: "Todas" },
        ...knownLines.map((value) => ({ value, label: value })),
      ],
    },
    { key: "q", label: "No. parte / familia / modelo", type: "search" },
  ];
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
          setIssue("");
        }}
        onSubmit={() => {
          const error = reportDateIssue(draft.fecha_inicio, draft.fecha_fin);
          setIssue(error);
          if (error) return;
          if (JSON.stringify(filters) === JSON.stringify(draft))
            void query.refetch();
          else setFilters({ ...draft });
        }}
      />
      <Card
        fill
        title={"PPM's " + label}
        actions={
          <>
            <Button
              size="sm"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Actualizar
            </Button>
            {data && (
              <TargetEditor
                key={stage + ":" + data.target}
                stage={stage}
                target={data.target}
                saved={() => {
                  void client.invalidateQueries({
                    queryKey: context.key("ppm", stage),
                  });
                }}
              />
            )}
          </>
        }
      >
        {issue && (
          <Alert tone="danger" className="table-notice">
            {issue}
          </Alert>
        )}
        {data && (
          <div className="quality-control-stats">
            <span>
              Inspeccionadas{" "}
              <strong>{data.summary.inspected.toLocaleString("es-MX")}</strong>
            </span>
            <span>
              Defectos{" "}
              <strong>{data.summary.defects.toLocaleString("es-MX")}</strong>
            </span>
            <span>
              PPM <strong>{data.summary.ppm.toLocaleString("es-MX")}</strong>
            </span>
          </div>
        )}
        <TabBar
          id={id}
          label={"Datos PPM " + label}
          items={tabs}
          activeId={tab}
          onChange={setTab}
        />
        <div
          className="quality-control-report-panel"
          id={ids.panel}
          role="tabpanel"
          aria-labelledby={ids.tab}
        >
          {query.error ? (
            <div className="state-panel">
              <Alert tone="danger">{query.error.message}</Alert>
              <Button onClick={() => void query.refetch()}>
                Volver a intentar
              </Button>
            </div>
          ) : !data ? (
            <div className="state-panel" role="status">
              Cargando PPM…
            </div>
          ) : tab === "charts" ? (
            <div
              className={`quality-control-charts ${compact ? "quality-control-charts-compact" : ""}`}
            >
              {compact && (
                <SelectField
                  aria-label="Gráfica PPM"
                  value={plot}
                  options={[
                    { value: "trend", label: "Tendencia anual" },
                    { value: "top", label: "Top 5 proyectos" },
                  ]}
                  onChange={(event) => setPlot(event.target.value)}
                />
              )}
              {(!compact || plot === "trend") && (
                <Card>
                  <MetricChart
                    title={`Tendencia PPM ${label} ${data.trendYear}`}
                    labels={data.trend.map((row) => row.label)}
                    series={[
                      {
                        label: "PPM",
                        values: data.trend.map((row) => row.ppm),
                        color: "#8bc2ff",
                      },
                      {
                        label: "TARGET",
                        values: data.trend.map((row) => row.target),
                        color: "#ff7070",
                      },
                    ]}
                  />
                </Card>
              )}
              {(!compact || plot === "top") && (
                <Card>
                  <MetricChart
                    title="Top 5 proyectos"
                    labels={data.topParts.map((row) => row.part_number)}
                    bars
                    series={[
                      {
                        label: "PPM",
                        values: data.topParts.map((row) => row.ppm),
                        color: "#8bc2ff",
                      },
                      {
                        label: "TARGET",
                        values: data.topParts.map((row) => row.target),
                        color: "#ff7070",
                      },
                    ]}
                  />
                </Card>
              )}
            </div>
          ) : tab === "trend" ? (
            <PpmTrendTable
              periods={data.trend}
              label={"Tendencia anual " + label}
            />
          ) : tab === "period" ? (
            <PpmTrendTable
              periods={data.periods}
              label={"Periodo consultado " + label}
            />
          ) : tab === "top" ? (
            <PpmTopTable report={data} />
          ) : (
            <PpmWeeklyTable report={data} />
          )}
        </div>
      </Card>
    </Page>
  );
}
