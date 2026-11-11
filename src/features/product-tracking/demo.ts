import { exportSpreadsheet, spreadsheetEngine } from "@/shared/lib/spreadsheet";
import { stageNames, today, validateFile } from "./model";
import type {
  BatchResult,
  Filters,
  ListResult,
  Piece,
  TraceRow,
  TraceView,
} from "./types";

function empty<T>(items: T[], message = ""): ListResult<T> {
  return { items, message, fecha_hoy: today() };
}
function example(codigo: string, previous = false): Piece {
  const etapas = stageNames.map((etapa, index) => {
    const ok = index < 7 && !previous;
    const na = index >= 7;
    const fecha = ok
      ? today() + " " + String(index + 7).padStart(2, "0") + ":00:00"
      : "";
    return {
      etapa,
      ok,
      estado: ok ? "OK" : na ? "N/A" : "-",
      clase: ok ? "hecho" : na ? "na" : "pendiente",
      fecha,
      celda: fecha || (na ? "N/A" : "-"),
    };
  });
  return {
    codigo,
    qr: previous ? "" : "QA-PCB-0001",
    barcode: previous ? "0000000001" : codigo,
    barcode_anterior: previous ? "" : "0000000001",
    reemplazado_por: previous ? "0001/A+02&B" : "",
    sin_barcode: false,
    sin_qr: previous,
    reconstruido: previous,
    encontrado: true,
    en_exceso: false,
    estado_global: previous ? "Reemplazado por 0001/A+02&B" : "Packing QA",
    clase_global: previous ? "nd" : "hecho",
    registradas: previous ? 0 : 7,
    total: previous ? 9 : 12,
    ultima_etapa: previous ? "" : "Packing QA",
    ultima_fecha: previous ? "" : today() + " 13:00:00",
    etapas,
  };
}
export async function lookup(codigo: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const search = codigo.trim();
  const known = ["0001/A+02&B", "QA-PCB-0001", "0000000001"];
  const found = known.some(
    (code) =>
      code === search || (search.length >= 4 && code.startsWith(search)),
  );
  return empty(
    found ? [example("0001/A+02&B"), example("0000000001", true)] : [],
    found ? "" : "Sin historial para ese código.",
  );
}
async function workbookCodes(file: File, signal?: AbortSignal) {
  const issue = validateFile(file);
  if (issue) throw new Error(issue);
  const engine = await spreadsheetEngine();
  const book = engine.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
  });
  signal?.throwIfAborted();
  const values = book.SheetNames.flatMap((name) =>
    engine.utils
      .sheet_to_json<unknown[]>(book.Sheets[name], {
        header: 1,
        defval: "",
        raw: true,
      })
      .flat(),
  )
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return [...new Set(values)].slice(0, 5000);
}
export async function batch(
  file: File,
  signal?: AbortSignal,
): Promise<BatchResult> {
  const codes = await workbookCodes(file, signal);
  if (!codes.length) throw new Error("El archivo no tiene celdas con datos.");
  const items = await Promise.all(
    codes.map(async (codigo) => {
      const found = (await lookup(codigo, signal)).items[0];
      return found
        ? { ...found, codigo }
        : {
            ...example(codigo),
            codigo,
            qr: "",
            barcode: "",
            barcode_anterior: "",
            encontrado: false,
            estado_global: "No encontrado",
            clase_global: "pendiente",
            registradas: 0,
            ultima_etapa: "",
            ultima_fecha: "",
            etapas: stageNames.map((etapa) => ({
              etapa,
              ok: false,
              estado: "",
              clase: "pendiente",
              fecha: "",
              celda: "",
            })),
          };
    }),
  );
  const encontrados = items.filter((item) => item.encontrado).length;
  return {
    ...empty(items),
    etapas: stageNames,
    total: items.length,
    encontrados,
    no_encontrados: items.length - encontrados,
  };
}
const traceRows = (): TraceRow[] =>
  ["ASSY", "IMD", "SMT"].map((proceso, index) => ({
    proceso,
    input_main_id: proceso === "SMT" ? null : index + 1,
    pcb_serial: "QA-PCB-0001",
    ts: today() + " 08:00:00",
    lot_no: "LOT-QA-001",
    linea: proceso === "ASSY" ? "M1" : proceso === "IMD" ? "D1" : "SMT A",
    part_no: "EBR23966209",
    material_code: ["EAH61515501", "0RH1001C422", "EAE62406801"][index],
    numero_lote_material: "20261111B001!001",
    lote_proveedor: "20261111B001!001",
    codigo_material_recibido: "QA-MAT-" + index,
    posicion: ["D1", "R37", "C23"][index],
    spec: ["1SS355VM", "1K 1/10W", "102 1NF"][index],
    container_id: "MD-QA-" + index,
    refill_number: 0,
    cantidad_inicial: 2000,
    cantidad_consumida: 2000,
    cantidad_restante: 0,
    qty_per_pcb: 1,
    pcb_count: 2000,
    status: "COMPLETED",
    material_start_ts: today() + " 07:00:00",
    material_end_ts: today() + " 09:00:00",
    pcb_last_ts: today() + " 08:59:00",
  }));
