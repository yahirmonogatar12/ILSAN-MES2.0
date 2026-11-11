import { downloadFile, request } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import { decodeResult, params } from "./model";
import type { AreaApi } from "./types";
export function createAreaApi(mode: RuntimeMode): AreaApi {
  const demo = () => import("./demo").then((module) => module.demoAreaApi);
  return {
    async list(area, filters, searches, page, size, signal) {
      const query = params(area, filters, searches, page, size);
      if (mode === "demo")
        return (await demo()).list(area, filters, searches, page, size, signal);
      return decodeResult(
        await request<unknown>(`/api/material/${area}?${query}`, { signal }),
        size,
      );
    },
    async export(area, filters, searches) {
      const query = params(area, filters, searches);
      if (mode === "demo")
        return (await demo()).export(area, filters, searches);
      await downloadFile(
        `/api/material/${area}/export?${query}`,
        `Material_${area.toUpperCase()}_${query.get("vista")}.xlsx`,
      );
    },
  };
}
