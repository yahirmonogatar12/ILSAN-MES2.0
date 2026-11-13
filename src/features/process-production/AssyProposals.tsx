import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  Modal,
} from "@/shared/ui";
import { FormDialog } from "./components";
import { makeColumns } from "./columns";
import { useProcess } from "./useProcess";
import { ProposalComparison } from "./ProposalComparison";
import { assyPayloads } from "./requests";
import type { AssyToolProps, Proposal, ProposalDiff, Row } from "./types";
type Confirmation = {
  action: "apply-diff" | "import-proposal";
  title: string;
  description: string;
  initial: Row;
};
const specs = [
  ["proposal_id", "PROPUESTA", 250],
  ["version", "VERSIÓN", 65],
  ["date_from", "DESDE", 100],
  ["date_to", "HASTA", 100],
  ["status", "ESTADO", 90],
  ["total_items", "LOTES", 75],
  ["total_qty", "PIEZAS", 90],
  ["created_at", "CREADA", 140],
] as const;
export function AssyProposals({ onClose, onDone }: AssyToolProps) {
  const context = useProcess();
  const [diff, setDiff] = useState<ProposalDiff | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Confirmation | null>(null);
  const comparing = useRef<AbortController | null>(null);
  useEffect(() => {
    setBusy(false);
    return () => {
      comparing.current?.abort();
      comparing.current = null;
    };
  }, []);
  const query = useQuery({
    queryKey: context.key("assy-tools", "proposals", {}),
    queryFn: ({ signal }) => context.api.extra("proposals", {}, signal),
  });
  async function compare(row: Proposal) {
    if (comparing.current) return;
    const controller = new AbortController();
    comparing.current = controller;
    setBusy(true);
    setError("");
    try {
      const value = await context.api.extra(
        "diff",
        { proposal_id: row.proposal_id },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setDiff({ ...value, proposal_id: row.proposal_id });
      setSelected(
        new Set(
          value.cambios
            .filter(
              (change) => !change.bloqueado && !!change.aplicables?.length,
            )
            .map((change) => change.lot_no),
        ),
      );
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo comparar la propuesta.",
        );
    } finally {
      if (comparing.current === controller) {
        comparing.current = null;
        setBusy(false);
      }
    }
  }
  const columns = [
    ...makeColumns(specs).map((column) => ({
      ...column,
      width: `${parseFloat(String(column.width)) * 0.88}%`,
    })),
    {
      id: "actions",
      header: "ACCIONES",
      width: "12%",
      filterable: false,
      cell: (row: Proposal) => (
        <Button
          size="sm"
          disabled={busy || query.isFetching}
          onClick={() => void compare(row)}
        >
          Ver cambios
        </Button>
      ),
    },
  ];
  return (
    <>
      <Modal
        title="Propuestas IA · ASSY"
        size="xl"
        className="process-production-dialog"
        onClose={onClose}
      >
        <DialogBody>
          {error && <Alert tone="danger">{error}</Alert>}
          {diff ? (
            <ProposalComparison
              diff={diff}
              selected={selected}
              setSelected={setSelected}
            />
          ) : (
            <DataGrid
              label="Propuestas disponibles"
              rows={query.data ?? []}
              columns={columns}
              rowKey={(row) => row.proposal_id}
              loading={query.isPending}
              error={query.error}
              onRetry={() => void query.refetch()}
              minWidth={1000}
              layout="fixed"
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
          {diff && (
            <>
              <Button
                onClick={() => {
                  setDiff(null);
                  setSelected(new Set());
                }}
              >
                Volver a propuestas
              </Button>
              <Button
                disabled={!selected.size}
                onClick={() =>
                  setDialog({
                    title: "Aplicar cambios de propuesta",
                    action: "apply-diff",
                    description:
                      "Se aplicarán únicamente los cambios seleccionados. El servidor volverá a comprobar los lotes iniciados y las restricciones de producción.",
                    initial: {
                      proposal_id: diff.proposal_id,
                      cambios: diff.cambios
                        .filter(
                          (row) =>
                            selected.has(row.lot_no) &&
                            !row.bloqueado &&
                            !!row.aplicables?.length,
                        )
                        .map((row) => ({ ...row.despues, lot_no: row.lot_no })),
                    },
                  })
                }
              >
                Aplicar cambios ({selected.size})
              </Button>
              {diff.nuevos.length > 0 && (
                <Button
                  onClick={() =>
                    setDialog({
                      title: "Insertar lotes de propuesta",
                      action: "import-proposal",
                      description:
                        "Se insertarán los lotes nuevos de la propuesta; los lotes existentes se conservarán.",
                      initial: { proposal_id: diff.proposal_id },
                    })
                  }
                >
                  Insertar lotes nuevos ({diff.nuevos.length})
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </Modal>
      {dialog && (
        <FormDialog
          title={dialog.title}
          description={dialog.description}
          fields={[]}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSave={(value) =>
            context.api.extra(dialog.action, assyPayloads[dialog.action](value))
          }
          onDone={onDone}
          label="Confirmar"
        />
      )}
    </>
  );
}
