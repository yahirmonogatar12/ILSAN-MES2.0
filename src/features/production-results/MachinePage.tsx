import { useId, useMemo, useState } from "react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import {
  Button,
  CheckboxField,
  DialogBody,
  DialogFooter,
  Modal,
  Page,
  TabBar,
  tabIds,
  type TableColumn,
} from "@/shared/ui";
import { ResultsTable } from "./ResultsTable";
import { MachineComparison } from "./MachineComparison";
import { VisionDetail } from "./VisionDetail";
import {
  machineView,
  testDetail,
  visionStops,
  type MachineKind,
} from "./machineViews";
import { text } from "./model";
import { RecordFacts, TableDialog } from "./MachineDialogs";
import type { Row } from "./types";
import "./module.css";

function recordKey(row: Row): string {
  return JSON.stringify([row.barcode, row.ts]);
}
export default function MachinePage({ kind }: { kind: MachineKind }) {
  const spec = useMemo(() => machineView(kind), [kind]);
  const stops = useMemo(() => visionStops(), []);
  const [tab, setTab] = useState("records");
  const [selected, setSelected] = useState<Record<string, Row>>({});
  const [detail, setDetail] = useState<Row | null>(null);
  const [comparison, setComparison] = useState<readonly Row[] | null>(null);
  const id = useId();
  const selection: TableColumn<Row>[] =
    kind === "ict"
      ? [
          {
            id: "compare",
            header: "Comparar",
            filterable: false,
            width: 65,
            cell: (row) => (
              <CheckboxField
                label={"Comparar " + text(row.barcode) + " · " + text(row.ts)}
                containerClassName="production-results-check"
                checked={!!selected[recordKey(row)]}
                onChange={(event) =>
                  setSelected((previous) => {
                    const next = { ...previous };
                    if (event.target.checked) next[recordKey(row)] = row;
                    else delete next[recordKey(row)];
                    return next;
                  })
                }
              />
            ),
          },
        ]
      : [];
  const actionColumns: TableColumn<Row>[] = [
    "ict",
    "fct",
    "vision",
    "changes",
  ].includes(kind)
    ? [
        {
          id: "detail",
          header: "Detalle",
          filterable: false,
          width: 80,
          cell: (row) => (
            <Button
              size="sm"
              aria-label={
                "Ver detalle " +
                text(
                  (kind === "fct" ? row.serial_number : row.barcode) ??
                    row.componente,
                ) +
                " · " +
                text(row.ts ?? row.hora_cambio ?? row.id)
              }
              onClick={() => setDetail(row)}
            >
              Ver
            </Button>
          ),
        },
      ]
    : [];
  return (
    <Page banner={<DemoBanner />} className="production-results-page">
      {kind === "vision" && (
        <TabBar
          id={id}
          label="Vistas de Visión"
          activeId={tab}
          onChange={setTab}
          items={[
            { id: "records", label: "Historial de pruebas" },
            { id: "stops", label: "Paros reales" },
          ]}
        />
      )}
      <div
        hidden={tab !== "records"}
        className="production-results-tab-panel"
        role={kind === "vision" ? "tabpanel" : undefined}
        id={tabIds(id, "records").panel}
        aria-labelledby={
          kind === "vision" ? tabIds(id, "records").tab : undefined
        }
      >
        <ResultsTable
          spec={spec}
          active={tab === "records"}
          leadingColumns={selection}
          extraColumns={actionColumns}
          actions={
            kind === "ict" ? (
              <>
                <Button
                  size="sm"
                  disabled={Object.keys(selected).length < 2}
                  onClick={() => setComparison(Object.values(selected))}
                >
                  Comparar parámetros ({Object.keys(selected).length})
                </Button>
                {Object.keys(selected).length > 0 && (
                  <Button size="sm" onClick={() => setSelected({})}>
                    Limpiar selección
                  </Button>
                )}
              </>
            ) : undefined
          }
        />
      </div>
      {kind === "vision" && (
        <div
          hidden={tab !== "stops"}
          className="production-results-tab-panel"
          role="tabpanel"
          id={tabIds(id, "stops").panel}
          aria-labelledby={tabIds(id, "stops").tab}
        >
          <ResultsTable
            spec={stops}
            active={tab === "stops"}
            extraColumns={[
              {
                id: "detail",
                header: "Ajustes",
                filterable: false,
                width: 80,
                cell: (row) => (
                  <Button
                    size="sm"
                    onClick={() => setDetail({ ...row, stop: true })}
                  >
                    Ver
                  </Button>
                ),
              },
            ]}
          />
        </div>
      )}
      {detail && (kind === "ict" || kind === "fct") && (
        <TableDialog
          spec={testDetail(kind, detail)}
          subtitle={text(detail.ts ?? detail.start_at)}
          onClose={() => setDetail(null)}
        />
      )}
      {detail && kind === "vision" && !detail.stop && (
        <VisionDetail record={detail} onClose={() => setDetail(null)} />
      )}
      {detail && (kind === "changes" || !!detail.stop) && (
        <Modal
          title={
            kind === "changes"
              ? "Detalle del cambio de parámetros"
              : "Detalle del paro y ajustes"
          }
          size="lg"
          onClose={() => setDetail(null)}
          className="production-results-detail"
        >
          <DialogBody>
            <RecordFacts
              record={Object.fromEntries(
                Object.entries(detail).filter(([key]) => key !== "stop"),
              )}
              labels={{
                archivo_anterior: "Archivo anterior",
                archivo_cambio: "Archivo del cambio",
                barcode_anterior: "Barcode anterior",
                barcode_cambio: "Barcode del cambio",
                componente_raw: "Componente original",
              }}
            />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setDetail(null)}>Cerrar</Button>
          </DialogFooter>
        </Modal>
      )}
      {comparison && (
        <MachineComparison
          records={comparison}
          onClose={() => setComparison(null)}
        />
      )}
    </Page>
  );
}
