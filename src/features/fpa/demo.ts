import { saveDownload } from "@/core/http";
import type {
  Adjustment,
  Filters,
  FpaDetail,
  FpaItem,
  RequestPayload,
} from "./types";
const rows: FpaDetail[] = [
  {
    id: 1,
    folio: "FPA-DEMO-1",
    fpaPartNumber: "EBR80757401",
    requester: "Demostración",
    createdAt: "2026-11-04 08:00:00",
    status: "PARCIAL",
    items: [
      {
        id: 1,
        labelType: "MICOM",
        code: "PGM80757401 LOTE-DEMO",
        requested: 20,
        consumed: 8,
        confirmed: 8,
        remaining: 12,
      },
    ],
    printAttempts: [
      {
        id: 1,
        createdAt: "2026-11-04 08:10:00",
        labelType: "MICOM",
        quantity: 8,
        operator: "Operador demo",
        stationId: "DEMO",
        status: "printed",
        error: null,
      },
    ],
    events: [
      {
        id: 1,
        createdAt: "2026-11-04 08:00:00",
        type: "CREADA",
        actor: "Demostración",
        reason: null,
      },
    ],
  },
];
const keys = new Map<string, number>();
export function list(filters: Filters, page: number, pageSize: number) {
  const filtered = rows.filter(
    (row) =>
      (!filters.folio || row.folio.includes(filters.folio)) &&
      (!filters.fpaPartNumber ||
        row.fpaPartNumber.includes(filters.fpaPartNumber)) &&
      (!filters.requester || row.requester.includes(filters.requester)) &&
      (!filters.status || row.status === filters.status) &&
      (!filters.dateFrom || row.createdAt.slice(0, 10) >= filters.dateFrom) &&
      (!filters.dateTo || row.createdAt.slice(0, 10) <= filters.dateTo),
  );
  return {
    data: structuredClone(
      filtered.slice((page - 1) * pageSize, page * pageSize),
    ),
    meta: { total: filtered.length },
  };
}
export function detail(id: number): FpaDetail {
  const record = rows.find((row) => row.id === id);
  if (!record) throw new Error("Solicitud no encontrada.");
  return structuredClone(record);
}
export function create(payload: RequestPayload, key: string) {
  if (keys.has(key)) return detail(keys.get(key)!);
  const id = Math.max(0, ...rows.map((row) => row.id)) + 1;
  const items: FpaItem[] = [];
  if (payload.micomQuantity > 0)
    items.push({
      id: id * 2,
      labelType: "MICOM",
      code: payload.pgmMicom,
      requested: payload.micomQuantity,
      consumed: 0,
      confirmed: 0,
      remaining: payload.micomQuantity,
    });
  if (payload.compQuantity > 0)
    items.push({
      id: id * 2 + 1,
      labelType: "COMP",
      code: payload.pgmComp,
      requested: payload.compQuantity,
      consumed: 0,
      confirmed: 0,
      remaining: payload.compQuantity,
    });
  const record: FpaDetail = {
    id,
    folio: `FPA-DEMO-${id}`,
    fpaPartNumber: payload.fpaPartNumber,
    requester: "Demostración",
    status: "PENDIENTE",
    createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    items,
    printAttempts: [],
    events: [],
  };
  rows.unshift(record);
  keys.set(key, id);
  return detail(id);
}
export function adjust(id: number, payload: Adjustment) {
  const record = rows.find((row) => row.id === id)!;
  if (!payload.reason.trim()) throw new Error("El motivo es obligatorio.");
  record.items.forEach((item) => {
    const quantity =
      item.labelType === "MICOM" ? payload.micomQuantity : payload.compQuantity;
    if (quantity !== undefined) {
      if (quantity < item.consumed)
        throw new Error("La cantidad no puede ser menor a la consumida.");
      item.requested = quantity;
      item.remaining = quantity - item.consumed;
    }
  });
  record.status = record.items.every((item) => !item.requested)
    ? "CANCELADA"
    : record.items.every((item) => item.requested === item.consumed)
      ? "COMPLETADA"
      : record.items.some((item) => item.consumed > 0)
        ? "PARCIAL"
        : "PENDIENTE";
  record.events.unshift({
    id: Date.now(),
    createdAt: new Date().toISOString(),
    type: "CANTIDAD_AJUSTADA",
    actor: "Demostración",
    reason: payload.reason,
  });
  return detail(id);
}
export function exportFile(filters: Filters) {
  const data = list(filters, 1, rows.length).data;
  saveDownload(
    new Blob(
      [
        "\ufeffFolio,Parte,Estado\n" +
          data
            .map((row) =>
              [row.folio, row.fpaPartNumber, row.status]
                .map(
                  (value) =>
                    `"${value.replace(/"/g, '""').replace(/^[=+@-]/, "'$&")}"`,
                )
                .join(","),
            )
            .join("\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    "fpa_demostracion.csv",
  );
}
