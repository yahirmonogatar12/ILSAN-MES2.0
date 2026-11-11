const pending = new Map<string, Promise<void>>();
/** Deduplicate optional local renderer loads; retry is possible after failure. */
export function loadScript(src: string): Promise<void> {
  if (pending.has(src)) return pending.get(src)!;
  const promise = new Promise<void>((resolve, reject) => {
    const element = document.createElement("script");
    element.src = src;
    element.onload = () => resolve();
    element.onerror = () => {
      pending.delete(src);
      element.remove();
      reject(new Error("No se pudo cargar el visor de documentos."));
    };
    document.head.appendChild(element);
  });
  pending.set(src, promise);
  return promise;
}
