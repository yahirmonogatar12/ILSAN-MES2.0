import { request } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import { cleanDraft, LIMIT, smtPayload } from "./model";
import type { CatalogApi, CatalogData, CatalogKind } from "./types";
export function createCatalogApi(
  kind: CatalogKind,
  mode: RuntimeMode,
): CatalogApi {
  return {
    async list(search, signal) {
      if (mode === "demo") return (await import("./demo")).list(kind, search);
      const path =
        kind === "smt"
          ? "/control-modelos/api/data"
          : `/api/mysql/data?${new URLSearchParams({ table: "raw", limit: String(LIMIT), offset: "0", search })}`;
      const data = await request<CatalogData>(path, { signal });
      if (
        !Array.isArray(data.columns) ||
        !data.columns.every((column) => typeof column === "string") ||
        !Array.isArray(data.rows)
      )
        throw new Error("El servidor no devolvió un catálogo válido.");
      return data;
    },
    async save(values, original, columns, actor) {
      if (mode === "demo")
        return (await import("./demo")).save(kind, values, original, columns);
      if (kind === "smt") {
        await request(
          `/control-modelos/api/rows${original ? `/${encodeURIComponent(String(original.__rowhash))}` : ""}`,
          {
            method: original ? "PUT" : "POST",
            body: JSON.stringify(smtPayload(values, original, columns, actor)),
          },
        );
      } else {
        const data = cleanDraft(values, columns, kind);
        await request(`/api/mysql/${original ? "update" : "create"}`, {
          method: "POST",
          body: JSON.stringify(
            original
              ? { original, new: data }
              : { data: { ...data, Usuario: actor } },
          ),
        });
      }
    },
    async remove(original) {
      if (mode === "demo")
        return (await import("./demo")).remove(kind, original);
      if (kind === "smt") {
        const { __rowhash, ...record } = original;
        await request(
          `/control-modelos/api/rows/${encodeURIComponent(String(__rowhash))}`,
          { method: "DELETE", body: JSON.stringify({ original: record }) },
        );
      } else {
        const id = original.id ?? original.ID;
        if (!id) throw new Error("El registro no tiene ID para eliminarlo.");
        await request("/api/mysql/delete", {
          method: "POST",
          body: JSON.stringify({ table: "raw", id }),
        });
      }
    },
    async familyLines(familia, lineas) {
      if (mode === "demo")
        return (await import("./demo")).familyLines(familia, lineas);
      return request("/api/mysql/familia-lineas", {
        method: "POST",
        body: JSON.stringify({ familia, lineas }),
      });
    },
  };
}
