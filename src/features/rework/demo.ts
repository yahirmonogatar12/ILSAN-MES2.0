import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import { areaText, filterParams, mexicoDate, STATES } from "./model";
import type {
  Filters,
  RequestPayload,
  ReworkApi,
  ReworkDetail,
  Area,
  ProgrammingOption,
} from "./types";
const programmingOptions: ProgrammingOption[] = [
  {
    ic_location: "IC1",
    micom_part_no: "SAA30091701",
    programming_label: "SAA30091 701(52DE)",
  },
  {
    ic_location: "IC1",
    micom_part_no: "SAA30091702",
    programming_label: "SAA30091 702(53DE)",
  },
  {
    ic_location: "IC2",
    micom_part_no: "SAA30091703",
    programming_label: "SAA30091 703(54DE)",
  },
];
const records = new Map<number, ReworkDetail>(),
  keys = new Map<string, number>();
let sequence = 510;
function clone<T>(value: T): T {
  return structuredClone(value);
}
function areas(payload: RequestPayload): Area[] {
  const amount = payload.origenes.reduce((sum, row) => sum + row.cantidad, 0),
    out: Area[] = [];
  const add = (area: string, nombre: string, total = amount) =>
    out.push({ area, nombre, hecho: 0, total, estado: "PENDIENTE" });
  const shipment = payload.origenes.find((row) => row.origen === "EMBARQUES");
  if (shipment) add("EMBARQUES", "Embarques", shipment.cantidad);
  if (payload.programaciones.length)
    add("MICOM", "MICOM", payload.programaciones.length);
  if (payload.np_origen !== payload.np_destino) add("IMPRESION", "Impresión");
  if (payload.programaciones.length || payload.np_origen !== payload.np_destino)
    add(
      "CP_RETRABAJO",
      payload.programaciones.length ? "Reprogramación" : "Cambio de etiquetas",
    );
  if (payload.componentes.some((row) => row.tipo === "ASSY"))
    add("CP_REPARACION", "Reparación ASSY");
  if (payload.componentes.some((row) => row.tipo !== "ASSY"))
    add("SMD_REPARACION", "Reparación SMD/IMD");
  return out;
}
function make(
  id: number,
  payload: RequestPayload,
  date = mexicoDate(),
): ReworkDetail {
  const cantidad = payload.origenes.reduce((sum, row) => sum + row.cantidad, 0),
    changed = payload.np_origen !== payload.np_destino;
  return {
    id,
    folio: `RT-${date.replaceAll("-", "")}-${id}`,
    np_origen: payload.np_origen,
    np_destino: payload.np_destino,
    cantidad,
    tipo_material: payload.tipo_material,
    cambio_etiquetas: changed,
    lote_impresion: changed ? `RTB-DEMO-${id}` : "",
    comentarios: payload.comentarios,
    origenes_txt: payload.origenes
      .map((row) => `${row.origen}: ${row.cantidad}`)
      .join(", "),
    status: "ACTIVA",
    estado: "PENDIENTE",
    areas: areas(payload),
    emb_solicitado:
      payload.origenes.find((row) => row.origen === "EMBARQUES")?.cantidad ?? 0,
    emb_surtido: 0,
    solicitado_por: "demo",
    cancelado_por: "",
    cancelado_at: "",
    created_at: `${date} 08:00:00`,
    origenes: clone(payload.origenes),
    componentes: clone(payload.componentes),
    programaciones: payload.programaciones.map((p, index) => ({
      ...p,
      micom_part_no:
        programmingOptions.find(
          (option) =>
            option.ic_location === p.ic_location &&
            option.programming_label === p.programming_label,
        )?.micom_part_no ?? "",
      fpa_request_id: id * 10 + index,
      fpa_folio: `FPA-DEMO-${id}-${index + 1}`,
      fpa_status: "PENDIENTE",
    })),
    salidas_embarques: [],
    escaneos: [],
  };
}
const fixture: RequestPayload = {
  np_origen: "EBR11111111",
  np_destino: "EBR22222222",
  tipo_material: "ASSY",
  origenes: [
    { origen: "EMBARQUES", cantidad: 3 },
    { origen: "SMD", cantidad: 2 },
  ],
  programaciones: [
    { ic_location: "IC1", programming_label: "SAA30091 701(52DE)" },
  ],
  componentes: [
    {
      tipo: "ASSY",
      ubicacion: "IC2",
      np_anterior: "SAA-ANTERIOR",
      np_nuevo: "SAA-NUEVO",
    },
    { tipo: "IMD", ubicacion: "C12", np_anterior: "", np_nuevo: "" },
  ],
  comentarios: "Solicitud de demostración",
};
for (let id = 1; id <= sequence; id++) {
  const item = make(id, fixture, id === 1 ? "2025-01-01" : mexicoDate());
  if (id % 3 === 0) {
    item.estado = "EN_PROCESO";
    item.areas[0].hecho = 2;
    item.areas[0].estado = "EN_PROCESO";
    item.emb_surtido = 2;
  }
  if (id % 7 === 0) {
    item.estado = "COMPLETADA";
    item.areas.forEach((area) => {
      area.hecho = area.total;
      area.estado = "COMPLETADA";
    });
    item.emb_surtido = item.emb_solicitado;
  }
  if (id % 13 === 0) {
    item.estado = "CANCELADA";
    item.status = "CANCELADA";
    item.cancelado_por = "demo";
    item.cancelado_at = `${mexicoDate()} 09:00:00`;
  }
  item.salidas_embarques = [
    {
      folio: `EMB-SAL-${id}`,
      part_number: item.np_origen,
      cantidad: 2,
      registrado_por: "demo",
      created_at: item.created_at,
      cajas: [`CAJA-RT-${id}`, "Caja/con-version-A"],
    },
  ];
  item.escaneos = [
    {
      etapa: "CP_RETRABAJO",
      qr_smd_anterior: `smd-Old/${id}-A`,
      qr_smd_nuevo: `smd-New/${id}-B`,
      qr_assy_anterior: `ASSY-OLD-${id}`,
      qr_assy_nuevo: `ASSY-NEW-${id}`,
      usuario: "demo",
      created_at: item.created_at,
    },
  ];
  records.set(id, item);
}
function selected(filters: Filters, limit: number) {
  filterParams(filters);
  const code = filters.codigo.trim();
  return [...records.values()]
    .sort((a, b) => b.id - a.id)
    .filter((row) =>
      code
        ? [row.folio, row.np_origen, row.np_destino].includes(
            code.toUpperCase(),
          ) ||
          row.salidas_embarques.some(
            (s) => s.folio === code.toUpperCase() || s.cajas.includes(code),
          ) ||
          row.escaneos.some((scan) =>
            [
              scan.qr_smd_anterior,
              scan.qr_smd_nuevo,
              scan.qr_assy_anterior,
              scan.qr_assy_nuevo,
            ].includes(code),
          )
        : (!filters.desde || row.created_at.slice(0, 10) >= filters.desde) &&
          (!filters.hasta || row.created_at.slice(0, 10) <= filters.hasta),
    )
    .slice(0, limit)
    .filter((row) => !filters.estado || row.estado === filters.estado);
}
export const demoReworkApi: ReworkApi = {
  async list(filters) {
    return clone(selected(filters, 500));
  },
  async detail(id) {
    const row = records.get(id);
    if (!row) throw new Error("Solicitud no encontrada.");
    return clone(row);
  },
  async models() {
    return ["EBR11111111", "EBR22222222", "EBR23966228"];
  },
  async programming(part) {
    return part === "EBR23966228" ? [] : clone(programmingOptions);
  },
  async create(payload, key) {
    const prior = keys.get(key);
    if (prior) return this.detail(prior);
    const row = make(++sequence, payload);
    records.set(row.id, row);
    keys.set(key, row.id);
    return clone(row);
  },
  async cancel(id) {
    const row = records.get(id);
    if (!row) throw new Error("Solicitud no encontrada.");
    if (row.status !== "ACTIVA")
      throw new Error("La solicitud ya está cancelada.");
    row.status = "CANCELADA";
    row.estado = "CANCELADA";
    row.cancelado_por = "demo";
    row.cancelado_at = `${mexicoDate()} 10:00:00`;
    return { record: clone(row), avisos: [] };
  },
  async export(filters) {
    await exportSpreadsheet("solicitudes_retrabajo_demo.xlsx", [
      {
        name: "Retrabajo",
        rows: [
          [
            "Folio",
            "NP origen",
            "NP destino",
            "Cantidad",
            "Material",
            "Origen",
            "Áreas",
            "Estado",
            "Solicitó",
            "Fecha",
            "Comentarios",
          ],
          ...selected(filters, 5000).map((row) => [
            row.folio,
            row.np_origen,
            row.np_destino,
            row.cantidad,
            row.tipo_material === "ASSY" ? "ASSY" : "IMD-SMD",
            row.origenes_txt,
            areaText(row.areas),
            STATES[row.estado] ?? row.estado,
            row.solicitado_por,
            row.created_at,
            row.comentarios,
          ]),
        ],
      },
    ]);
  },
};
