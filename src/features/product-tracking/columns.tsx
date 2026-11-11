import type { TableColumn } from "@/shared/ui";
import { numeric, pieceNotice, text } from "./model";
import type { Piece, PieceStage, Stage, TraceRow, TraceView } from "./types";

const tones = new Set([
  "hecho",
  "pendiente",
  "na",
  "nd",
  "rep",
  "embarques",
  "salio",
  "scrap",
  "assy",
  "imd",
  "smt",
  "active",
  "completed",
  "ok",
  "ng",
]);
export function StatusBadge({ value, tone }: { value: string; tone: string }) {
  const normalized = tone.toLowerCase();
  return (
    <span
      className={
        "product-tracking-badge product-tracking-" +
        (tones.has(normalized) ? normalized : "pendiente")
      }
    >
      {value || "—"}
    </span>
  );
}
export function PieceSummary({ piece }: { piece: Piece }) {
  const notice = pieceNotice(piece);
  return (
    <div className="product-tracking-piece">
      <dl className="product-tracking-facts">
        <div>
          <dt>QR</dt>
          <dd>
            {piece.sin_qr ? (
              <StatusBadge value="NO VINCULADO" tone="nd" />
            ) : (
              piece.qr || "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Barcode</dt>
          <dd>
            {piece.sin_barcode ? (
              <StatusBadge value="NO VINCULADO" tone="nd" />
            ) : (
              piece.barcode || "—"
            )}
          </dd>
        </div>
        {piece.barcode_anterior && (
          <div>
            <dt>Barcode anterior</dt>
            <dd>{piece.barcode_anterior}</dd>
          </div>
        )}
        <div>
          <dt>Etapas registradas</dt>
          <dd>
            {piece.registradas} / {piece.total}
          </dd>
        </div>
        <div>
          <dt>Última etapa</dt>
          <dd>
            {[piece.ultima_etapa, piece.ultima_fecha]
              .filter(Boolean)
              .join(" · ") || "—"}
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <StatusBadge
              value={piece.estado_global}
              tone={piece.clase_global}
            />
          </dd>
        </div>
      </dl>
      {notice && <p className="product-tracking-notice">{notice}</p>}
    </div>
  );
}
export const stageColumns: TableColumn<PieceStage>[] = [
  {
    id: "sequence",
    header: "#",
    width: "5%",
    sortValue: (row) => row.sequence,
    textValue: (row) => String(row.sequence),
    cell: (row) => row.sequence,
  },
  {
    id: "etapa",
    header: "Etapa",
    width: "23%",
    sortValue: (row) => row.etapa,
    textValue: (row) => row.etapa,
    cell: (row) => row.etapa,
  },
  {
    id: "estado",
    header: "Estado",
    width: "30%",
    sortValue: (row) => row.estado,
    textValue: (row) => row.estado,
    cell: (row) => <StatusBadge value={row.estado} tone={row.clase} />,
  },
  {
    id: "fecha",
    header: "Fecha / hora",
    width: "42%",
    sortValue: (row) => row.fecha,
    textValue: (row) => row.fecha,
    cell: (row) => row.fecha || "—",
  },
];
export interface BatchRow {
  piece: Piece;
  sequence: number;
  stages: Record<string, Stage>;
}
export function batchColumns(
  names: readonly string[],
): TableColumn<BatchRow>[] {
  const columns: TableColumn<BatchRow>[] = [
    {
      id: "sequence",
      header: "#",
      width: 50,
      sortValue: (row) => row.sequence,
      textValue: (row) => String(row.sequence),
      cell: (row) => row.sequence,
    },
    ...(["codigo", "qr", "barcode"] as const).map((key) => ({
      id: key,
      header: { codigo: "Código buscado", qr: "QR", barcode: "Barcode" }[key],
      width: 240,
      sortValue: (row: BatchRow) => row.piece[key],
      textValue: (row: BatchRow) => row.piece[key],
      cell: (row: BatchRow) => (
        <span className="product-tracking-cell" title={row.piece[key]}>
          {row.piece[key] || "—"}
        </span>
      ),
    })),
    {
      id: "estado",
      header: "Estado de la pieza",
      width: 180,
      sortValue: (row) => row.piece.estado_global,
      textValue: (row) => row.piece.estado_global,
      cell: (row) => (
        <StatusBadge
          value={row.piece.estado_global}
          tone={row.piece.clase_global}
        />
      ),
    },
    ...names.map((name, index) => ({
      id: "stage-" + index,
      header: name,
      width: 150,
      sortValue: (row: BatchRow) => row.stages[name]?.celda,
      textValue: (row: BatchRow) => row.stages[name]?.celda || "",
      cell: (row: BatchRow) => (
        <span
          className={
            "product-tracking-stage-cell product-tracking-" +
            (row.stages[name]?.clase || "pendiente")
          }
        >
          {row.stages[name]?.celda || "—"}
        </span>
      ),
    })),
  ];
  const width = columns.reduce((sum, column) => sum + Number(column.width), 0);
  return columns.map((column) => ({
    ...column,
    width: (100 * Number(column.width)) / width + "%",
  }));
}
function column(
  key: string,
  header: string,
  width: number,
  numericColumn = false,
): TableColumn<TraceRow> {
  return {
    id: key,
    header,
    width,
    sortValue: (row) =>
      numericColumn && row[key] != null && row[key] !== ""
        ? numeric(row[key])
        : text(row[key]),
    textValue: (row) =>
      key === "refill_number" && row[key] != null && row[key] !== ""
        ? "#" + text(row[key])
        : text(row[key]),
    cell: (row) => {
      const value = row[key];
      const display =
        value == null || value === ""
          ? "—"
          : key === "refill_number"
            ? "#" + text(value)
            : numericColumn
              ? numeric(value).toLocaleString("es-MX", {
                  maximumFractionDigits: 6,
                })
              : text(value);
      if (["proceso", "status", "result"].includes(key))
        return <StatusBadge value={display} tone={text(value)} />;
      return (
        <span className="product-tracking-cell" title={display}>
          {display}
        </span>
      );
    },
  };
}
const pcbColumns = [
  column("proceso", "Proceso", 110),
  column("pcb_serial", "PCB (QR / barcode)", 210),
  column("ts", "Fecha", 145),
  column("lot_no", "Lote producción", 140),
  column("linea", "Línea", 65),
  column("part_no", "No. parte (PCB)", 120),
  column("material_code", "Material", 120),
  column("spec", "Spec", 180),
  column("numero_lote_material", "Lote proveedor", 170),
  column("posicion", "Posición", 85),
  column("refill_number", "Refill", 70, true),
  column("cantidad_inicial", "Cant. inicial", 85, true),
  column("cantidad_restante", "Restante", 85, true),
  column("qty_per_pcb", "Qty/PCB", 100, true),
  column("container_id", "Contenedor", 160),
];
const materialColumns = [
  column("proceso", "Proceso", 110),
  column("lot_no", "Lote producción", 140),
  column("linea", "Línea", 65),
  column("part_no", "No. parte (PCB)", 120),
  column("material_code", "Material", 120),
  column("numero_lote_material", "Lote proveedor", 170),
  column("posicion", "Posición", 85),
  column("cantidad_inicial", "Cant. inicial", 85, true),
  column("cantidad_consumida", "Consumido", 85, true),
  column("cantidad_restante", "Restante", 85, true),
  column("pcb_count", "PCBs", 70, true),
  column("status", "Estado", 90),
  column("material_start_ts", "Inicio", 145),
  column("pcb_last_ts", "Último PCB", 145),
];
const supplierColumns = [
  column("proceso", "Proceso", 110),
  column("pcb_serial", "PCB (QR / barcode)", 210),
  column("ts", "Fecha", 145),
  column("lote_proveedor", "Lote proveedor", 170),
  column("material_code", "Material", 120),
  column("lot_no", "Lote producción", 140),
  column("linea", "Línea", 65),
  column("part_no", "No. parte (PCB)", 120),
  column("posicion", "Posición", 85),
];
function proportional(columns: TableColumn<TraceRow>[]) {
  const total = columns.reduce((sum, column) => sum + Number(column.width), 0);
  return columns.map((column) => ({
    ...column,
    width: (100 * Number(column.width)) / total + "%",
  }));
}
export const traceColumns: Record<TraceView, TableColumn<TraceRow>[]> = {
  por_pcb: proportional(pcbColumns),
  materiales: proportional(materialColumns),
  por_proveedor: proportional(supplierColumns),
};
export const historyColumns = proportional([
  column("hora", "Hora", 90),
  column("contenedor", "Contenedor", 170),
  column("material", "Material", 130),
  column("posicion", "Posición", 85),
  column("spec", "Spec", 180),
  column("qty", "Qty", 70, true),
  column("proveedor", "Proveedor", 120),
  column("lote_proveedor", "Lote proveedor", 170),
  column("result", "Resultado", 90),
]);
