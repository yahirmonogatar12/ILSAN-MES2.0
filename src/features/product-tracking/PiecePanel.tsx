import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Card,
  DataGrid,
  EmptyState,
  ExportButton,
  FilterBar,
} from "@/shared/ui";
import { PieceSummary, stageColumns } from "./columns";
import { useTracking } from "./useTracking";
import type { PieceStage } from "./types";

export function PiecePanel({ active }: { active: boolean }) {
  const { api, scope } = useTracking();
  const [draft, setDraft] = useState({ codigo: "" });
  const [applied, setApplied] = useState("");
  const [issue, setIssue] = useState("");
  const query = useQuery({
    queryKey: ["product-tracking", scope, "piece", applied],
    queryFn: ({ signal }) => api.lookup(applied, signal),
    enabled: active && !!applied,
  });
  const rows = useMemo<PieceStage[]>(
    () =>
      query.data?.items.flatMap((piece, index) =>
        piece.etapas.map((stage, sequence) => ({
          ...stage,
          piece,
          pieceKey: String(index),
          sequence: sequence + 1,
        })),
      ) || [],
    [query.data],
  );
  const grouping = useMemo(
    () => ({
      key: (row: PieceStage) => row.pieceKey,
      header: ({ rows }: { rows: readonly PieceStage[] }) => (
        <PieceSummary piece={rows[0].piece} />
      ),
    }),
    [],
  );
  const exportForm = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () => api.exportLookup(applied),
  });
  return (
    <div className="product-tracking-panel">
      <FilterBar
        fields={[
          {
            key: "codigo",
            label: "Código de la pieza (QR o barcode)",
            type: "search",
            placeholder: "Escanea o pega el QR / barcode de la pieza...",
            autoFocus: true,
          },
        ]}
        values={draft}
        defaults={{ codigo: "" }}
        pending={query.isFetching}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
        onReset={() => {
          setDraft({ codigo: "" });
          setApplied("");
          setIssue("");
        }}
        onSubmit={() => {
          const codigo = draft.codigo.trim();
          setIssue(codigo ? "" : "Escanea o escribe un QR / barcode.");
          if (!codigo) return;
          if (codigo === applied) void query.refetch();
          setApplied(codigo);
        }}
      />
      <Card
        fill
        title="Historial de procesos"
        badge={query.data?.items.length}
        actions={
          <ExportButton
            size="sm"
            loading={exportForm.pending}
            disabled={!applied || !query.isSuccess || query.isFetching}
            onClick={() => void exportForm.submit()}
          />
        }
      >
        {(issue || exportForm.error) && (
          <Alert className="product-tracking-message" tone="danger">
            {issue || exportForm.error?.message}
          </Alert>
        )}
        <DataGrid
          label="Etapas de producción"
          rows={applied ? rows : []}
          columns={stageColumns}
          rowKey={(row) => row.pieceKey + ":" + row.sequence}
          minWidth={680}
          layout="fixed"
          className="product-tracking-table product-tracking-stages"
          grouping={grouping}
          loading={!!applied && query.isPending}
          fetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          resetKey={applied}
          emptyState={
            <EmptyState
              title={applied ? "Sin historial" : "Escanea una pieza"}
              message={
                applied
                  ? query.data?.message || "Sin historial para ese código."
                  : "Consulta su QR o barcode para ver las etapas registradas."
              }
            />
          }
        />
      </Card>
    </div>
  );
}
