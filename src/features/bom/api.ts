import {
  backendFetch,
  downloadFile,
  ensureResponse,
  request,
} from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import type {
  BomApi,
  BomItem,
  EcoDetail,
  Revision,
  Diff,
  Family,
  EcoList,
  FileRecord,
  EcoRow,
} from "./types";
const params = (value: object) =>
  new URLSearchParams(
    Object.entries(value)
      .filter(
        ([, value]) => value !== "" && value !== null && value !== undefined,
      )
      .map(([key, value]) => [key, String(value)]),
  );
export function createBomApi(mode: RuntimeMode): BomApi {
  const demo = () => import("./demo").then((module) => module.demoApi);
  async function data<T>(path: string, signal?: AbortSignal): Promise<T> {
    return (await request<{ data: T }>(path, { signal })).data;
  }
  return {
    async models(signal) {
      if (mode === "demo") return (await demo()).models(signal);
      const rows = await request<Array<string | { modelo: string }>>(
        "/listar_modelos_bom",
        { signal },
      );
      if (!Array.isArray(rows))
        throw new Error("No se recibió el catálogo de modelos BOM.");
      return rows
        .map((row) => (typeof row === "string" ? row : row.modelo))
        .filter(Boolean);
    },
    async revisions(model, signal) {
      if (mode === "demo") return (await demo()).revisions(model, signal);
      return data<Revision[]>(
        `/api/bom/revisions?${params({ modelo: model })}`,
        signal,
      );
    },
    async list(filters, signal) {
      if (mode === "demo") return (await demo()).list(filters, signal);
      const rows = await request<BomItem[]>("/listar_bom", {
        method: "POST",
        body: JSON.stringify({
          ...filters,
          bom_revision: filters.bom_revision || null,
        }),
        signal,
      });
      if (!Array.isArray(rows))
        throw new Error("El servidor no devolvió componentes BOM válidos.");
      return rows;
    },
    async export(filters) {
      if (mode === "demo") return (await demo()).export(filters);
      await downloadFile(`/exportar_excel_bom?${params(filters)}`, "bom.xlsx");
    },
    async history(filters, page, pageSize, signal) {
      if (mode === "demo")
        return (await demo()).history(filters, page, pageSize, signal);
      return request<EcoList>(
        `/api/ecos?${params({ ...filters, page, page_size: pageSize })}`,
        { signal },
      );
    },
    async exportHistory(filters) {
      if (mode === "demo") return (await demo()).exportHistory(filters);
      await downloadFile(
        `/api/ecos/export?${params(filters)}`,
        "historial_ecos.xlsx",
      );
    },
    async detail(row, signal) {
      if (mode === "demo") return (await demo()).detail(row, signal);
      return data<EcoDetail>(
        row.origen?.toUpperCase() === "KS"
          ? `/api/ecn-ks/${encodeURIComponent(String(row.id).replace(/^ks-/, ""))}`
          : `/api/ecos/${Number(row.id)}`,
        signal,
      );
    },
    async diff(id, signal) {
      if (mode === "demo") return (await demo()).diff(id, signal);
      return data<Diff>(`/api/ecos/${id}/diff`, signal);
    },
    async family(family, suffixes) {
      if (mode === "demo") return (await demo()).family(family, suffixes);
      return data<Family>(
        `/api/bom/resolve-family?${params({ family, suffixes })}`,
      );
    },
    async nextRevision(parts, signal) {
      if (mode === "demo") return (await demo()).nextRevision(parts, signal);
      return (
        await data<{ bom_revision: string }>(
          `/api/bom/next-eco-revision?${params({ scope_parts: parts.join(",") })}`,
          signal,
        )
      ).bom_revision;
    },
    async template(draft) {
      if (mode === "demo") return (await demo()).template(draft);
      if (draft.kind === "FAMILY")
        await downloadFile(
          `/api/bom/download-excel-family?${params({ family: draft.family, suffixes: draft.suffixes })}`,
          "bom_familia.xlsx",
        );
      else
        await downloadFile(
          `/api/bom/download-excel?${params({ part_no: draft.part_no, ...(draft.kind === "NEW_BOM" ? { mode: "new_bom" } : {}) })}`,
          "bom_editable.xlsx",
        );
    },
    async importEco(draft, parts, file) {
      if (mode === "demo") return (await demo()).importEco(draft, parts, file);
      const body = new FormData();
      body.append("file", file);
      ["eco_no", "effective_at", "item_name", "notes"].forEach((key) =>
        body.append(
          key,
          draft[key as "eco_no" | "effective_at" | "item_name" | "notes"],
        ),
      );
      if (draft.kind === "FAMILY") {
        body.append("family_prefix", draft.family);
        body.append("scope_parts", parts.join(","));
      } else {
        body.append("part_no", draft.part_no);
        if (draft.kind === "NEW_BOM") body.append("bom_mode", "NEW_BOM");
      }
      return request(
        `/api/ecos/${draft.kind === "FAMILY" ? "from-excel-family" : "from-excel"}`,
        { method: "POST", body },
      );
    },
    async importItems(id, file) {
      if (mode === "demo") return (await demo()).importItems(id, file);
      const body = new FormData();
      body.append("file", file);
      await request(`/api/ecos/${id}/items/import`, { method: "POST", body });
    },
    async action(id, action) {
      if (mode === "demo") return (await demo()).action(id, action);
      await request(
        `/api/ecos/${id}${action === "delete" ? "" : `/${action}`}`,
        { method: action === "delete" ? "DELETE" : "POST" },
      );
    },
    async files(id, signal) {
      if (mode === "demo") return (await demo()).files(id, signal);
      return data<FileRecord[]>(`/api/ecos/${id}/files`, signal);
    },
    async paperwork(part, signal) {
      if (mode === "demo") return (await demo()).paperwork(part, signal);
      return request<{ eco: EcoRow | null; files: FileRecord[] }>(
        `/api/bom/papeleria?${params({ part_no: part })}`,
        { signal },
      );
    },
    async upload(id, file) {
      if (mode === "demo") return (await demo()).upload(id, file);
      const body = new FormData();
      body.append("file", file);
      await request(`/api/ecos/${id}/files`, { method: "POST", body });
    },
    async removeFile(id, fileId) {
      if (mode === "demo") return (await demo()).removeFile(id, fileId);
      await request(`/api/ecos/${id}/files/${fileId}`, { method: "DELETE" });
    },
    async fileBlob(id, file, signal) {
      if (mode === "demo") return (await demo()).fileBlob(id, file, signal);
      const response = await backendFetch(`/api/ecos/${id}/files/${file.id}`, {
        signal,
      });
      await ensureResponse(response);
      return response.blob();
    },
    async download(id, file) {
      if (mode === "demo") return (await demo()).download(id, file);
      await downloadFile(
        `/api/ecos/${id}/files/${file.id}?download=1`,
        file.nombre_original,
        file.extension === ".html" || file.extension === ".htm",
      );
    },
  };
}
