import { pieceNotice } from "./model";
import type { Piece } from "./types";

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
