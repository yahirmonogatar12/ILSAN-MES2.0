import { PlanForm } from "./PlanForm";
import { ImportPlans } from "./ImportPlans";
import { Reschedule } from "./Reschedule";
import { AssyTools } from "./AssyTools";
import { SHIFTS } from "./model";
import type { PlansController } from "./usePlans";
export function PlanDialogs({ state }: { state: PlansController }) {
  const { kind, dialog, setDialog, applied, source, done } = state;
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
          plans={source}
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
          reloadSubAssy={
            dialog.type === "edit" && kind === "ASSY"
              ? () => state.reloadSubAssy(dialog.row.lot_no)
              : undefined
          }
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
    </>
  );
}
