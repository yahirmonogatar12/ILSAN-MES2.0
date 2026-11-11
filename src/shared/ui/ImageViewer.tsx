import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Alert, Loading } from "./Feedback";
import "./image-viewer.css";

export interface ImageViewerProps {
  blob: Blob;
  alt: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}
const initial = { scale: 1, x: 0, y: 0 };
function zoom(view: typeof initial, next: number) {
  const scale = Math.min(6, Math.max(1, Math.round(next * 10) / 10));
  return scale === 1 ? { ...initial } : { ...view, scale };
}
/** Fits an authenticated image blob, then zooms and pans locally. Owns its object URL. */
export function ImageViewer({ blob, alt, onLoad, onError }: ImageViewerProps) {
  const stage = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const [resource, setResource] = useState<{ blob: Blob; url: string } | null>(
    null,
  );
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const [view, setView] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const url = resource?.blob === blob ? resource.url : "";
  const ready = !!url && loaded === url && failed !== url;
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setResource({ blob, url: objectUrl });
    setLoaded("");
    setFailed("");
    setView({ ...initial });
    setDragging(false);
    drag.current = null;
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!img.current?.complete || !img.current.naturalWidth) return;
      event.preventDefault();
      setView((previous) =>
        zoom(previous, previous.scale + (event.deltaY < 0 ? 0.2 : -0.2)),
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  function reset() {
    drag.current = null;
    setDragging(false);
    setView({ ...initial });
  }
  function stopDrag() {
    drag.current = null;
    setDragging(false);
  }
  return (
    <div className="ui-image-viewer">
      <div
        className="ui-image-viewer-controls"
        role="group"
        aria-label="Controles de zoom"
      >
        <output aria-label="Nivel de zoom" aria-live="polite">
          {Math.round(view.scale * 100)}%
        </output>
        <Button
          size="sm"
          aria-label="Reducir zoom"
          disabled={!ready || view.scale <= 1}
          onClick={() =>
            setView((previous) => zoom(previous, previous.scale - 0.2))
          }
        >
          −
        </Button>
        <Button
          size="sm"
          aria-label="Restablecer imagen"
          disabled={!ready}
          onClick={reset}
        >
          Reset
        </Button>
        <Button
          size="sm"
          aria-label="Aumentar zoom"
          disabled={!ready || view.scale >= 6}
          onClick={() =>
            setView((previous) => zoom(previous, previous.scale + 0.2))
          }
        >
          +
        </Button>
      </div>
      <div
        ref={stage}
        className={
          "ui-image-viewer-stage" +
          (view.scale > 1 ? " is-zoomed" : "") +
          (dragging ? " is-dragging" : "")
        }
        role="region"
        aria-label="Imagen ampliable"
        tabIndex={0}
        style={{ touchAction: view.scale > 1 ? "none" : "pan-y" }}
        onKeyDown={(event) => {
          if (!ready) return;
          if (event.key === "Home") {
            event.preventDefault();
            reset();
          } else if (
            view.scale > 1 &&
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            setView((previous) => ({
              ...previous,
              x:
                previous.x +
                (event.key === "ArrowLeft"
                  ? 40
                  : event.key === "ArrowRight"
                    ? -40
                    : 0),
              y:
                previous.y +
                (event.key === "ArrowUp"
                  ? 40
                  : event.key === "ArrowDown"
                    ? -40
                    : 0),
            }));
          }
        }}
        onPointerDown={(event) => {
          if (!ready || view.scale <= 1 || event.button !== 0) return;
          event.preventDefault();
          drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            x: view.x,
            y: view.y,
          };
          setDragging(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active || active.pointerId !== event.pointerId) return;
          setView((previous) => ({
            ...previous,
            x: active.x + event.clientX - active.startX,
            y: active.y + event.clientY - active.startY,
          }));
        }}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={stopDrag}
      >
        {url && (
          <img
            ref={img}
            src={url}
            alt={alt}
            draggable={false}
            style={{
              visibility: ready ? "visible" : "hidden",
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
            onLoad={() => {
              setLoaded(url);
              setFailed("");
              reset();
              onLoad?.();
            }}
            onError={() => {
              setFailed(url);
              onError?.(new Error("No se pudo mostrar la imagen recibida."));
            }}
          />
        )}
        {!ready && (
          <div className="ui-image-viewer-placeholder">
            {failed === url && url ? (
              <Alert tone="danger">
                No se pudo mostrar la imagen recibida.
              </Alert>
            ) : (
              <Loading text="Abriendo imagen…" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
