import { FormDialog } from "./components";
import { PlanForm } from "./PlanForm";
import { ImportPlans } from "./ImportPlans";
import { Reschedule } from "./Reschedule";
import { AssyTools } from "./AssyTools";
import { SHIFTS, text } from "./model";
import type { Field, Row } from "./types";
import type { PlansController } from "./usePlans";
export function PlanDialogs({ state }: { state: PlansController }) {
  const {
    kind,
    context,
    dialog,
    setDialog,
    applied,
    source,
    moveGroup,
    setResult,
    done,
  } = state;
  let actionFields: Field[] = [],
    actionInitial: Row = {},
    actionTitle = "";
  const row = dialog && "row" in dialog ? dialog.row : undefined;
  if (dialog?.type === "cancel") {
    actionTitle = `${row?.status === "CANCELADO" ? "Reactivar" : "Cancelar"} plan`;
    actionInitial = {
      lot_no: row?.lot_no,
      status: row?.status === "CANCELADO" ? "PLAN" : "CANCELADO",
    };
  }
  if (dialog?.type === "group") {
    actionTitle = `Mover de grupo · ${text(row?.lot_no)}`;
    actionInitial = { group_no: row?.group_no ?? 1 };
    actionFields = [
      {
        key: "group_no",
        label: "Grupo destino",
        type: "number",
        min: 1,
        max: 12,
        step: 1,
        required: true,
      },
    ];
  }
  const commonInitial = {
    working_date: applied.end,
    line: kind === "ASSY" ? "M1" : kind === "IMT" ? "P1" : "SA",
    plan_count: 0,
    turno: "DIA",
    shift: "DIA",
    group_no: 1,
    sequence: source.length + 1,
    ct: 0,
    uph: 100,
    qr_required_count: 1,
    array_size: 1,
    lado: "",
    process: kind === "IMT" ? "IMD" : kind,
  };
  return (
    <>
      {(dialog?.type === "new" || dialog?.type === "edit") && (
        <PlanForm
          kind={kind}
          editing={dialog.type === "edit"}
          initial={
            dialog.type === "edit"
              ? {
                  ...commonInitial,
                  ...dialog.row,
                  turno: SHIFTS[Number(dialog.row.routing ?? 1) - 1] ?? "DIA",
                }
              : commonInitial
          }
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === "import" && (
        <ImportPlans
          kind={kind}
          date={applied.end}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === "reschedule" && (
        <Reschedule
          kind={kind}
          initial={applied}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog &&
        (dialog.type === "wos" ||
          dialog.type === "scan" ||
          dialog.type === "proposals") && (
          <AssyTools
            tool={dialog.type}
            initial={applied}
            onClose={() => setDialog(null)}
            onDone={done}
          />
        )}
      {dialog && (dialog.type === "cancel" || dialog.type === "group") && (
        <FormDialog
          title={actionTitle}
          description={
            dialog.type === "cancel"
              ? `Se actualizará el estado de ${text(row?.lot_no)}. Se conserva el registro y su trazabilidad.`
              : dialog.type === "group"
                ? "El cambio quedará en el orden local hasta pulsar Guardar orden."
                : undefined
          }
          fields={actionFields}
          initial={actionInitial}
          onClose={() => setDialog(null)}
          label={dialog.type === "group" ? "Mover" : "Confirmar"}
          onSave={async (value) => {
            if (dialog.type === "group") {
              const issue = moveGroup(
                text(row?.lot_no),
                Number(value.group_no),
                text(row?.working_date),
              );
              if (issue) throw new Error(issue);
              setDialog(null);
              return { message: "Grupo actualizado en el orden local." };
            }
            return context.api.action(kind, "update", {
              ...value,
              lot_no: text(value.lot_no),
            });
          }}
          onDone={(value) => {
            if (dialog.type === "group") {
              setResult(value);
              return;
            }
            done(value);
          }}
        />
      )}
    </>
  );
}
