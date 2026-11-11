import { useMemo, useState } from "react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { Button, Page, SelectField } from "@/shared/ui";
import { ResultsTable } from "./ResultsTable";
import { TableDialog } from "./MachineDialogs";
import {
  consolidatedRows,
  passDetail,
  passFailView,
  testDetail,
  type TestKind,
} from "./machineViews";
import { col, field } from "./views";
import { text } from "./model";
import { passFailColumns } from "./passFailColumns";
import type { Row } from "./types";
import "./module.css";

export default function MachinePassPage({ kind }: { kind: TestKind }) {
  const [mode, setMode] = useState("normal");
  const [detail, setDetail] = useState<Row | null>(null);
  const [step, setStep] = useState<Row | null>(null);
  const [consolidated, setConsolidated] = useState(false);
  const spec = useMemo(
    () => passFailView(kind, mode === "detallado"),
    [kind, mode],
  );
  const consolidation = useMemo(
    () => ({
      ...passFailView("ict"),
      id: "machine-ict-consolidated",
      title: "Consolidado por número de parte",
      columns: [
        col("numero_parte", "No. parte", 160),
        col("ict", "ICT", 65),
        col("dias", "Días", 65, true),
        col("total", "Total", 85, true),
        col("ok", "OK", 85, true),
        col("ng", "NG", 85, true),
        col("pass_pct", "% Pass", 90, true),
        col("fail_pct", "% Fail", 90, true),
      ],
      fields: [
        field("fecha_desde", "Fecha desde", "date"),
        field("fecha_hasta", "Fecha hasta", "date"),
        {
          ...field("numeros_parte", "Números de parte", "textarea"),
          placeholder: "Uno por línea o separados por coma",
        },
      ],
      defaults: {
        fecha_desde: spec.defaults.fecha_desde,
        fecha_hasta: spec.defaults.fecha_hasta,
        numeros_parte: "",
      },
      mapRows: consolidatedRows,
      exportPath: "/api/ict/pass-fail/consolidado/export",
      minWidth: 760,
      manual: true,
    }),
    [spec.defaults.fecha_desde, spec.defaults.fecha_hasta],
  );
  const columns = useMemo(
    () => passFailColumns(spec, kind, mode === "detallado", setDetail),
    [spec, kind, mode],
  );
  return (
    <Page className="production-results-page" banner={<DemoBanner />}>
      <ResultsTable
        spec={spec}
        columns={columns}
        rowHeight={44}
        actions={
          kind === "ict" ? (
            <>
              <SelectField
                aria-label="Modo de resumen ICT"
                value={mode}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "detallado", label: "Detallado" },
                ]}
                onChange={(event) => setMode(event.target.value)}
              />
              <Button size="sm" onClick={() => setConsolidated(true)}>
                Consolidado por parte
              </Button>
            </>
          ) : undefined
        }
      />
      {detail && kind !== "vision" && (
        <TableDialog
          spec={passDetail(kind, detail, mode === "detallado")}
          subtitle={[
            detail.fecha,
            detail.linea,
            detail.ict ?? detail.estacion,
            detail.turno,
          ]
            .map(text)
            .filter(Boolean)
            .join(" · ")}
          onClose={() => setDetail(null)}
          extraColumns={
            kind === "fct"
              ? [
                  {
                    id: "steps",
                    header: "Pasos",
                    filterable: false,
                    width: 80,
                    cell: (row) => (
                      <Button size="sm" onClick={() => setStep(row)}>
                        Ver pasos
                      </Button>
                    ),
                  },
                ]
              : undefined
          }
        />
      )}
      {step && (
        <TableDialog
          spec={testDetail("fct", step)}
          subtitle={text(step.start_at)}
          onClose={() => setStep(null)}
        />
      )}
      {consolidated && (
        <TableDialog
          spec={consolidation}
          onClose={() => setConsolidated(false)}
        />
      )}
    </Page>
  );
}
