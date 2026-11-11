import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useForm } from "@/shared/hooks/useForm";
import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  ExportButton,
  FilterBar,
  MetricChart,
  Page,
  SelectField,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import { useQuality } from "./useQuality";
import {
  lqcDefaults,
  lqcFiltered,
  lqcSummary,
  operationalDate,
  reportDateIssue,
} from "./reportModel";
import { lqcDetailColumns, lqcSummaryColumns } from "./reportColumns";
import { number, text } from "./model";
import type { LqcFilters } from "./reportTypes";
import type { Row } from "./types";
import "./reports.css";

export default function LqcReleasePage() {
  const context = useQuality();
  const [screen, setScreen] = useState("lines"),
    [view, setView] = useState("summary"),
    [chartLine, setChartLine] = useState("");
  const [initial] = useState(lqcDefaults),
    [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial),
    [issue, setIssue] = useState("");
  const [opened, setOpened] = useState(false);
  const overview = useQuery({
    queryKey: context.key("lqc-overview"),
    queryFn: ({ signal }) => context.api.lqcOverview(signal),
    enabled: screen === "lines",
  });
  const query = useQuery({
    queryKey: context.key(
      "lqc-records",
      filters.fecha_inicio,
      filters.fecha_fin,
      filters.linea,
      filters.turno,
    ),
    queryFn: ({ signal }) => context.api.lqcRecords(filters, signal),
    enabled: screen === "records",
  });
  const visible = useMemo(
    () => lqcFiltered(query.data ?? [], filters.search),
    [query.data, filters.search],
  );
  const allLines = !filters.linea;
  const columns: TableColumn<Row>[] = useMemo(
    () => (view === "summary" ? lqcSummaryColumns(allLines) : lqcDetailColumns),
    [allLines, view],
  );
  const rows = useMemo<Row[]>(
    () =>
      view === "summary"
        ? lqcSummary(visible, allLines)
        : visible.map((row) => ({ ...row, quantity: 1 })),
    [visible, allLines, view],
  );
  const download = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () =>
      exportSpreadsheet("liberacion_lqc_" + view + ".xlsx", [
        {
          name: view === "summary" ? "Resumen LQC" : "Detalle LQC",
          rows: [
            columns.map((col) => col.header),
            ...rows.map((row) =>
              columns.map((col) =>
                typeof row[col.id] === "number"
                  ? number(row[col.id])
                  : text(row[col.id]),
              ),
            ),
          ],
        },
      ]),
  });
  const lines = overview.data?.lines ?? [];
  function open(line: string) {
    const next = opened
      ? { ...filters, linea: line }
      : lqcDefaults(overview.data?.date || operationalDate());
    next.linea = line;
    setFilters(next);
    setDraft(next);
    setOpened(true);
    setScreen("records");
    setIssue("");
  }
  const fields: FilterField<LqcFilters>[] = [
    { key: "fecha_inicio", label: "Fecha desde", type: "date" },
    { key: "fecha_fin", label: "Fecha hasta", type: "date" },
    {
      key: "turno",
      label: "Turno",
      type: "select",
      options: ["Todos", "DIA", "TIEMPO EXTRA", "NOCHE"].map((value) => ({
        value,
        label: value,
      })),
    },
    {
      key: "search",
      label: "Buscar",
      type: "search",
      placeholder: "Parte, lote, caja, serial o historial…",
    },
  ];
  const slots = overview.data?.slots ?? [];
  const chartValues = slots.map((slot) =>
    chartLine
      ? number(overview.data?.uph[chartLine]?.[text(slot.key)])
      : Object.values(overview.data?.uph ?? {}).reduce(
          (sum, hourly) => sum + number(hourly[text(slot.key)]),
          0,
        ),
  );
  return (
    <Page className="quality-control-page" banner={<DemoBanner />}>
      {screen === "lines" ? (
        <>
          <Card
            title="Liberación LQC por línea"
            actions={
              <>
                <span className="quality-control-stopped">
                  Día operativo {overview.data?.date || operationalDate()}
                </span>
                <Button
                  size="sm"
                  disabled={overview.isFetching}
                  onClick={() => void overview.refetch()}
                >
                  Actualizar
                </Button>
                <Button size="sm" variant="primary" onClick={() => open("")}>
                  Todas las líneas
                </Button>
              </>
            }
          >
            <div className="quality-control-lines">
              {lines
                .filter((row) => row.linea !== "SIN PLAN")
                .map((row) => (
                  <Button
                    key={text(row.linea)}
                    aria-label={
                      text(row.linea) +
                      " " +
                      number(row.total_hoy) +
                      " escaneos"
                    }
                    onClick={() => open(text(row.linea))}
                    className="quality-control-line-card"
                  >
                    <strong>{text(row.linea)}</strong>
                    <span>
                      {number(row.total_hoy).toLocaleString("es-MX")} escaneos
                    </span>
                  </Button>
                ))}
            </div>
          </Card>
          <Card
            fill
            title="Escaneos por hora"
            actions={
              <SelectField
                aria-label="Línea de la gráfica"
                value={chartLine}
                options={[
                  { value: "", label: "Todas las líneas" },
                  ...lines.map((row) => ({
                    value: text(row.linea),
                    label: text(row.linea),
                  })),
                ]}
                onChange={(event) => setChartLine(event.target.value)}
              />
            }
          >
            {overview.error ? (
              <Alert tone="danger">{overview.error.message}</Alert>
            ) : overview.isPending ? (
              <div role="status" className="state-panel">
                Cargando líneas…
              </div>
            ) : (
              <MetricChart
                title={chartLine || "Todas las líneas"}
                labels={slots.map((slot) => text(slot.label))}
                series={[
                  { label: "Escaneos", values: chartValues, color: "#54b7ef" },
                ]}
              />
            )}
          </Card>
        </>
      ) : (
        <>
          <FilterBar
            fields={fields}
            values={draft}
            defaults={initial}
            pending={query.isFetching}
            onChange={(patch) =>
              setDraft((previous) => ({ ...previous, ...patch }))
            }
            onReset={() => {
              const next = { ...lqcDefaults(), linea: filters.linea };
              setDraft(next);
              setFilters(next);
              setIssue("");
            }}
            onSubmit={() => {
              const error = reportDateIssue(
                draft.fecha_inicio,
                draft.fecha_fin,
              );
              setIssue(error);
              if (error) return;
              if (JSON.stringify(draft) === JSON.stringify(filters))
                void query.refetch();
              else setFilters({ ...draft });
            }}
          />
          <Card
            fill
            title={filters.linea || "Todas las líneas"}
            badge={visible.length}
            actions={
              <>
                <Button size="sm" onClick={() => setScreen("lines")}>
                  Líneas
                </Button>
                <SelectField
                  aria-label="Vista LQC"
                  value={view}
                  options={[
                    { value: "summary", label: "Resumen" },
                    { value: "detail", label: "Detalle" },
                  ]}
                  onChange={(event) => setView(event.target.value)}
                />
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
                  disabled={query.isPending || query.isError || !rows.length}
                  title="Exporta la vista con las fechas, línea, turno y búsqueda consultados."
                  onClick={() => void download.submit()}
                />
              </>
            }
          >
            {(issue || download.error) && (
              <Alert tone="danger" className="table-notice">
                {issue || download.error?.message}
              </Alert>
            )}
            <DataGrid
              label={
                view === "summary"
                  ? "Resumen de liberación LQC"
                  : "Detalle de liberación LQC"
              }
              rows={rows}
              columns={columns}
              rowKey={(row, index) =>
                text(row.serial ?? row.part) + ":" + index
              }
              layout="fixed"
              minWidth={view === "summary" ? 920 : 1370}
              loading={query.isPending}
              error={query.error}
              onRetry={() => void query.refetch()}
              resetKey={JSON.stringify([filters, view])}
              rowProps={(row) => ({
                className:
                  row.duplicado_historico === true
                    ? "quality-control-duplicate"
                    : undefined,
              })}
              summary={() => (
                <div className="quality-control-stats">
                  <span>
                    Escaneos <strong>{visible.length}</strong>
                  </span>
                  <span>
                    Partes{" "}
                    <strong>
                      {new Set(visible.map((row) => text(row.part))).size}
                    </strong>
                  </span>
                  <span>Día operativo de 07:30 a 07:30</span>
                </div>
              )}
            />
          </Card>
        </>
      )}
    </Page>
  );
}
