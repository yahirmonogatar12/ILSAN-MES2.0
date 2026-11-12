import { useState, type Dispatch, type SetStateAction } from "react";
import { CheckboxField, DataGrid, TabBar } from "@/shared/ui";
import { makeColumns } from "./components";
import { record, rows, text } from "./model";
import type { ProposalDiff, Row } from "./types";
export function ProposalComparison({
  diff,
  selected,
  setSelected,
}: {
  diff: ProposalDiff;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
}) {
  const [tab, setTab] = useState("changes");
  const changes = diff ? rows(diff.cambios) : [];
  const diffRows = (
    tab === "changes"
      ? changes
      : diff
        ? rows(tab === "new" ? diff.nuevos : diff.sobran)
        : []
  ).map((row) => ({ ...row, _old: row.antes, _new: row.despues }));
  const diffColumns =
    tab === "changes"
      ? [
          {
            id: "include",
            header: "INCLUIR",
            width: "6%",
            filterable: false,
            cell: (row: Row) => (
              <CheckboxField
                aria-label={`Aplicar ${text(row.lot_no)}`}
                checked={selected.has(text(row.lot_no))}
                disabled={
                  !!row.bloqueado ||
                  !Array.isArray(row.aplicables) ||
                  !row.aplicables.length
                }
                onChange={(event) =>
                  setSelected((previous) => {
                    const next = new Set(previous);
                    if (event.target.checked) next.add(text(row.lot_no));
                    else next.delete(text(row.lot_no));
                    return next;
                  })
                }
              />
            ),
          },
          ...makeColumns([
            ["lot_no", "LOTE", 160],
            ["part_no", "PARTE", 140],
            ["_old", "ANTES (cantidad / línea / grupo / secuencia)", 300],
            ["_new", "DESPUÉS (cantidad / línea / grupo / secuencia)", 300],
            ["aplicables", "CAMPOS APLICABLES", 180],
            ["bloqueado", "BLOQUEO", 190],
            ["razon", "MOTIVO", 180],
          ]).map((col) => ({
            ...col,
            width: `${parseFloat(String(col.width)) * 0.94}%`,
            ...(["_old", "_new"].includes(col.id)
              ? {
                  cell: (row: Row) => {
                    const value = record(row[col.id]);
                    return `${text(value.cantidad)} pzas · ${text(value.linea)} · G${text(value.grupo)} / ${text(value.secuencia)}`;
                  },
                }
              : {}),
          })),
        ]
      : makeColumns(
          tab === "new"
            ? [
                ["part_no", "PARTE", 150],
                ["linea", "LÍNEA", 90],
                ["cantidad", "CANTIDAD", 90],
                ["grupo", "GRUPO", 80],
              ]
            : [
                ["lot_no", "LOTE", 160],
                ["part_no", "PARTE", 150],
                ["linea", "LÍNEA", 90],
                ["cantidad", "CANTIDAD", 90],
                ["status", "ESTADO", 120],
              ],
        );
  return (
    <>
      <p className="process-production-compact">
        Propuesta {text(diff.proposal_id)} · versión {text(diff.version)} ·{" "}
        {text(diff.sin_cambio)} lotes sin cambio.
      </p>
      <TabBar
        id="process-production-diff"
        label="Comparación de propuesta"
        items={[
          { id: "changes", label: "Cambios" },
          { id: "new", label: "Lotes nuevos" },
          { id: "other", label: "Fuera de propuesta" },
        ]}
        activeId={tab}
        onChange={setTab}
      />
      <DataGrid
        key={tab}
        label="Cambios de propuesta ASSY"
        rows={diffRows}
        columns={diffColumns}
        rowKey={(_, index) => index}
        minWidth={tab === "changes" ? 1200 : 700}
        layout="fixed"
      />
    </>
  );
}
