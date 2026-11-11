import { downloadFile, request } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import type { Filters, FpaApi, FpaDetail, FpaRequest } from "./types";
export function filterParams(filters: Filters) {
  return new URLSearchParams(
    Object.entries(filters)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => !!value),
  );
}
// MICOM caps each HTTP page at 200; the UI can request a larger logical page.
const SERVER_PAGE_SIZE = 200;
async function readPage(
  filters: Filters,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
) {
  const params = filterParams(filters);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const result = await request<{ data: FpaRequest[]; meta: { total: number } }>(
    `/api/control-fpa/requests?${params}`,
    { signal },
  );
  if (
    !Array.isArray(result.data) ||
    !Number.isFinite(Number(result.meta?.total))
  )
    throw new Error("El historial FPA no tiene un formato válido.");
  return result;
}
export function createFpaApi(mode: RuntimeMode): FpaApi {
  return {
    async list(filters, page, pageSize, signal) {
      if (mode === "demo")
        return (await import("./demo")).list(filters, page, pageSize);
      if (pageSize <= SERVER_PAGE_SIZE)
        return readPage(filters, page, pageSize, signal);
      const start = (page - 1) * pageSize;
      const firstPage = Math.floor(start / SERVER_PAGE_SIZE) + 1;
      const first = await readPage(
        filters,
        firstPage,
        SERVER_PAGE_SIZE,
        signal,
      );
      const end = Math.min(start + pageSize, Number(first.meta.total));
      const lastPage = Math.ceil(end / SERVER_PAGE_SIZE);
      const remaining = await Promise.all(
        Array.from({ length: Math.max(0, lastPage - firstPage) }, (_, index) =>
          readPage(filters, firstPage + index + 1, SERVER_PAGE_SIZE, signal),
        ),
      );
      const offset = start - (firstPage - 1) * SERVER_PAGE_SIZE;
      return {
        data: [first, ...remaining]
          .flatMap((result) => result.data)
          .slice(offset, offset + pageSize),
        meta: { ...first.meta, page, pageSize },
      };
    },
    async detail(id, signal) {
      if (mode === "demo") return (await import("./demo")).detail(id);
      return (
        await request<{ data: FpaDetail }>(`/api/control-fpa/requests/${id}`, {
          signal,
        })
      ).data;
    },
    async create(payload, key) {
      if (mode === "demo") return (await import("./demo")).create(payload, key);
      return (
        await request<{ data: FpaRequest }>("/api/control-fpa/requests", {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(payload),
        })
      ).data;
    },
    async adjust(id, payload) {
      if (mode === "demo") return (await import("./demo")).adjust(id, payload);
      return (
        await request<{ data: FpaRequest }>(
          `/api/control-fpa/requests/${id}/quantities`,
          { method: "PATCH", body: JSON.stringify(payload) },
        )
      ).data;
    },
    async export(filters) {
      if (mode === "demo") return (await import("./demo")).exportFile(filters);
      await downloadFile(
        `/api/control-fpa/export?${filterParams(filters)}`,
        "historial_fpa.xlsx",
      );
    },
  };
}
