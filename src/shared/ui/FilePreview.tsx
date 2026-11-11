import { useEffect, useRef, useState } from "react";
import { loadScript } from "../lib/loadScript";
import { Alert, Loading } from "./Feedback";
import "./preview.css";
declare global {
  interface Window {
    pptxPreview?: {
      init(
        element: HTMLElement,
        options: { width: number; height: number; mode: string },
      ): { preview(buffer: ArrayBuffer): Promise<void> };
    };
  }
}
/** The caller supplies authenticated binary data. HTML gets an opaque, scriptless frame. */
export function FilePreview({ blob, name }: { blob: Blob; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(true);
  const extension = name.split(".").pop()?.toLowerCase();
  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    const element = host.current;
    setError(null);
    setBusy(true);
    async function show() {
      try {
        if (extension === "pptx") {
          await loadScript("/vendor/pptx-preview.umd.js");
          const buffer = await blob.arrayBuffer();
          if (!alive || !element) return;
          if (!window.pptxPreview)
            throw new Error("El visor de presentaciones no está disponible.");
          await window.pptxPreview
            .init(element, {
              width: Math.max(260, element.clientWidth - 12),
              height: 500,
              mode: "list",
            })
            .preview(buffer);
        } else if (extension !== "ppt") {
          objectUrl = URL.createObjectURL(blob);
          if (alive) setUrl(objectUrl);
        }
      } catch (failure) {
        if (alive)
          setError(
            failure instanceof Error
              ? failure
              : new Error("No se pudo abrir el documento."),
          );
      } finally {
        if (alive) setBusy(false);
      }
    }
    void show();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      element?.replaceChildren();
    };
  }, [blob, extension]);
  return (
    <div className="document-preview">
      {busy && <Loading text="Abriendo documento…" />}
      {error && <Alert tone="danger">{error.message}</Alert>}
      {extension === "ppt" && (
        <Alert tone="info">
          El formato PPT antiguo se abre en PowerPoint. Descárgalo o conviértelo
          a PPTX para verlo aquí.
        </Alert>
      )}
      {extension === "pptx" ? (
        <div ref={host} className="document-preview-slides" />
      ) : (
        url && (
          <iframe
            className="document-preview-frame"
            src={url}
            title={name}
            {...(extension === "pdf" ? {} : { sandbox: "" })}
          />
        )
      )}
    </div>
  );
}
