import { downloadFile, request, requestFile, saveDownload } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import {
  BASES,
  planParams,
  record,
  reportParams,
  REPORTS,
  rows,
  text,
} from "./model";
import type { Action, Api, Extra, Kind } from "./types";
const EXTRAS: Record<Extra, [string, "GET" | "POST"]> = {
  scan: ["/api/plan/input-main/scan-lots", "GET"],
  "assign-scan": ["/api/plan/input-main/assign-lot", "POST"],
  "create-scan": ["/api/plan/input-main/create-plan", "POST"],
  proposals: ["/api/plan/propuestas-ia", "GET"],
  diff: ["/api/plan/propuesta-ia/diff", "POST"],
  "apply-diff": ["/api/plan/propuesta-ia/aplicar-cambios", "POST"],
  "import-proposal": ["/api/plan/importar-propuesta-ia", "POST"],
  wos: ["/api/work_orders", "GET"],
  "import-wos": ["/api/work_orders/import", "POST"],
};
export function createApi(mode: RuntimeMode): Api {
  const demo = () => import("./demo").then((module) => module.demoApi);
  return {
    async plans(kind, filters, signal) {
      planParams(filters);
      if (mode === "demo") return (await demo()).plans(kind, filters, signal);
      const result = rows(
        await request<unknown>(`${BASES[kind]}?${planParams(filters)}`, {
          signal,
        }),
      );
      if (
        result.some((row) => !text(row.lot_no)) ||
        new Set(result.map((row) => row.lot_no)).size !== result.length
      )
        throw new Error("El servidor devolvió lotes sin identificador único.");
      return result;
    },
    async pending(kind, filters, signal) {
      if (mode === "demo") return (await demo()).pending(kind, filters, signal);
      return rows(
        await request<unknown>(
          `${BASES[kind]}/${kind === "IMT" ? "pending-reschedule" : "pending"}?${planParams(filters)}`,
          { signal },
        ),
      );
    },
    async action(kind, action: Action, payload) {
      if (mode === "demo") return (await demo()).action(kind, action, payload);
      const suffix = {
        create: "",
        update: "/update",
        status: kind === "ASSY" ? "/status" : "/update",
        order: "/save-sequences",
        reschedule: "/reschedule",
      }[action];
      return record(
        await request<unknown>(BASES[kind] + suffix, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
    },
    async revisions(part, signal) {
      if (mode === "demo") return (await demo()).revisions(part, signal);
      const d = record(
        await request<unknown>(
          `/api/plan/bom-revisions?${new URLSearchParams({ part_no: part })}`,
          { signal },
        ),
      );
      return rows(d.data);
    },
    async extra(name, payload, signal) {
      if (mode === "demo") return (await demo()).extra(name, payload, signal);
      const [url, method] = EXTRAS[name];
      const params = new URLSearchParams(
        Object.entries(payload)
          .filter(([, value]) => value != null && text(value) !== "")
          .map(([key, value]) => [key, text(value)]),
      );
      const result = await request<unknown>(
        url + (method === "GET" ? `?${params}` : ""),
        {
          method,
          signal,
          ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
        },
      );
      if (name === "wos" || name === "proposals") rows(result);
      else if (name === "scan") {
        const data = record(result);
        rows(data.scan_lots);
        rows(data.plan_options);
      } else if (name === "diff") {
        const data = record(result);
        rows(data.cambios);
        rows(data.nuevos);
        rows(data.sobran);
      }
      return result;
    },
    async upload(kind: Kind, file: File, workingDate: string) {
      if (kind === "ASSY")
        throw new Error(
          "ASSY importa sus Work Orders desde el selector de WO.",
        );
      if (mode === "demo")
        return (await demo()).upload(kind, file, workingDate);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("working_date", workingDate);
      return record(
        await request<unknown>(`${BASES[kind]}/import-excel`, {
          method: "POST",
          body: fd,
        }),
      );
    },
    async export(kind, data) {
      if (mode === "demo") return (await demo()).export(kind, data);
      const file = await requestFile(
        `${BASES[kind]}/export-excel`,
        `plan_${kind}.xlsx`,
        undefined,
        false,
        { method: "POST", body: JSON.stringify({ plans: data }) },
      );
      saveDownload(file.blob, file.name);
    },
    async report(kind, filters, searches, signal) {
      if (mode === "demo")
        return (await demo()).report(kind, filters, searches, signal);
      const d = record(
        await request<unknown>(
          `${REPORTS[kind]}?${reportParams(kind, filters, searches)}`,
          { signal },
        ),
      );
      return kind === "operations"
        ? {
            rows: rows(d.data).map((row) => ({
              ...row,
              plan: row.plan_count,
              input: row.input_count,
              output: row.output_count,
            })),
            summary: {},
          }
        : { rows: rows(d.rows), summary: record(d.summary) };
    },
    async exportReport(kind, filters, searches) {
      if (mode === "demo")
        return (await demo()).exportReport(kind, filters, searches);
      await downloadFile(
        `${REPORTS[kind]}/export?${reportParams(kind, filters, searches)}`,
        `${kind}.xlsx`,
      );
    },
  };
}
