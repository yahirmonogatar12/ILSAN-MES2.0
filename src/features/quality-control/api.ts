import { downloadFile, request } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import {
  histories,
  historyParams,
  id,
  number,
  object,
  rows,
  stationIssues,
  stationParams,
  text,
} from "./model";
import type {
  HistoryFilters,
  HistoryKind,
  HistoryResult,
  Station,
  StationDraft,
  StationFilters,
} from "./types";
import { lqcParams, oqcParams, ppmParams, ppmReport } from "./reportModel";
import type {
  LqcFilters,
  LqcOverview,
  OqcFilters,
  OqcReport,
  PpmFilters,
  PpmStage,
} from "./reportTypes";

const stationsRoot = "/api/control_calidad/stations_qa";
export function createQualityApi(mode: RuntimeMode) {
  async function read(path: string, init?: RequestInit): Promise<unknown> {
    if (mode === "live") return request<unknown>(path, init);
    const { demoRequest } = await import("./demo");
    init?.signal?.throwIfAborted();
    return demoRequest(path, init);
  }
  async function download(path: string, filename: string) {
    if (mode === "live") return downloadFile(path, filename);
    const { demoDownload } = await import("./demo");
    return demoDownload(path, filename);
  }
  function stationRecord(value: unknown): Station {
    const row = object(value);
    if (
      !Number.isSafeInteger(row.id) ||
      number(row.id) < 1 ||
      typeof row.is_active !== "boolean"
    )
      throw new Error(
        "La estación recibida no tiene un identificador o estado válido.",
      );
    return row as unknown as Station;
  }
  async function write(path: string, method: string, body?: unknown) {
    return object(
      await read(path, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  }
  return {
    async lqcOverview(signal?: AbortSignal): Promise<LqcOverview> {
      const data = object(await read("/api/lqc/lineas", { signal }));
      const uph = object(data.uph_hoy);
      return {
        date: text(data.fecha_consulta),
        updated: text(data.actualizado),
        lines: rows(data.lineas),
        uph: Object.fromEntries(
          Object.entries(uph).map(([line, values]) => [line, object(values)]),
        ),
        slots: rows(data.uph_slots ?? []),
      };
    },
    async lqcRecords(filters: LqcFilters, signal?: AbortSignal) {
      return rows(
        object(await read("/api/lqc/datos?" + lqcParams(filters), { signal }))
          .records,
      );
    },
    async oqcRecords(
      filters: OqcFilters,
      signal?: AbortSignal,
    ): Promise<OqcReport> {
      const data = object(
        await read("/api/oqc/liberaciones?" + oqcParams(filters), { signal }),
      );
      return {
        rows: rows(data.records),
        summary: object(data.summary),
        truncated: data.truncated === true,
        limit: number(data.limit),
      };
    },
    exportOqc(filters: OqcFilters) {
      return download(
        "/api/oqc/liberaciones/export?" + oqcParams(filters),
        "historial_liberacion_oqc.xlsx",
      );
    },
    async ppm(stage: PpmStage, filters: PpmFilters, signal?: AbortSignal) {
      return ppmReport(
        await read(
          "/api/control_calidad/ppms/" +
            stage +
            "?" +
            ppmParams(stage, filters),
          { signal },
        ),
      );
    },
    async savePpmTarget(stage: PpmStage, target: number) {
      if (!Number.isSafeInteger(target) || target < 0)
        throw new Error("La meta debe ser un entero mayor o igual a cero.");
      const result = await write(
        "/api/control_calidad/ppms/" + stage + "/target",
        "POST",
        { target },
      );
      if (!Number.isSafeInteger(result.target) || number(result.target) < 0)
        throw new Error("El servidor no confirmó la meta guardada.");
      return number(result.target);
    },
    async stations(filters: StationFilters, signal?: AbortSignal) {
      const data = object(
        await read(stationsRoot + "?" + stationParams(filters), { signal }),
      );
      return rows(data.records).map(stationRecord);
    },
    async saveStation(draft: StationDraft, recordId?: number) {
      const issues = stationIssues(draft);
      if (issues.length) throw new Error(issues.join(" "));
      const result = await write(
        stationsRoot + (recordId === undefined ? "" : "/" + id(recordId)),
        recordId === undefined ? "POST" : "PUT",
        {
          ...draft,
          station_code: draft.station_code.trim(),
          station_name: draft.station_name.trim(),
          host_name: draft.host_name.trim(),
        },
      );
      return stationRecord(result.record);
    },
    async setActive(recordId: number, isActive: boolean) {
      const result = await write(
        stationsRoot + "/" + id(recordId) + "/active",
        "PATCH",
        { is_active: isActive },
      );
      return stationRecord(result.record);
    },
    async deleteStation(recordId: number) {
      await write(stationsRoot + "/" + id(recordId), "DELETE");
    },
    exportStations(filters: StationFilters) {
      return download(
        stationsRoot + "/export?" + stationParams(filters),
        "estaciones_calidad.xlsx",
      );
    },
    async history(
      kind: HistoryKind,
      filters: HistoryFilters,
      searches: HistoryFilters,
      page: number,
      perPage: number,
      signal?: AbortSignal,
    ): Promise<HistoryResult> {
      const params = historyParams(kind, filters, searches);
      params.set("page", String(id(page)));
      if (!Number.isInteger(perPage) || perPage < 1 || perPage > 1000)
        throw new Error("El tamaño de página no es válido.");
      params.set("per_page", String(perPage));
      const data = object(
        await read(histories[kind].endpoint + "/data?" + params, { signal }),
      );
      if (!Number.isSafeInteger(data.total) || number(data.total) < 0)
        throw new Error("El servidor devolvió un total inválido.");
      return {
        rows: rows(data.rows),
        total: number(data.total),
        page: id(data.page),
        perPage: id(data.per_page),
        stopped:
          data.total_detenido == null ? undefined : text(data.total_detenido),
      };
    },
    async options(
      kind: HistoryKind,
      signal?: AbortSignal,
    ): Promise<Record<string, string[]>> {
      const data = object(
        await read(histories[kind].endpoint + "/opciones", { signal }),
      );
      const result: Record<string, string[]> = {};
      for (const field of histories[kind].filters) {
        if (!field.optionsKey) continue;
        const values = data[field.optionsKey];
        if (!Array.isArray(values))
          throw new Error("El servidor devolvió opciones inválidas.");
        result[field.optionsKey] = values.filter(
          (value) => typeof value === "string",
        );
      }
      return result;
    },
    exportHistory(
      kind: HistoryKind,
      filters: HistoryFilters,
      searches: HistoryFilters,
    ) {
      return download(
        histories[kind].endpoint +
          "/export?" +
          historyParams(kind, filters, searches),
        histories[kind].filename + ".xlsx",
      );
    },
  };
}
export type QualityApi = ReturnType<typeof createQualityApi>;
