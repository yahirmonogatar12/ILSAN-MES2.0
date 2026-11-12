import { SESSION_EXPIRED_EVENT } from "./runtime";
import { readServerEvents, type ServerEvent } from "@/shared/lib/serverEvents";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function backendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let response: Response;
  const multipart =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: "application/json",
    // Existing permission decorators also inspect Content-Type for GET requests.
    ...(!multipart ? { "Content-Type": "application/json" } : {}),
    "X-Requested-With": "XMLHttpRequest",
  };
  const suppliedHeaders =
    init.headers instanceof Headers
      ? init.headers.entries()
      : Array.isArray(init.headers)
        ? init.headers
        : Object.entries(init.headers ?? {});
  for (const [name, value] of suppliedHeaders) {
    const existing = Object.keys(headers).find(
      (key) => key.toLowerCase() === name.toLowerCase(),
    );
    headers[existing || name] = value;
  }
  try {
    response = await fetch(`/backend${path}`, {
      credentials: "same-origin",
      ...init,
      headers,
    });
  } catch (error) {
    // Abort errors can originate in another browser realm (iframe/DOMException).
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    )
      throw error;
    throw new ApiError(
      "No se pudo conectar con el servidor MES. Comprueba la conexión e inténtalo de nuevo.",
      0,
    );
  }
  if (
    response.status === 401 &&
    path !== "/login" &&
    !(
      path === "/api/mi-perfil" &&
      (init.method || "GET").toUpperCase() === "GET"
    )
  ) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return response;
}

export async function ensureResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const fallback =
    response.status === 403
      ? "Tu usuario no tiene permiso para acceder a este módulo."
      : response.status === 401
        ? "Tu sesión terminó. Inicia sesión para continuar."
        : response.status >= 500
          ? "El servidor MES no está disponible o no pudo completar la operación."
          : `No se pudo completar la operación (${response.status}).`;
  const payload = await response.json().catch(() => ({}));
  throw new ApiError(
    payload.error ||
      payload.message ||
      (Array.isArray(payload.errors) ? payload.errors.join("\n") : "") ||
      fallback,
    response.status,
  );
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await backendFetch(path, init);
  await ensureResponse(response);
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(
      "El servidor devolvió una página en lugar de datos. Comprueba la sesión y la dirección del servidor.",
      502,
    );
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("El servidor devolvió datos JSON inválidos.", 502);
  }
  if (payload.success === false || payload.ok === false)
    throw new ApiError(
      payload.error ||
        payload.message ||
        (Array.isArray(payload.errors) ? payload.errors.join("\n") : "") ||
        "No se pudo completar la operación.",
      response.status,
    );
  return payload as T;
}

export function saveDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Authenticated SSE reads share the same cookies, expiry and HTTP error handling. */
export async function requestEventStream(
  path: string,
  init: RequestInit,
  receive: (event: ServerEvent) => void,
): Promise<void> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "text/event-stream");
  const response = await backendFetch(path, {
    ...init,
    headers,
  });
  await ensureResponse(response);
  if (
    !response.headers.get("content-type")?.includes("text/event-stream") ||
    !response.body
  )
    throw new ApiError(
      "El servidor no devolvió una respuesta de chat válida.",
      502,
    );
  await readServerEvents(response.body, receive, init.signal ?? undefined);
}

/** Authenticated binary downloads without navigating away from the workspace. */
export async function downloadFile(
  path: string,
  fallback: string,
  allowHtml = false,
) {
  const file = await requestFile(path, fallback, undefined, allowHtml);
  saveDownload(file.blob, file.name);
}

/** Read an authenticated attachment for a shared viewer or download. */
export async function requestFile(
  path: string,
  fallback: string,
  signal?: AbortSignal,
  allowHtml = false,
  init?: RequestInit,
) {
  const response = await backendFetch(path, {
    ...init,
    signal: signal ?? init?.signal,
  });
  await ensureResponse(response);
  const type = response.headers.get("content-type") || "";
  if (type.includes("json")) {
    const value = await response.json();
    throw new ApiError(value.error || "No se recibió un archivo.", 502);
  }
  if (!allowHtml && type.includes("text/html"))
    throw new ApiError(
      "El servidor devolvió una página en lugar del archivo.",
      502,
    );
  const header = response.headers.get("content-disposition") || "";
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  let filename = header.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
  if (encoded) {
    try {
      filename = decodeURIComponent(encoded);
    } catch {
      /* retain fallback */
    }
  }
  return { blob: await response.blob(), name: filename.replace(/[\\/]/g, "_") };
}
