import { containsText as contains } from "@/shared/lib/text";
import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import { histories, id, number, object, text, today } from "./model";
import type { HistoryKind, Row, Station } from "./types";

const stationRoot = "/api/control_calidad/stations_qa";
let nextId = 4;
const stations: Station[] = [
  {
    id: 1,
    station_code: "ICT-01",
    station_name: "ICT línea M1",
    station_type: "ICT",
    host_name: "M1",
    is_active: true,
    created_at_utc: "2026-11-01 15:00:00",
    updated_at_utc: "2026-11-01 15:00:00",
  },
  {
    id: 2,
    station_code: "ICT-01",
    station_name: "ICT línea M2",
    station_type: "ICT",
    host_name: "M2",
    is_active: true,
    created_at_utc: "2026-11-01 15:00:00",
    updated_at_utc: "2026-11-01 15:00:00",
  },
  {
    id: 3,
    station_code: "FCT-01",
    station_name: "FCT línea M1",
    station_type: "FCT",
    host_name: "M1",
    is_active: false,
    created_at_utc: "2026-11-01 15:00:00",
    updated_at_utc: "2026-11-01 15:00:00",
  },
];
const baseMaterial = {
  fecha: today(),
  hora: "08:30:00",
  linea: "IMD A",
  tipo: "MD",
  contenedor: "MD-0001/A",
  material: "0001/MAT-01-A",
  posicion: "01",
  lote_proveedor: "LOT-0001/A",
  proveedor: "SAMWHA",
  spec: "10uF 50V",
  qty: 0,
  resultado: "NG",
  _destacar: true,
};
const tooling = {
  fecha: today(),
  turno: "DIA",
  linea: "SMT A",
  lote: "SMT-0001/A",
  parte: "EBR23966228-01-A",
  modelo: "Modelo demo",
  plan: 500,
  usos: 500,
  origen: "PLAN",
  asignado: today() + " 08:00:00",
};
const historyRows: Record<HistoryKind, Row[]> = {
  smt: [
    {
      fecha: today(),
      hora: "09:20:00",
      linea: "SMT A",
      maquina: "Mounter 1",
      slot: 0,
      feeder: "FRONT",
      resultado: "NG",
      parte: "0001/MAT-01-A",
      cantidad: 0,
      lote: "LOT-0001/A",
      barcode: "0001/SMT+01-A",
      barcode_anterior: "0001/OLD+01-A",
      seq: "0001",
      vendor: "SAMWHA",
      archivo: "Log-001.txt",
    },
    {
      fecha: today(),
      hora: "08:00:00",
      linea: "SMT B",
      maquina: "Mounter 2",
      slot: 2,
      feeder: "REAR",
      resultado: "OK",
      parte: "0002/MAT-02-B",
      cantidad: 500,
      lote: "LOT-0002/B",
      barcode: "0002/SMT+02-B",
      barcode_anterior: "",
      seq: "0002",
      vendor: "ROHM",
      archivo: "Log-002.txt",
    },
  ],
  imd: [
    { ...baseMaterial },
    {
      ...baseMaterial,
      tipo: "RACK",
      contenedor: "CNT-0002/B",
      posicion: "RACK-02",
      qty: 15,
      resultado: "EQUIV",
      _destacar: false,
    },
  ],
  assy: [
    { ...baseMaterial, linea: "M1", ubicacion: "U-0001/A" },
    {
      ...baseMaterial,
      linea: "M2",
      ubicacion: "U-0002/B",
      resultado: "OK",
      qty: 25,
      _destacar: false,
    },
  ],
  pasta: [
    {
      codigo: "0001/PASTA-01-A",
      parte: "PST-0001/A",
      lote: "LOT-0001/A",
      ciclo: 1,
      estado: "SCRAP",
      linea: "SMT A",
      sacado_frio: today() + " 06:00:00",
      listo_ambiente: today() + " 08:00:00",
      agitado: today() + " 08:05:00",
      en_linea: today() + " 08:10:00",
      expira: today() + " 14:00:00",
      consumido: "",
      cantidad: 0,
      unidad: "KG",
      operador: "demo",
      _destacar: true,
    },
    {
      codigo: "0002/PASTA-02-B",
      parte: "PST-0002/B",
      lote: "LOT-0002/B",
      ciclo: 2,
      estado: "IN_LINE",
      linea: "SMT B",
      sacado_frio: today() + " 07:00:00",
      listo_ambiente: today() + " 09:00:00",
      agitado: today() + " 09:05:00",
      en_linea: today() + " 09:10:00",
      expira: today() + " 15:00:00",
      consumido: "",
      cantidad: "0.5",
      unidad: "KG",
      operador: "demo",
      _destacar: false,
    },
  ],
  mask: [{ ...tooling, mask: "0001/MASK-01-A" }],
  squeegee: [
    { ...tooling, squeegee: "0001/SQ-01-A", squeegee_2: "0002/SQ-02-B" },
  ],
  interlock: [
    {
      fecha: today(),
      turno: "DIA",
      linea: "SMT A",
      modo: "INPUT",
      detectado: today() + " 09:00:00",
      liberado: today() + " 09:00:36",
      duracion: "36.0s",
      duracion_ms: 36000,
      motivo: "SCAN_TARDIO",
      cierre: "SCANNED",
      detalle: "Lectura tardía",
      lote: "SMT-0001/A",
      parte: "EBR23966228-01-A",
      ciclo: 3,
      _destacar: false,
    },
    {
      fecha: today(),
      turno: "DIA",
      linea: "SMT A",
      modo: "INPUT",
      detectado: today() + " 08:30:00",
      liberado: today() + " 08:30:02",
      duracion: "2.0s",
      duracion_ms: 2000,
      motivo: "NOT_SCANNED",
      cierre: "REMOVED",
      detalle: "Detección corta",
      lote: "SMT-0001/A",
      parte: "EBR23966228-01-A",
      ciclo: 2,
      _destacar: false,
    },
    {
      fecha: today(),
      turno: "DIA",
      linea: "SMT A",
      modo: "INPUT",
      detectado: today() + " 08:00:00",
      liberado: today() + " 08:00:00",
      duracion: "0.4s",
      duracion_ms: 400,
      motivo: "SCAN_REJECTED",
      cierre: "RESET",
      detalle: "Sin plan en progreso",
      lote: "SMT-0001/A",
      parte: "EBR23966228-01-A",
      ciclo: 1,
      _destacar: true,
    },
  ],
  vision: [
    {
      hora: today() + " 10:10:00",
      estacion: "ICT-01",
      linea: "M1",
      codigo: "0001/ICT+01-A",
      tipo: "NG en Vision",
      motivo: "Última inspección NG",
      maquina: "Vision M1",
      inspeccion: today() + " 09:50:00",
      _destacar: true,
    },
    {
      hora: today() + " 10:00:00",
      estacion: "ICT-01",
      linea: "M2",
      codigo: "0002/ICT+02-B",
      tipo: "Escaneo repetido",
      motivo: "Segundo escaneo en la misma sesión",
      maquina: "Vision M2",
      inspeccion: today() + " 09:30:00",
      _destacar: false,
    },
  ],
};

