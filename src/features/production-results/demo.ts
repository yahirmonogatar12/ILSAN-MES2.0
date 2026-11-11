import { saveDownload } from "@/core/http";
import { exportSpreadsheet, spreadsheetEngine } from "@/shared/lib/spreadsheet";
import { number, object, text, today } from "./model";
import {
  excessHistory,
  excessInventory,
  finishedViews,
  inputHistory,
  repairViews,
} from "./views";
import type { Row, ViewSpec } from "./types";

const date = today();
const code = "0001/A+02&B";
const inventories: Row[] = Array.from({ length: 620 }, (_, index) => ({
  modelo: index % 2 ? "Raptor4 Basic" : "VT6M Basic",
  nparte: index === 0 ? code : "EBR" + String(24210000 + index),
  stock_total: index % 9 === 0 ? 0 : 100 + index,
  ubicaciones: index % 2 ? "M2, M3" : "SMT-A",
  ultima_entrada: date + " 08:12:00",
  ultima_salida: date + " 10:30:00",
  tipo_inventario: index % 2 ? "IMD" : "SMD",
  fecha: date,
  ubicacion: "M" + ((index % 3) + 1),
  cantidad: 100 + index,
  comentario: "Inventario demo",
  carro: "C-01",
  fecha_hora: date + " 10:30:00",
  tipo: index % 2 ? "SALIDA" : "ENTRADA",
}));
const movements: Row[] = Array.from({ length: 620 }, (_, index) => ({
  inventory_date: date,
  hora: "08:12:00",
  fecha_hora: date + " 08:12:00",
  tipo_movimiento: index % 4 === 0 ? "SALIDA" : "ENTRADA",
  scanned_original: code + "-" + String(index).padStart(5, "0"),
  pcb_part_no: index === 0 ? code : "EBR24212304",
  modelo: "Raptor4 Basic",
  proceso: "SMD",
  defect_type: "Soldadura insuficiente",
  component_location: "R37",
  etapa_deteccion: "AOI",
  qty: 1,
  array_count: 2,
  scanned_by: "Demo",
  comentarios: "Revisión de soldadura",
  linea_salida_pcb: "ASSY-01",
}));
let excess: Row[] = [
  {
    part_number: code,
    product_model: "Raptor4 Basic",
    customer: "LG",
    initial_quantity: 200,
    entries_qty: 12,
    exits_qty: 2,
    current_quantity: 210,
  },
  {
    part_number: "EBR24212304",
    product_model: "VT6M Basic",
    customer: "LG",
    initial_quantity: 100,
    entries_qty: 5,
    exits_qty: 0,
    current_quantity: 105,
  },
];
let history: Row[] = [];
let nextBatch = 1;
const batches = new Map<number, { batch: Row; payload: Row }>();
function metadata(): Row {
  return {
    closureLabel: "Cierre Exceso QA " + date.slice(0, 7),
    closureMonth: date.slice(0, 7),
    closureDateTime: date + " 12:00:00",
    closureUser: "Demo",
  };
}
function preview(quantities: Map<string, number> = new Map()): Row {
  const rows = excess.map((row) => {
    const physical = quantities.get(text(row.part_number)) ?? null;
    const difference =
      physical === null ? null : physical - number(row.current_quantity);
    return {
      ...row,
      system_quantity: row.current_quantity,
      physical_quantity: physical,
      difference_quantity: difference,
      initial_quantity: physical,
      status:
        physical === null
          ? "pendiente"
          : difference === 0
            ? "igual"
            : "diferencia",
    };
  });
  const system = rows.reduce(
    (sum, row) => sum + number(row.system_quantity),
    0,
  );
  const physical = rows.reduce(
    (sum, row) => sum + number(row.physical_quantity),
    0,
  );
  const difference = rows.reduce(
    (sum, row) => sum + Math.abs(number(row.difference_quantity)),
    0,
  );
  return {
    rows,
    summary: {
      totalRows: rows.length,
      systemQuantity: system,
      physicalQuantity: physical,
      absoluteDifference: difference,
      matchingRows: rows.filter((row) => row.status === "igual").length,
      accuracyPct: quantities.size
        ? Math.max(0, 100 * (1 - difference / Math.max(1, system)))
        : 0,
    },
  };
}
function includes(value: unknown, criterion: string | null): boolean {
  return (
    !criterion ||
    text(value).toLocaleLowerCase().includes(criterion.toLocaleLowerCase())
  );
}
function filtered(rows: Row[], spec: ViewSpec, params: URLSearchParams): Row[] {
  return rows.filter((row) => {
    for (const column of spec.columns) {
      if (!includes(row[column.key], params.get("cf_" + column.key)))
        return false;
    }
    const q =
      params.get("q") || params.get("search") || params.get("numero_parte");
    if (q && !Object.values(row).some((value) => includes(value, q)))
      return false;
    for (const key of [
      "linea",
      "qr",
      "barcode",
      "lote",
      "proceso",
      "tipo",
      "tipo_movimiento",
      "ubicacion",
      "carro",
    ]) {
      if (!includes(row[key], params.get(key))) return false;
    }
    if (params.get("stock") === ">0" && number(row.stock_total) <= 0)
      return false;
    if (params.get("stock") === "=0" && number(row.stock_total) !== 0)
      return false;
    if (
      spec.id.endsWith("-stock") &&
      params.get("include_zero") !== "1" &&
      number(row.stock_actual) === 0
    )
      return false;
    const from =
      params.get("fecha_desde") ||
      params.get("fecha_inicio") ||
      params.get("desde");
    const to =
      params.get("fecha_hasta") ||
      params.get("fecha_fin") ||
      params.get("hasta");
    const rowDate = text(
      row.fecha || row.inventory_date || row.fecha_hora,
    ).slice(0, 10);
    if ((from && rowDate && rowDate < from) || (to && rowDate && rowDate > to))
      return false;
    if (params.get("hora_desde") && text(row.hora) < params.get("hora_desde")!)
      return false;
    if (
      params.get("hora_hasta") &&
      text(row.hora) >
        params.get("hora_hasta")! +
          (params.get("hora_hasta")!.length === 5 ? ":59" : "")
    )
      return false;
    return true;
  });
}
function report(
  path: string,
  params: URLSearchParams,
): { spec: ViewSpec; rows: Row[] } {
  const input = ["smt", "imd", "ensamble", "display"]
    .map((kind) => inputHistory(kind as "smt" | "imd" | "ensamble" | "display"))
    .find((spec) => spec.path === path);
  if (input)
    return {
      spec: input,
      rows: filtered(
        Array.from({ length: 640 }, (_, index) => ({
          numero: index + 1,
          linea: index % 2 ? "M2" : "SMT A",
          fecha: date,
          hora: "08:12:00",
          qr: code + "-" + String(index).padStart(5, "0"),
          barcode: "001-DISPLAY/" + index,
          lote: "SMT-261111-001",
        })),
        input,
        params,
      ),
    };
  const repair = [...repairViews("smd"), ...repairViews("assy")].find(
    (spec) => spec.path === path,
  );
  if (repair) {
    let rows: Row[] = movements.map((row) => ({
      ...row,
      proceso: repair.id.startsWith("assy") ? "ASSY" : "SMD",
    }));
    if (repair.id.endsWith("-stock"))
      rows = [
        {
          pcb_part_no: code,
          modelo: "Raptor4 Basic",
          proceso: repair.id.startsWith("assy") ? "ASSY" : "SMD",
          total_entrada: 20,
          total_salida: 5,
          total_scrap: 1,
          stock_actual: 14,
        },
        {
          pcb_part_no: "EBR24212304",
          modelo: "VT6M Basic",
          proceso: repair.id.startsWith("assy") ? "ASSY" : "SMD",
          total_entrada: 5,
          total_salida: 5,
          total_scrap: 0,
          stock_actual: 0,
        },
      ];
    if (repair.id.endsWith("-defectos"))
      rows = [
        {
          defect_type: "Soldadura insuficiente",
          etapa_deteccion: "AOI",
          registros: 20,
          qty_total: 20,
        },
      ];
    return { spec: repair, rows: filtered(rows, repair, params) };
  }
  const index = finishedViews.findIndex((spec) => spec.path === path);
  if (index >= 0 || path.startsWith("/api/snapshot_inventario/")) {
    const spec =
      finishedViews[index >= 0 ? index : path.endsWith("general") ? 0 : 1];
    return {
      spec,
      rows: filtered(
        inventories.map((row) =>
          params.has("fecha")
            ? {
                ...row,
                fecha: params.get("fecha"),
                stock_total: 50,
                cantidad: 50,
              }
            : row,
        ),
        spec,
        params,
      ),
    };
  }
  if (path === excessInventory.path)
    return {
      spec: excessInventory,
      rows: filtered(excess, excessInventory, params),
    };
  const spec = path.endsWith("entradas")
    ? excessHistory("entradas")
    : excessHistory("salidas");
  const rows: Row[] = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    fecha: date,
    hora: "08:12:00",
    part_number: code,
    scan_code: code + "-" + index,
    product_model: "Raptor4 Basic",
    registered_by: "Demo",
    quantity: 1,
    box_code: "BOX-0001",
    oqc_folio: "OQC-0001",
  }));
  return { spec, rows: filtered(rows, spec, params) };
}
export async function demoRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const url = new URL(path, "http://demo");
  const pathname = url.pathname;
  if (
    /^\/api\/(ict|fct|vision)\//.test(pathname) ||
    /historial_(operadores_maquina|prueba_electrica)/.test(pathname)
  ) {
    const { machineRequest } = await import("./machineDemo");
    return machineRequest(path);
  }
  if (pathname === "/api/snapshot_inventario/fechas")
    return { fechas: [{ fecha: date, hora: "07:30" }] };
  if (pathname.endsWith("/exits/sync")) return { success: true };
  if (pathname.endsWith("/cierre/bootstrap"))
    return {
      success: true,
      valid: false,
      metadata: metadata(),
      preview: preview(),
      history,
    };
  if (pathname.endsWith("/cierre/preview")) {
    const form = init?.body as FormData;
    const file = form.get("closure_file") as File;
    const engine = await spreadsheetEngine();
    const book = engine.read(await file.arrayBuffer(), { type: "array" });
    const cells = engine.utils.sheet_to_json<string[]>(
      book.Sheets[book.SheetNames[0]],
      { header: 1, raw: false, defval: "" },
    );
    const headers = (cells.shift() ?? []).map((header) =>
      header.trim().toLowerCase(),
    );
    const quantities = new Map<string, number>();
    const errors: string[] = [];
    if (headers.length === 1 && ["barcode", "scan_code"].includes(headers[0])) {
      for (const row of excess) quantities.set(text(row.part_number), 0);
      for (const row of cells) {
        if (row.every((value) => !text(value).trim())) continue;
        const part = excess
          .map((item) => text(item.part_number))
          .sort((a, b) => b.length - a.length)
          .find((part) => text(row[0]).startsWith(part));
        if (part) quantities.set(part, (quantities.get(part) ?? 0) + 1);
        else errors.push("Barcode fuera del inventario activo.");
      }
    } else if (
      headers.length === 2 &&
      headers.includes("part_number") &&
      headers.includes("current_qty")
    ) {
      for (const row of cells) {
        if (row.every((value) => !text(value).trim())) continue;
        const part = text(row[headers.indexOf("part_number")]).trim();
        const raw = text(row[headers.indexOf("current_qty")]).trim();
        if (
          !part ||
          !/^\d+$/.test(raw) ||
          quantities.has(part) ||
          !excess.some((item) => item.part_number === part)
        )
          errors.push("Parte duplicada, desconocida o cantidad inválida.");
        else quantities.set(part, Number(raw));
      }
      if (quantities.size !== excess.length)
        errors.push("Faltan partes del inventario activo.");
    } else
      errors.push(
        "El CSV debe contener BARCODE o las columnas part_number y current_qty.",
      );
    const payload = {
      metadata: metadata(),
      preview: preview(quantities),
      errors,
    };
    const batchId = errors.length ? null : nextBatch++;
    if (batchId) {
      const summary = object(payload.preview).summary;
      const batch = {
        id: batchId,
        closure_label: metadata().closureLabel,
        closure_month: date.slice(0, 7),
        created_at: date + " 12:00:00",
        created_by: "Demo",
        status: "pending",
        summary,
      };
      batches.set(batchId, { batch, payload });
      history = [batch, ...history];
    }
    return { ...payload, history, batchId, valid: errors.length === 0 };
  }
  if (pathname.endsWith("/cierre/confirm")) {
    const batchId = number(JSON.parse(text(init?.body)).batchId);
    const entry = batches.get(batchId);
    if (!entry) throw new Error("El cierre no existe.");
    if (entry.batch.status !== "confirmed") {
      const previewRows = object(entry.payload.preview).rows as Row[];
      excess = previewRows.map((row) => ({
        ...row,
        initial_quantity: row.physical_quantity,
        entries_qty: 0,
        exits_qty: 0,
        current_quantity: row.physical_quantity,
      }));
      entry.batch.status = "confirmed";
      entry.batch.confirmed_by = "Demo";
      entry.batch.closed_at = date + " 12:00:00";
    }
    return {
      success: true,
      message: "Cierre confirmado en demostración.",
      history,
    };
  }
  const match = pathname.match(/\/cierre\/history\/(\d+)$/);
  if (match) {
    const data = batches.get(Number(match[1]));
    if (!data) throw new Error("Cierre no encontrado.");
    return { success: true, ...data };
  }
  const result = report(pathname, url.searchParams);
  if (result.spec.remote) {
    const perPage = Number(url.searchParams.get("per_page")) || 500;
    const page = Math.min(
      Number(url.searchParams.get("page")) || 1,
      Math.max(1, Math.ceil(result.rows.length / perPage)),
    );
    return {
      rows: result.rows
        .slice((page - 1) * perPage, page * perPage)
        .map((row, index) => ({
          ...row,
          numero: (page - 1) * perPage + index + 1,
        })),
      total: result.rows.length,
      page,
      per_page: perPage,
    };
  }
  return pathname.endsWith("/entradas") || pathname.endsWith("/salidas")
    ? result.rows
    : { status: "success", items: result.rows };
}
export async function demoDownload(path: string, filename: string) {
  if (
    /^\/api\/(ict|fct|vision)\//.test(path) ||
    /historial_(operadores_maquina|prueba_electrica)/.test(path)
  ) {
    const { machineDownload } = await import("./machineDemo");
    return machineDownload(path, filename);
  }
  if (filename.endsWith(".csv")) {
    const match = path.match(/\/history\/(\d+)\/export/);
    const rows = match
      ? (object(batches.get(Number(match[1]))?.payload.preview).rows as Row[])
      : excess;
    const csv = match
      ? [
          "part_number,system_quantity,physical_quantity,difference_quantity",
          ...rows.map((row) =>
            [
              row.part_number,
              row.system_quantity,
              row.physical_quantity,
              row.difference_quantity,
            ].join(","),
          ),
        ]
      : [
          "part_number,current_qty",
          ...rows.map((row) =>
            [row.part_number, row.current_quantity].join(","),
          ),
        ];
    saveDownload(
      new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8" }),
      filename,
    );
    return;
  }
  const url = new URL(path, "http://demo");
  const result = report(
    url.pathname.replace(/\/export$/, ""),
    url.searchParams,
  );
  const perPage = Number(url.searchParams.get("per_page")) || 500;
  const page = Number(url.searchParams.get("page")) || 1;
  const rows: Row[] = result.spec.remote
    ? result.rows
        .slice((page - 1) * perPage, page * perPage)
        .map((row, index) => ({
          ...row,
          numero: (page - 1) * perPage + index + 1,
        }))
    : result.rows;
  return exportSpreadsheet(filename, [
    {
      name: "Reporte",
      rows: [
        result.spec.columns.map((column) => column.title),
        ...rows.map((row) =>
          result.spec.columns.map((column) =>
            column.numeric ? number(row[column.key]) : text(row[column.key]),
          ),
        ),
      ],
    },
  ]);
}
