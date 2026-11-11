import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PanelsTopLeft } from "lucide-react";
import {
  Alert,
  Button,
  DialogBody,
  ErrorState,
  ImageViewer,
  Loading,
  Modal,
} from "@/shared/ui";
import { col, view } from "./views";
import { rows, text } from "./model";
import { useResults } from "./useResults";
import { TableDialog } from "./MachineDialogs";
import type { Row } from "./types";
import "./vision-preview.css";

export function VisionDetail({
  record,
  onClose,
}: {
  record: Row;
  onClose: () => void;
}) {
  const context = useResults();
  const [parametersOpen, setParametersOpen] = useState(false);
  const [decoded, setDecoded] = useState<{ blob: Blob; error: string } | null>(
    null,
  );
  const info = useQuery({
    queryKey: context.key("vision-info", record.id),
    queryFn: ({ signal }) => context.api.visionInfo(text(record.id), signal),
  });
  const image = useQuery({
    queryKey: context.key("vision-image", record.id),
    queryFn: ({ signal }) => context.api.visionImage(text(record.id), signal),
    enabled: !!info.data?.image_url,
    retry: false,
    gcTime: 0,
  });
  const parameters = useMemo(
    () =>
      view(
        "machine-vision-parameters",
        "Parámetros de Visión",
        "/api/vision/parameters",
        [
          col("prueba", "Prueba", 170),
          col("posicion", "Posición", 100),
          col("resultado", "Resultado", 90),
          col("ejecutada", "Ejecutada", 85),
          col("limite_inferior", "Límite inferior", 105),
          col("limite_superior", "Límite superior", 105),
          col("lectura", "Lectura", 160),
          col("detalle", "Detalle", 240),
        ],
        [],
        {
          params: { id: text(record.id) },
          responseKey: "pruebas",
          minWidth: 1050,
          mapRows: (items) =>
            items.flatMap((item) => {
              const positions = rows(item.posiciones ?? []);
              return (positions.length ? positions : [{}]).map((position) => ({
                ...item,
                ...position,
                ejecutada: item.ejecutada ? "Sí" : "Sin ejecutar",
              }));
            }),
        },
      ),
    [record.id],
  );
  function value(key: string, fallback: unknown = record[key]) {
    return text(info.data?.[key]) || text(fallback) || "—";
  }
  const line = value("linea");
  const part = value("numero_parte", record.numero_parte ?? record.no_parte);
  const result = value("resultado");
  const date = value(
    "fecha_hora",
    [record.fecha, record.hora].map(text).filter(Boolean).join(" "),
  );
  const fields = [
    ["Línea", line],
    ["Resultado", result],
    ["Número de parte", part],
    ["Fecha y hora", date],
    ["QR", value("qr")],
    ["Barcode", value("barcode")],
  ];
  const defects = rows(info.data?.defects ?? record.fallas ?? []);
  const decodedCurrent = !!image.data && decoded?.blob === image.data.blob;
  const decodedError = decodedCurrent ? decoded.error : "";
  const ready = decodedCurrent && !decodedError;
  const busy = info.isFetching || image.isFetching;
  const failure =
    info.error?.message ||
    image.error?.message ||
    decodedError ||
    text(info.data?.error);
  let status = text(info.data?.message) || "Esperando la imagen del registro.";
  if (busy)
    status = info.isFetching
      ? "Buscando imagen en carpetas compartidas…"
      : "Cargando imagen…";
  else if (failure) status = failure;
  else if (ready)
    status = info.data?.match_type
      ? "Imagen cargada con coincidencia " + text(info.data.match_type) + "."
      : "Imagen cargada correctamente.";
  else if (image.data) status = "Abriendo imagen…";
  const tone = busy ? "info" : failure ? "danger" : ready ? "success" : "info";
  async function retry() {
    const hadImage = !!info.data?.image_url;
    const response = await info.refetch();
    if (hadImage && response.data?.image_url) await image.refetch();
  }
  return (
    <Modal
      title="Preview de imagen Vision"
      icon={<PanelsTopLeft size={18} />}
      subtitle={[line, part, result].join(" | ")}
      size="xl"
      onClose={onClose}
      className="production-results-vision"
    >
      <DialogBody>
        <div className="production-results-vision-layout">
          <div className="production-results-vision-canvas">
            {image.data ? (
              <ImageViewer
                blob={image.data.blob}
                alt="Imagen de visión"
                onLoad={() => setDecoded({ blob: image.data!.blob, error: "" })}
                onError={(error) =>
                  setDecoded({ blob: image.data!.blob, error: error.message })
                }
              />
            ) : (
              <div className="production-results-vision-empty">
                {busy || info.isPending ? (
                  <Loading text="Buscando imagen en carpetas compartidas…" />
                ) : failure ? (
                  <ErrorState
                    title="Imagen no disponible"
                    error={new Error(failure)}
                    onRetry={() => void retry()}
                  />
                ) : (
                  <p>{status}</p>
                )}
              </div>
            )}
          </div>
          <aside
            className="production-results-vision-side"
            aria-label="Información de la imagen"
          >
            <dl className="production-results-vision-meta">
              {fields.map(([label, content]) => (
                <div
                  key={label}
                  className="production-results-vision-meta-card"
                >
                  <dt>{label}</dt>
                  <dd>{content}</dd>
                </div>
              ))}
            </dl>
            {result.toUpperCase() === "NG" && defects.length > 0 && (
              <section
                className="production-results-vision-section"
                aria-label="Fallas de la imagen"
              >
                <h3>Falla (NG)</h3>
                <ul className="production-results-vision-defects">
                  {defects.map((defect, index) => (
                    <li key={index}>
                      <strong>
                        {[defect.tipo, defect.componente]
                          .map(text)
                          .filter(Boolean)
                          .join(" · ")}
                      </strong>
                      <span>
                        {[defect.tipo_falla, defect.valor, defect.unidad]
                          .map(text)
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                      {text(defect.detalle) && (
                        <small>{text(defect.detalle)}</small>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {info.data?.parametros_disponibles === true && (
              <Button
                className="production-results-vision-params"
                onClick={() => setParametersOpen(true)}
              >
                Ver parámetros
              </Button>
            )}
            <section
              className="production-results-vision-section"
              aria-label="Estado de la imagen"
            >
              <h3>Estado</h3>
              <Alert tone={tone}>{status}</Alert>
              {(failure || (info.isSuccess && !info.data.image_url)) && (
                <Button size="sm" loading={busy} onClick={() => void retry()}>
                  Reintentar imagen
                </Button>
              )}
            </section>
            <section
              className="production-results-vision-section"
              aria-label="Ruta encontrada"
            >
              <h3>Ruta encontrada</h3>
              <code>{text(info.data?.resolved_path) || "—"}</code>
            </section>
          </aside>
        </div>
      </DialogBody>
      {parametersOpen && (
        <TableDialog
          spec={parameters}
          subtitle={[line, part, result].join(" | ")}
          onClose={() => setParametersOpen(false)}
        />
      )}
    </Modal>
  );
}