const starts = (value: unknown, search: string) =>
  text(value)
    .toLocaleLowerCase("es")
    .startsWith(search.toLocaleLowerCase("es"));

function filteredHistory(kind: HistoryKind, params: URLSearchParams) {
  const config = histories[kind];
  return historyRows[kind].filter((row) => {
    const date = text(
      kind === "pasta"
        ? row.sacado_frio
        : kind === "vision"
          ? row.hora
          : row.fecha,
    ).slice(0, 10);
    if (params.get("fecha_desde") && date < params.get("fecha_desde")!)
      return false;
    if (params.get("fecha_hasta") && date > params.get("fecha_hasta")!)
      return false;
    for (const { key } of config.filters) {
      const term = params.get(key) || "";
      if (!term || key.startsWith("fecha_")) continue;
      if (key === "incluir_cortos") continue;
      if (key === "min_seg") {
        if (number(row.duracion_ms) < Number(term) * 1000) return false;
      } else if (key === "parte" || key === "material") {
        if (!starts(row[key], term)) return false;
      } else if (key === "barcode_like") {
        if (!contains(row.barcode, term, "es")) return false;
      } else if (key === "contenedor") {
        if (!contains(row.contenedor, term, "es")) return false;
      } else if (key === "codigo") {
        const codes =
          kind === "mask"
            ? [row.mask]
            : kind === "squeegee"
              ? [row.squeegee, row.squeegee_2]
              : [row.codigo];
        if (!codes.some((code) => contains(code, term, "es"))) return false;
      } else if (key === "busqueda") {
        const keys =
          kind === "pasta"
            ? ["codigo", "parte", "lote"]
            : kind === "interlock"
              ? ["detalle", "lote", "parte"]
              : kind === "vision"
                ? ["codigo", "motivo"]
                : ["lote", "parte", "modelo"];
        if (!keys.some((field) => contains(row[field], term, "es")))
          return false;
      } else if (row[key] !== term) return false;
    }
    if (
      kind === "interlock" &&
      params.get("incluir_cortos") !== "1" &&
      row.motivo === "NOT_SCANNED" &&
      number(row.duracion_ms) < 3000
    )
      return false;
    return config.columns.every(({ key }) => {
      const term = params.get("cf_" + key) || "";
      if (!term) return true;
      if (kind === "interlock" && key === "duracion")
        return (
          Number.isFinite(Number(term)) &&
          number(row.duracion_ms) >= Number(term) * 1000
        );
      if ((kind === "imd" || kind === "assy") && key === "tipo")
        return starts(row.tipo, term);
      if (kind === "smt" && (key === "fecha" || key === "hora"))
        return text(row[key])
          .replace(/\D/g, "")
          .includes(term.replace(/\D/g, ""));
      return contains(row[key], term, "es");
    });
  });
}
function filteredStations(params: URLSearchParams) {
  const search = params.get("q") || "",
    type = params.get("station_type");
  return stations.filter(
    (row) =>
      (!type || row.station_type === type) &&
      [
        row.station_code,
        row.station_name,
        row.host_name,
        row.station_type,
      ].some((value) => contains(value, search, "es")),
  );
}
function historyRoute(path: string) {
  return (
    Object.entries(histories) as [
      HistoryKind,
      (typeof histories)[HistoryKind],
    ][]
  ).find(([, config]) =>
    ["data", "opciones", "export"].some(
      (action) => path === config.endpoint + "/" + action,
    ),
  );
}
function duration(ms: number) {
  if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
  const seconds = Math.floor(ms / 1000),
    minutes = Math.floor(seconds / 60),
    hours = Math.floor(minutes / 60);
  return hours
    ? `${hours}h ${String(minutes % 60).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`
    : `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}
export async function demoRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  if (/^\/api\/(lqc|oqc|control_calidad\/ppms)\//.test(path)) {
    const { reportDemoRequest } = await import("./reportsDemo");
    return reportDemoRequest(path, init);
  }
  const url = new URL(path, "http://demo"),
    params = url.searchParams;
  const method = init?.method ?? "GET";
  const data = init?.body ? object(JSON.parse(String(init.body))) : {};
  if (url.pathname.startsWith(stationRoot)) {
    if (method === "GET")
      return { records: structuredClone(filteredStations(params)) };
    const current = /\/(\d+)/.exec(url.pathname.slice(stationRoot.length));
    const row = current
      ? stations.find((item) => item.id === id(current[1]))
      : undefined;
    if (current && !row) throw new Error("Estación no encontrada.");
    if (method === "DELETE" && row) {
      stations.splice(stations.indexOf(row), 1);
      return { success: true };
    }
    if (method === "PATCH" && row) row.is_active = data.is_active === true;
    else {
      const key = (value: unknown) => text(value).toLocaleLowerCase("es");
      if (
        stations.some(
          (item) =>
            item !== row &&
            key(item.station_code) === key(data.station_code) &&
            key(item.host_name) === key(data.host_name),
        )
      )
        throw new Error(
          "Ya existe una estación con ese código en la misma línea.",
        );
      const record = {
        station_code: text(data.station_code),
        station_name: text(data.station_name),
        station_type: text(data.station_type) as Station["station_type"],
        host_name: text(data.host_name),
        is_active: data.is_active === true,
      };
      if (row) Object.assign(row, record);
      else {
        const created = {
          ...record,
          id: nextId++,
          created_at_utc: new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
          updated_at_utc: "",
        };
        stations.push(created);
        return { success: true, record: structuredClone(created) };
      }
    }
    if (row)
      row.updated_at_utc = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
    return { success: true, record: structuredClone(row) };
  }
  const route = historyRoute(url.pathname);
  if (!route) throw new Error("Consulta demo no disponible.");
  const [kind, config] = route;
  if (url.pathname.endsWith("/opciones")) {
    return Object.fromEntries(
      config.filters
        .filter((field) => field.optionsKey)
        .map((field) => {
          const key =
            field.optionsKey === "lineas"
              ? "linea"
              : field.optionsKey === "maquinas"
                ? "maquina"
                : field.key;
          return [
            field.optionsKey!,
            [
              ...new Set(
                historyRows[kind].map((row) => text(row[key])).filter(Boolean),
              ),
            ].sort(),
          ];
        }),
    );
  }
  const rows = filteredHistory(kind, params);
  const page = id(params.get("page") || 1),
    perPage = id(params.get("per_page") || 500);
  return {
    rows: structuredClone(rows.slice((page - 1) * perPage, page * perPage)),
    total: rows.length,
    page,
    per_page: perPage,
    ...(kind === "interlock"
      ? {
          total_detenido: duration(
            rows.reduce((sum, row) => sum + number(row.duracion_ms), 0),
          ),
        }
      : {}),
  };
}
export function demoDownload(path: string, filename: string) {
  if (path.startsWith("/api/oqc/liberaciones/export")) {
    return import("./reportsDemo").then(({ exportOqcDemo }) =>
      exportOqcDemo(path, filename),
    );
  }
  const url = new URL(path, "http://demo");
  if (url.pathname.startsWith(stationRoot)) {
    const columns = [
      "Línea",
      "Código",
      "Nombre",
      "Tipo",
      "Estado",
      "Creado UTC",
      "Actualizado UTC",
    ];
    return exportSpreadsheet(filename, [
      {
        name: "Estaciones QA",
        rows: [
          columns,
          ...filteredStations(url.searchParams).map((row) => [
            row.host_name,
            row.station_code,
            row.station_name,
            row.station_type,
            row.is_active ? "Activa" : "Inactiva",
            row.created_at_utc,
            row.updated_at_utc,
          ]),
        ],
      },
    ]);
  }
  const route = historyRoute(url.pathname);
  if (!route) throw new Error("Exportación demo no disponible.");
  const [kind, config] = route;
  return exportSpreadsheet(filename, [
    {
      name: kind === "vision" ? "Escáner ICT" : "Historial " + kind,
      rows: [
        config.columns.map((column) => column.title),
        ...filteredHistory(kind, url.searchParams).map((row) =>
          config.columns.map((column) => {
            const value = row[column.key];
            return typeof value === "number" ? value : text(value);
          }),
        ),
      ],
    },
  ]);
}
