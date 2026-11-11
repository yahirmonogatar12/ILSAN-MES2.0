import { useEffect, useRef, useState } from "react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { useForm } from "@/shared/hooks/useForm";
import { Alert, Button, Page } from "@/shared/ui";
import { ClosureView } from "./ClosureView";
import { ResultsTable } from "./ResultsTable";
import { useResults } from "./useResults";
import { excessInventory } from "./views";
import "./module.css";

export default function ExcessPage() {
  const context = useResults();
  const [closing, setClosing] = useState(false);
  const attempted = useRef(false);
  const sync = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: async () => {
      await context.api.syncExits();
      await context.refresh();
    },
  });
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void sync.submit();
  }, [sync]);
  return (
    <Page banner={<DemoBanner />} className="production-results-page">
      <div hidden={closing} className="production-results-tab-panel">
        <ResultsTable
          spec={excessInventory}
          active={!closing}
          actions={
            <>
              <Button
                size="sm"
                loading={sync.pending}
                onClick={() => void sync.submit()}
              >
                Sincronizar salidas
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={sync.pending}
                onClick={() => setClosing(true)}
              >
                Cierre de inventario
              </Button>
            </>
          }
          notice={
            sync.error ? (
              <Alert tone="warning" className="table-notice">
                {sync.error.message} Usa Sincronizar salidas para reintentar.
              </Alert>
            ) : undefined
          }
        />
      </div>
      {closing && <ClosureView onClose={() => setClosing(false)} />}
    </Page>
  );
}
