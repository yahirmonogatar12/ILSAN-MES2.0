import { request, downloadFile } from "@/core/http";
import type { RuntimeMode } from "@/core/runtime";
import { filterParams } from "./model";
import type {
  Area,
  Component,
  Origin,
  ProgrammingOption,
  ReworkApi,
  ReworkDetail,
  ReworkSummary,
  Scan,
} from "./types";
type Json = Record<string, unknown>;
function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("La respuesta de retrabajo no tiene el formato esperado.");
  return value as Json;
}
function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string")
    throw new Error("El servidor devolvió un texto de retrabajo inválido.");
  return value;
}
function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new Error("El servidor devolvió una cantidad de retrabajo inválida.");
  return value as number;
}
function items<T>(value: unknown, decode: (value: unknown) => T): T[] {
  if (!Array.isArray(value))
    throw new Error("El servidor no devolvió los registros de retrabajo.");
  return value.map(decode);
}
function area(value: unknown): Area {
  const r = object(value);
  return {
    area: text(r.area),
    nombre: text(r.nombre),
    hecho: integer(r.hecho),
    total: integer(r.total),
    estado: text(r.estado),
  };
}
function option(value: unknown): ProgrammingOption {
  const r = object(value),
    result = {
      ic_location: text(r.ic_location),
      micom_part_no: text(r.micom_part_no),
      programming_label: text(r.programming_label),
    };
  if (!result.ic_location || !result.programming_label)
    throw new Error("La programación devuelta está incompleta.");
  return result;
}
function summary(value: unknown): ReworkSummary {
  const r = object(value);
  if (
    !integer(r.id) ||
    !text(r.folio) ||
    !["ASSY", "IMD_SMD"].includes(text(r.tipo_material)) ||
    typeof r.cambio_etiquetas !== "boolean"
  )
    throw new Error("La solicitud de retrabajo está incompleta.");
  return {
    id: integer(r.id),
    folio: text(r.folio),
    np_origen: text(r.np_origen),
    np_destino: text(r.np_destino),
    cantidad: integer(r.cantidad),
    tipo_material: r.tipo_material as ReworkSummary["tipo_material"],
    cambio_etiquetas: r.cambio_etiquetas,
    lote_impresion: text(r.lote_impresion),
    comentarios: text(r.comentarios),
    origenes_txt: text(r.origenes_txt),
    status: text(r.status),
    estado: text(r.estado),
    areas: items(r.areas, area),
    emb_solicitado: integer(r.emb_solicitado),
    emb_surtido: integer(r.emb_surtido),
    solicitado_por: text(r.solicitado_por),
    cancelado_por: text(r.cancelado_por),
    cancelado_at: text(r.cancelado_at),
    created_at: text(r.created_at),
  };
}
function detail(value: unknown): ReworkDetail {
  const r = object(value);
  return {
    ...summary(r),
    origenes: items(r.origenes, (value) => {
      const o = object(value);
      if (!["EMBARQUES", "SMD", "PRODUCCION"].includes(text(o.origen)))
        throw new Error("Origen de material inválido.");
      return { origen: o.origen as Origin, cantidad: integer(o.cantidad) };
    }),
    programaciones: items(r.programaciones, (value) => {
      const p = object(value);
      return {
        ...option(p),
        fpa_request_id:
          p.fpa_request_id == null ? null : integer(p.fpa_request_id),
        fpa_folio: text(p.fpa_folio),
        fpa_status: text(p.fpa_status),
      };
    }),
    componentes: items(r.componentes, (value) => {
      const c = object(value);
      if (!["ASSY", "SMD", "IMD"].includes(text(c.tipo)))
        throw new Error("Componente inválido.");
      return {
        tipo: c.tipo,
        ubicacion: text(c.ubicacion),
        np_anterior: text(c.np_anterior),
        np_nuevo: text(c.np_nuevo),
      } as Component;
    }),
    salidas_embarques: items(r.salidas_embarques, (value) => {
      const s = object(value);
      return {
        folio: text(s.folio),
        part_number: text(s.part_number),
        cantidad: integer(s.cantidad),
        cajas: items(s.cajas, text),
        registrado_por: text(s.registrado_por),
        created_at: text(s.created_at),
      };
    }),
    escaneos: items(r.escaneos, (value) => {
      const s = object(value);
      return Object.fromEntries(
        [
          "etapa",
          "qr_smd_anterior",
          "qr_smd_nuevo",
          "qr_assy_anterior",
          "qr_assy_nuevo",
          "usuario",
          "created_at",
        ].map((key) => [key, text(s[key])]),
      ) as unknown as Scan;
    }),
  };
}
function validId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error("Solicitud inválida.");
}
export function createReworkApi(mode: RuntimeMode): ReworkApi {
  const demo = () => import("./demo").then((module) => module.demoReworkApi);
  return {
    async list(filters, signal) {
      if (mode === "demo") return (await demo()).list(filters, signal);
      return items(
        object(
          await request<unknown>(`/api/retrabajo?${filterParams(filters)}`, {
            signal,
          }),
        ).records,
        summary,
      );
    },
    async detail(id, signal) {
      validId(id);
      if (mode === "demo") return (await demo()).detail(id, signal);
      return detail(
        object(await request<unknown>(`/api/retrabajo/${id}`, { signal }))
          .record,
      );
    },
    async models(signal) {
      if (mode === "demo") return (await demo()).models(signal);
      return items(
        object(await request<unknown>("/api/raw/modelos", { signal })).data,
        text,
      );
    },
    async programming(part, signal) {
      if (mode === "demo") return (await demo()).programming(part, signal);
      return items(
        object(
          await request<unknown>(
            `/api/retrabajo/programacion?${new URLSearchParams({ part_no: part.trim().toUpperCase() })}`,
            { signal },
          ),
        ).records,
        option,
      );
    },
    async create(payload, key) {
      if (!key.trim()) throw new Error("Falta la clave de la solicitud.");
      if (mode === "demo") return (await demo()).create(payload, key);
      return detail(
        object(
          await request<unknown>("/api/retrabajo", {
            method: "POST",
            headers: { "Idempotency-Key": key },
            body: JSON.stringify(payload),
          }),
        ).record,
      );
    },
    async cancel(id) {
      validId(id);
      if (mode === "demo") return (await demo()).cancel(id);
      const r = object(
        await request<unknown>(`/api/retrabajo/${id}/cancelar`, {
          method: "POST",
        }),
      );
      return { record: detail(r.record), avisos: items(r.avisos, text) };
    },
    async export(filters) {
      if (mode === "demo") return (await demo()).export(filters);
      await downloadFile(
        `/api/retrabajo/export?${filterParams(filters)}`,
        "solicitudes_retrabajo.xlsx",
      );
    },
  };
}