export async function trace(
  view: TraceView,
  filters: Filters,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const items = traceRows().filter((row) => {
    if (filters.proceso && row.proceso !== filters.proceso) return false;
    const contains = (key: string, value: string) =>
      String(row[key] || "")
        .toLowerCase()
        .includes(value.toLowerCase());
    if (view === "por_pcb" && !contains("pcb_serial", filters.pcb || ""))
      return false;
    if (filters.lot_no && !contains("lot_no", filters.lot_no)) return false;
    if (filters.part_no && !contains("part_no", filters.part_no)) return false;
    if (filters.material) {
      const matches =
        view === "por_proveedor"
          ? [row.material_code, row.numero_lote_material].some((value) =>
              String(value).startsWith(filters.material),
            )
          : contains("material_code", filters.material) ||
            contains("numero_lote_material", filters.material);
      if (!matches) return false;
    }
    const date = String(row.ts).slice(0, 10);
    return (
      (!filters.fecha_inicio || date >= filters.fecha_inicio) &&
      (!filters.fecha_fin || date <= filters.fecha_fin)
    );
  });
  return empty(items);
}
export async function history(
  id: number,
  proceso: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  return empty<TraceRow>(
    id && proceso !== "SMT"
      ? [
          {
            fecha: today(),
            hora: "07:59:00",
            contenedor: "MD-QA-0",
            material: "EAH61515501",
            posicion: "D1",
            spec: "1SS355VM",
            qty: 2000,
            proveedor: "ROHM",
            lote_proveedor: "20261111B001!001",
            result: "OK",
          },
        ]
      : [],
  );
}
export async function exportLookup(codigo: string) {
  const data = await lookup(codigo);
  return exportSpreadsheet("production_tracking_demo.xlsx", [
    {
      name: "Production Tracking",
      rows: [
        [
          "QR",
          "Barcode",
          "Estado de la pieza",
          "Etapa",
          "Estado",
          "Fecha / hora",
        ],
        ...data.items.flatMap((item) =>
          item.etapas.map((stage) => [
            item.qr,
            item.barcode,
            item.estado_global,
            stage.etapa,
            stage.estado,
            stage.fecha,
          ]),
        ),
      ],
    },
  ]);
}
export async function exportBatch(file: File) {
  const data = await batch(file);
  return exportSpreadsheet("production_tracking_lote_demo.xlsx", [
    {
      name: "Tracking por lote",
      rows: [
        [
          "Código buscado",
          "QR",
          "Barcode",
          "Estado de la pieza",
          ...data.etapas,
        ],
        ...data.items.map((item) => [
          item.codigo,
          item.qr,
          item.barcode,
          item.estado_global,
          ...item.etapas.map((stage) => stage.celda),
        ]),
      ],
    },
  ]);
}
export async function exportTrace(view: TraceView, filters: Filters) {
  const data = await trace(view, filters);
  const keys = Object.keys(data.items[0] || {});
  return exportSpreadsheet("trazabilidad_pcb_demo.xlsx", [
    {
      name: "Trazabilidad",
      rows: [keys, ...data.items.map((row) => keys.map((key) => row[key]))],
    },
  ]);
}
