import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { Alert, Button, Page, SelectField, TabBar, tabIds } from "@/shared/ui";
import { ResultsTable } from "./ResultsTable";
import { useResults } from "./useResults";
import { finishedViews, repairViews } from "./views";
import "./module.css";

export function RepairPage({ area }: { area: "smd" | "assy" }) {
  const specs = useMemo(() => repairViews(area), [area]);
  const [tab, setTab] = useState(specs[0].id);
  const id = useId();
  const labels = [
    "Stock actual",
    "Detalle de movimientos",
    "Resumen por defecto",
  ];
  return (
    <Page banner={<DemoBanner />} className="production-results-page">
      <TabBar
        id={id}
        label={"Vistas de reparación " + area.toUpperCase()}
        activeId={tab}
        onChange={setTab}
        items={specs.map((spec, index) => ({
          id: spec.id,
          label: labels[index],
        }))}
      />
      {specs.map((spec) => (
        <div
          key={spec.id}
          role="tabpanel"
          id={tabIds(id, spec.id).panel}
          aria-labelledby={tabIds(id, spec.id).tab}
          hidden={tab !== spec.id}
          className="production-results-tab-panel"
        >
          <ResultsTable spec={spec} active={tab === spec.id} />
        </div>
      ))}
    </Page>
  );
}
export default function FinishedPage() {
  const context = useResults();
  const [tab, setTab] = useState(finishedViews[0].id);
  const [snapshot, setSnapshot] = useState("");
  const id = useId();
  const dates = useQuery({
    queryKey: context.key("snapshots"),
    queryFn: ({ signal }) => context.api.snapshotDates(signal),
    staleTime: 300_000,
  });
  const specs = useMemo(
    () =>
      finishedViews.map((spec, index) =>
        snapshot && index < 2
          ? {
              ...spec,
              path:
                "/api/snapshot_inventario/" +
                (index === 0 ? "general" : "ubicacion"),
              fields: spec.fields.filter((field) => field.key === "q"),
              title: spec.title + " · Snapshot " + snapshot,
            }
          : spec,
      ),
    [snapshot],
  );
  return (
    <Page banner={<DemoBanner />} className="production-results-page">
      <div className="production-results-snapshot">
        <SelectField
          label="Snapshot de inventario"
          value={snapshot}
          disabled={dates.isPending}
          onChange={(event) => setSnapshot(event.target.value)}
          options={[
            { value: "", label: "Inventario actual" },
            ...(dates.data ?? []).map((item) => ({
              value: item.fecha,
              label: item.fecha + (item.hora ? " · " + item.hora : ""),
            })),
          ]}
        />
        {snapshot && (
          <Button size="sm" onClick={() => setSnapshot("")}>
            Volver en vivo
          </Button>
        )}
        {dates.error && (
          <Alert tone="warning">
            {dates.error.message}{" "}
            <Button size="sm" onClick={() => void dates.refetch()}>
              Reintentar snapshots
            </Button>
          </Alert>
        )}
      </div>
      <TabBar
        id={id}
        label="Vistas de inventario terminado"
        activeId={tab}
        onChange={setTab}
        items={specs.map((spec, index) => ({
          id: spec.id,
          label: ["Inventario general", "Ubicación", "Movimientos"][index],
        }))}
      />
      {specs.map((spec, index) => (
        <div
          key={spec.id}
          role="tabpanel"
          id={tabIds(id, spec.id).panel}
          aria-labelledby={tabIds(id, spec.id).tab}
          hidden={tab !== spec.id}
          className="production-results-tab-panel"
        >
          <ResultsTable
            key={snapshot && index < 2 ? snapshot : spec.id}
            spec={spec}
            active={tab === spec.id}
            extra={snapshot && index < 2 ? { fecha: snapshot } : {}}
            notice={
              snapshot && index === 2 ? (
                <Alert tone="info" className="table-notice">
                  Los movimientos corresponden al historial en vivo y sus fechas
                  de consulta.
                </Alert>
              ) : undefined
            }
          />
        </div>
      ))}
    </Page>
  );
}
