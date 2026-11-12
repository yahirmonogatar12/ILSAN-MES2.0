import { PLANT_TIME_ZONE } from "@/shared/lib/date";
import { ApiError, saveDownload } from "@/core/http";
import { readStorage, writeStorage } from "@/shared/lib/storage";
import { csvCell, normalizePayload } from "./model";
import type {
  Catalogs,
  Filters,
  Material,
  MaterialPayload,
  VendorCost,
} from "./types";

const KEY = "mes-v2:demo-materiales:v1";
const HISTORY_KEY = "mes-v2:demo-costos:v1";
const samples = [
  [
    "RC0603FR-0710KL",
    "Resistor SMD 0603 · 10 kΩ ±1% · 0.1 W",
    "Resistencia",
    "Yageo",
    "0.0042",
    "Carrete",
    "Compra",
  ],
  [
    "GRM188R71C104KA01",
    "Capacitor cerámico 0603 · 100 nF · 16 V",
    "Capacitor",
    "Murata",
    "0.0120",
    "Carrete",
    "Compra",
  ],
  [
    "LM358DR",
    "Amplificador operacional dual · SOIC-8",
    "Circuito integrado",
    "Texas Instruments",
    "0.1840",
    "Carrete",
    "Compra",
  ],
  [
    "PCB-7421-11",
    "PCB principal · Modelo 7421 · Revisión 11",
    "PCB",
    "Ilsan Electronics",
    "1.4500",
    "Panel",
    "Cliente",
  ],
  [
    "CC0603KRX7R9BB104",
    "Capacitor multicapa 0603 · 100 nF · 50 V",
    "Capacitor",
    "Yageo",
    "0.0085",
    "Carrete",
    "Compra",
  ],
  [
    "BAV99-7-F",
    "Diodo de conmutación dual · SOT-23",
    "Semiconductor",
    "Diodes Inc.",
    "0.0210",
    "Carrete",
    "Compra",
  ],
  [
    "RC0402FR-0747KL",
    "Resistor SMD 0402 · 47 kΩ ±1%",
    "Resistencia",
    "Yageo",
    "0.0028",
    "Carrete",
    "Compra",
  ],
  [
    "CON-04P-2.54",
    "Conector vertical · 4 posiciones · Paso 2.54 mm",
    "Conector",
    "JST",
    "0.1150",
    "Bolsa",
    "Compra",
  ],
  [
    "MCU-STM32F030C8",
    "Microcontrolador ARM Cortex-M0 · LQFP-48",
    "Circuito integrado",
    "STMicroelectronics",
    "0.8900",
    "Charola",
    "Compra",
  ],
  [
    "LED-0603-GN",
    "LED SMD 0603 · Verde · 2.1 V",
    "Semiconductor",
    "Lite-On",
    "0.0180",
    "Carrete",
    "Compra",
  ],
  [
    "PCB-7421-22",
    "PCB de control · Modelo 7421 · Revisión 22",
    "PCB",
    "Ilsan Electronics",
    "0.9800",
    "Panel",
    "Cliente",
  ],
  [
    "LQH32CN100K23L",
    "Inductor SMD · 10 µH ±10% · 1210",
    "Inductor",
    "Murata",
    "0.0670",
    "Carrete",
    "Compra",
  ],
  [
    "CON-08P-1.25",
    "Conector horizontal · 8 posiciones · Paso 1.25 mm",
    "Conector",
    "JST",
    "0.2350",
    "Bolsa",
    "Compra",
  ],
  [
    "RC0603FR-071KL",
    "Resistor SMD 0603 · 1 kΩ ±1% · 0.1 W",
    "Resistencia",
    "Yageo",
    "0.0040",
    "Carrete",
    "Compra",
  ],
  [
    "TEST-POINT-01",
    "Punto de prueba · Montaje superficial",
    "Conector",
    "",
    "",
    "Bolsa",
    "Compra",
  ],
  [
    "PCB-8300-01",
    "PCB de potencia · Modelo 8300 · Revisión 01",
    "PCB",
    "",
    "",
    "Panel",
    "Cliente",
  ],
];

function seed(): Material[] {
  return samples.map(
    (
      [
        numero_parte,
        especificacion_material,
        clasificacion,
        vendedor,
        costo,
        unidad_empaque,
        propiedad_material,
      ],
      i,
    ) => ({
      numero_parte,
      especificacion_material,
      clasificacion,
      vendedor,
      unidad_empaque,
      propiedad_material,
      unidad_medida: "EA",
      vendedores: vendedor ? [vendedor] : [],
      costos: vendedor
        ? [
            {
              vendedor,
              costo,
              moneda: "USD",
              usuario_registro: "Demostración",
              fecha_registro: `2026-10-${String(12 + i).padStart(2, "0")} 09:30:00`,
            },
          ]
        : [],
      fecha_registro: `2026-10-${String(12 + i).padStart(2, "0")} 09:30:00`,
      usuario_registro: "Demostración",
    }),
  );
}

