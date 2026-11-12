import { ReportDialog } from "./components";
import { ImportDialog } from "./ImportDialog";
import { ProposalDialog } from "./ProposalDialog";
import { HISTORY_SPECS } from "./model";
import type { usePivot } from "./usePivot";
export function PivotDialogs({
  pivot,
}: {
  pivot: ReturnType<typeof usePivot>;
}) {
  const { dialog, setDialog, history, done, applied } = pivot;
  if (dialog?.type === "import")
    return (
      <ImportDialog
        kind={dialog.kind}
        onClose={() => setDialog(null)}
        onDone={done}
      />
    );
  if (dialog?.type === "history")
    return (
      <ReportDialog
        title="Historial de importaciones LG"
        records={history.data ?? []}
        specs={HISTORY_SPECS}
        loading={history.isPending}
        error={history.error}
        onRetry={() => void history.refetch()}
        onClose={() => setDialog(null)}
      />
    );
  if (dialog?.type === "proposal")
    return (
      <ProposalDialog
        filters={applied}
        onClose={() => setDialog(null)}
        onDone={done}
      />
    );
  return null;
}
