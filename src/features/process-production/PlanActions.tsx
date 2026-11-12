import { RefreshCw } from "lucide-react";
import { ActionGroup, Button, ExportButton, TextField } from "@/shared/ui";
import type { PlansController } from "./usePlans";
export function PlanActions({ state }: { state: PlansController }) {
  const {
    kind,
    ready,
    dirty,
    query,
    data,
    exportForm,
    setDialog,
    orderForm,
    discard,
  } = state;
  return (
    <>
      <Button
        size="sm"
        disabled={!ready || dirty}
        icon={<RefreshCw size={15} />}
        onClick={() => void query.refetch()}
      >
        Actualizar
      </Button>
      <ExportButton
        size="sm"
        disabled={!ready || dirty || !data.length}
        loading={exportForm.pending}
        title="Exporta los planes de la consulta y línea seleccionada, con su orden y tiempos."
        onClick={() => void exportForm.submit()}
      />
      <Button
        size="sm"
        variant="success"
        disabled={dirty}
        onClick={() => setDialog({ type: "new" })}
      >
        Nuevo plan
      </Button>
      <ActionGroup
        label="Acciones de planes"
        actions={[
          {
            id: "reschedule",
            label: "Reprogramar",
            disabled: dirty,
            onClick: () => setDialog({ type: "reschedule" }),
          },
          ...(kind === "ASSY"
            ? [
                {
                  id: "wos",
                  label: "Importar WOs",
                  disabled: dirty,
                  onClick: () => setDialog({ type: "wos" }),
                },
                {
                  id: "scan",
                  label: "Lotes SCAN sin asignar",
                  disabled: dirty,
                  onClick: () => setDialog({ type: "scan" }),
                },
                {
                  id: "ia",
                  label: "Plan IA",
                  disabled: dirty,
                  onClick: () => setDialog({ type: "proposals" }),
                },
              ]
            : [
                {
                  id: "excel",
                  label: "Importar Excel",
                  disabled: dirty,
                  onClick: () => setDialog({ type: "import" }),
                },
              ]),
          ...(kind !== "ASSY"
            ? [
                {
                  id: "order",
                  label: "Guardar orden",
                  disabled: !dirty || !ready || orderForm.pending,
                  onClick: () => void orderForm.submit(),
                },
                {
                  id: "discard-order",
                  label: "Descartar orden",
                  disabled: !dirty || orderForm.pending,
                  onClick: () => discard(),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
export function PlanOrderControls({ state }: { state: PlansController }) {
  const { kind, groups, setGroups, ready, dirty, orderForm, arrange, discard } =
    state;
  const orderNotice = (
    <span
      className="process-production-order-notice"
      role="status"
      aria-live="polite"
      title={dirty ? "Orden sin guardar" : undefined}
    >
      {dirty && (
        <>
          <span className="process-production-order-dot" aria-hidden="true">
            ●
          </span>
          <span className="process-production-order-text">
            Orden sin guardar.
          </span>
        </>
      )}
    </span>
  );
  return (
    <>
      {kind === "ASSY" && (
        <div className="process-production-controls">
          <TextGroupCount value={groups} onChange={setGroups} />
          <Button
            size="sm"
            disabled={!ready || orderForm.pending}
            onClick={arrange}
          >
            Auto acomodo
          </Button>
          <div
            className="process-production-order-controls"
            data-dirty={dirty}
            aria-hidden={!dirty}
            inert={!dirty}
          >
            {orderNotice}
            <Button
              size="sm"
              aria-label="Guardar orden"
              loading={orderForm.pending}
              disabled={!dirty || !ready}
              onClick={() => void orderForm.submit()}
            >
              Guardar
              <span className="process-production-order-suffix"> orden</span>
            </Button>
            <Button
              size="sm"
              aria-label="Descartar orden"
              disabled={!dirty || orderForm.pending}
              onClick={() => discard()}
            >
              Descartar
              <span className="process-production-order-suffix"> orden</span>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
function TextGroupCount({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <TextField
      label="Grupos"
      type="number"
      min={1}
      max={12}
      step={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