export function getDemoRows(): Material[] {
  return readStorage(KEY, seed());
}
function putRows(rows: Material[]) {
  writeStorage(KEY, rows);
}
function now() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: PLANT_TIME_ZONE,
  });
}

export function filterDemoRows(filters: Filters) {
  const q = filters.q.trim().toLocaleLowerCase();
  return getDemoRows()
    .filter(
      (row) =>
        (!filters.clasificacion ||
          row.clasificacion === filters.clasificacion) &&
        (!q ||
          [
            row.numero_parte,
            row.especificacion_material,
            row.propiedad_material,
            row.clasificacion,
            row.vendedor,
          ].some((v) => v.toLocaleLowerCase().includes(q))),
    )
    .sort((a, b) => a.numero_parte.localeCompare(b.numero_parte));
}

export function demoCatalogs(): Catalogs {
  const rows = getDemoRows();
  const distinct = (
    key:
      | "clasificacion"
      | "propiedad_material"
      | "unidad_empaque"
      | "unidad_medida",
  ) => [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort();
  return {
    clasificaciones: distinct("clasificacion"),
    propiedades: distinct("propiedad_material"),
    unidades_empaque: distinct("unidad_empaque"),
    unidades_medida: distinct("unidad_medida"),
    monedas: ["USD", "MXN", "KRW"],
  };
}

export function demoDetail(code: string) {
  const row = getDemoRows().find((r) => r.numero_parte === code);
  if (!row) throw new ApiError("Material no encontrado.", 404);
  return row;
}

export function demoHistory(code: string, vendor = ""): VendorCost[] {
  const history = readStorage<Record<string, VendorCost[]>>(HISTORY_KEY, {});
  const rows =
    history[code] ||
    getDemoRows().find((r) => r.numero_parte === code)?.costos ||
    [];
  return rows.filter((r) => !vendor || r.vendedor === vendor);
}

export function demoSave(input: MaterialPayload, editing: boolean) {
  const payload = normalizePayload(input);
  const rows = getDemoRows();
  const index = rows.findIndex((r) => r.numero_parte === payload.numero_parte);
  if (!editing && index >= 0)
    throw new ApiError("Ya existe un material con ese número de parte.", 409);
  if (editing && index < 0) throw new ApiError("Material no encontrado.", 404);
  const previous = index >= 0 ? rows[index] : undefined;
  const date = now();
  const costs = payload.vendedores.map((v) => ({
    ...v,
    costo: Number(v.costo).toFixed(4),
    usuario_registro: "Demostración",
    fecha_registro: date,
  }));
  const history = readStorage<Record<string, VendorCost[]>>(HISTORY_KEY, {});
  const oldHistory = history[payload.numero_parte] || previous?.costos || [];
  const changed = costs.filter(
    (c) =>
      !previous?.costos.some(
        (p) =>
          p.vendedor.toLowerCase() === c.vendedor.toLowerCase() &&
          p.costo === c.costo &&
          p.moneda === c.moneda,
      ),
  );
  const row: Material = {
    ...payload,
    vendedor: costs.map((v) => v.vendedor).join(", "),
    vendedores: costs.map((v) => v.vendedor),
    costos: costs,
    fecha_registro: previous?.fecha_registro || date,
    usuario_registro: previous?.usuario_registro || "Demostración",
    fecha_modificacion: editing ? date : "",
    usuario_modificacion: editing ? "Demostración" : "",
  };
  if (index < 0) rows.push(row);
  else rows[index] = row;
  putRows(rows);
  writeStorage(HISTORY_KEY, {
    ...history,
    [payload.numero_parte]: [...changed, ...oldHistory],
  });
  return row;
}

export function demoRemove(code: string) {
  if (!getDemoRows().some((r) => r.numero_parte === code))
    throw new ApiError("Material no encontrado.", 404);
  putRows(getDemoRows().filter((r) => r.numero_parte !== code));
}

export function demoExport(filters: Filters) {
  const fields = [
    "Número de parte",
    "Propiedad",
    "Clasificación",
    "Especificación",
    "Unidad empaque",
    "Unidad medida",
    "Vendedor",
    "Costo",
    "Moneda",
    "Fecha registro",
    "Usuario",
  ];
  const rows = filterDemoRows(filters).flatMap((r) =>
    (r.costos.length ? r.costos : [null]).map((c) => [
      r.numero_parte,
      r.propiedad_material,
      r.clasificacion,
      r.especificacion_material,
      r.unidad_empaque,
      r.unidad_medida,
      c?.vendedor || "",
      c?.costo ?? "",
      c?.moneda || "",
      r.fecha_registro,
      r.usuario_registro,
    ]),
  );
  saveDownload(
    new Blob(
      [
        "\ufeff" +
          [fields, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    "materiales_demostracion.csv",
  );
}
