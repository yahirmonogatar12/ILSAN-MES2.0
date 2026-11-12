import { ApiError } from "@/core/http";
import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import {
  OPERATION_SPECS,
  OUTPUT_SPECS,
  PLAN_SPECS,
  reportParams,
  rows,
  text,
  today,
} from "./model";
import type { Api, Filters, Kind, Row } from "./types";

let sequence = 20;
const store: Record<Kind, Row[]> = { ASSY: [], IMT: [], SMT: [] };
for (const kind of ["ASSY", "IMT", "SMT"] as const)
  for (let i = 1; i <= 12; i++)
    store[kind].push({
      id: i,
      lot_no: `${kind}-DEMO-${String(i).padStart(3, "0")}`,
      wo_code: `WO-DEMO-${i}`,
      po_code: `PO-DEMO-${i}`,
      working_date: today(),
      line:
        kind === "ASSY"
          ? i % 2
            ? "M1"
            : "M2"
          : kind === "SMT"
            ? i % 2
              ? "SA"
              : "SB"
            : i % 2
              ? "P1"
              : "P2",
      routing: 1,
      shift: "DIA",
      model_code: "MODELO DEMO",
      part_no: "EBR23966228",
      project: "PROYECTO DEMO",
      process: kind === "IMT" ? "IMD" : kind,
      ct: 3.6,
      uph: 1000,
      plan_count: 1000,
      produced: i === 1 ? 200 : 0,
      produced_count: i === 1 ? 200 : 0,
      input: i === 1 ? 200 : 0,
      output: kind === "ASSY" && i === 1 ? 100 : 0,
      entregadas_main: 0,
      group_no: (i % 2) + 1,
      sequence: Math.ceil(i / 2),
      status: i === 12 ? "CANCELADO" : "PLAN",
      assigned_bom_rev: "01",
      sub_assy: "MAIN",
      qr_required_count: 1,
      array_size: 1,
      lado: "",
      lote_padre: null,
    });
const workOrders: Row[] = [
  {
    id: 1,
    wo_code: "WO-DEMO-ASSY-01",
    codigo_wo: "WO-DEMO-ASSY-01",
    codigo_po: "PO-DEMO-01",
    modelo: "EBR23966228",
    cantidad_planeada: 300,
    fecha_operacion: today(),
    estado: "CREADA",
    ya_importado: false,
    lot_no_existente: null,
  },
];
let scanAvailable = true;
const select = (kind: Kind, filters: Filters) =>
  store[kind].filter(
    (row) =>
      text(row.working_date) >= filters.start &&
      text(row.working_date) <= filters.end,
  );
async function exportRows(
  name: string,
  specs: readonly (readonly [string, string, number])[],
  data: Row[],
) {
  await exportSpreadsheet(`${name}.xlsx`, [
    {
      name: "Consulta",
      rows: [
        specs.map((spec) => spec[1]),
        ...data.map((row) =>
          specs.map((spec) =>
            typeof row[spec[0]] === "number"
              ? (row[spec[0]] as number)
              : text(row[spec[0]]),
          ),
        ),
      ],
    },
  ]);
}
function create(kind: Kind, data: Row): Row {
  const lot = `${kind}-DEMO-${++sequence}`,
    row = {
      ...data,
      id: sequence,
      lot_no: lot,
      status: "PLAN",
      produced: 0,
      input: 0,
      produced_count: 0,
      output: 0,
      entregadas_main: 0,
      sequence: Number(data.sequence ?? store[kind].length + 1),
      group_no: Number(data.group_no ?? 1),
      ct: data.ct ?? 3.6,
      uph: data.uph ?? 1000,
      model_code: data.model_code ?? "MODELO DEMO",
      routing:
        data.turno === "NOCHE" ? 3 : data.turno === "TIEMPO EXTRA" ? 2 : 1,
    };
  store[kind].push(row);
  if (kind === "SMT" && data.lado === "BOTTOM") {
    const top = `${lot}-T`;
    store.SMT.push({
      ...row,
      id: ++sequence,
      lot_no: top,
      lado: "TOP",
      lote_padre: lot,
      qr_required_count: 0,
      sequence: Number(row.sequence) + 1,
    });
    return { success: true, lot_no: lot, lot_top: top };
  }
  return { success: true, lot_no: lot };
}
export const demoApi: Api = {
  async plans(kind, filters) {
    return structuredClone(select(kind, filters));
  },
  async pending(kind, filters) {
    return structuredClone(
      select(kind, filters).filter(
        (row) =>
          row.status !== "CANCELADO" &&
          Number(row.plan_count) >
            Number(row.produced_count ?? row.produced ?? 0),
      ),
    );
  },
  async action(kind, action, payload) {
    if (action === "create") return create(kind, payload);
    if (action === "order") {
      for (const value of rows(payload.sequences)) {
        const row = store[kind].find((row) => row.lot_no === value.lot_no);
        if (row) Object.assign(row, value);
      }
      return { success: true, updated_count: rows(payload.sequences).length };
    }
    if (action === "reschedule") {
      let created = 0;
      for (const lot of payload.lot_nos as string[]) {
        const row = store[kind].find((row) => row.lot_no === lot);
        if (!row) continue;
        const pending =
          Number(row.plan_count) -
          Number(row.produced_count ?? row.produced ?? 0);
        if (pending <= 0 || row.status === "CANCELADO") continue;
        const result = create(kind, {
          ...row,
          working_date: payload.new_working_date,
          plan_count: pending,
        });
        const child = store[kind].find(
          (item) => item.lot_no === result.lot_no,
        )!;
        child.lot_no = `${lot}-${++sequence}`;
        row.status = "TERMINADO";
        row.plan_count = Number(row.produced_count ?? row.produced ?? 0);
        created++;
      }
      return { success: true, created };
    }
    const row = store[kind].find((item) => item.lot_no === payload.lot_no);
    if (!row) throw new Error("Plan no encontrado.");
    if (
      kind === "ASSY" &&
      payload.status === "EN PROGRESO" &&
      store.ASSY.some(
        (item) =>
          item !== row &&
          item.line === row.line &&
          item.status === "EN PROGRESO",
      )
    )
      throw new ApiError("Ya existe un plan EN PROGRESO en esta línea.", 409);
    Object.assign(row, payload);
    return { success: true, lot_no: row.lot_no };
  },
  async revisions() {
    return [
      { bom_rev: "01", is_current: true, eco_no: "ECO-DEMO-01" },
      { bom_rev: "02", is_current: false, eco_no: "ECO-DEMO-02" },
    ];
  },
  async extra(name, payload) {
    if (name === "wos") return structuredClone(workOrders);
    if (name === "import-wos") {
      const plans: Row[] = [],
        errors: string[] = [];
      for (const id of payload.wo_ids as number[]) {
        const wo = workOrders.find((wo) => wo.id === id);
        if (!wo || wo.ya_importado) {
          errors.push(`WO ${id}: ya importada o no disponible.`);
          continue;
        }
        const result = create("ASSY", {
          working_date: payload.import_date,
          part_no: wo.modelo,
          wo_code: wo.wo_code,
          po_code: wo.codigo_po,
          plan_count: wo.cantidad_planeada,
          line: "M1",
        });
        wo.ya_importado = true;
        wo.lot_no_existente = result.lot_no;
        plans.push({ wo_code: wo.wo_code, lot_no: result.lot_no });
      }
      return { success: true, imported: plans.length, plans, errors };
    }
    if (name === "scan")
      return {
        success: true,
        scan_lots: scanAvailable
          ? [
              {
                linea: "M1",
                nparte: "EBR23966228",
                modelo: "MODELO DEMO",
                lotes_scan: 2,
                registros: 20,
                cantidad_total: 20,
                primero: `${today()} 08:00`,
                ultimo: `${today()} 09:00`,
              },
            ]
          : [],
        plan_options: structuredClone(store.ASSY),
      };
    if (name === "assign-scan") {
      const row = store.ASSY.find(
        (row) =>
          row.lot_no === payload.target_lot_no &&
          row.line === payload.linea &&
          row.part_no === payload.nparte,
      );
      if (!row || !scanAvailable)
        throw new Error("El grupo SCAN o el plan ya no están disponibles.");
      const pending = Number(row.plan_count) - Number(row.produced_count ?? 0);
      if (pending < 20 && !payload.allow_extend)
        throw new ApiError(
          "La cantidad SCAN excede el pendiente. Activa la extensión para continuar.",
          409,
        );
      if (pending < 20) row.plan_count = Number(row.produced_count ?? 0) + 20;
      row.produced_count = Number(row.produced_count ?? 0) + 20;
      row.input = row.produced_count;
      scanAvailable = false;
      return {
        success: true,
        message: "Grupo SCAN asignado.",
        updated_rows: 20,
      };
    }
    if (name === "create-scan") {
      if (!scanAvailable) throw new Error("No hay escaneos pendientes.");
      const value = create("ASSY", {
        line: payload.linea,
        part_no: payload.nparte,
        plan_count: 20,
        working_date: payload.working_date,
      });
      scanAvailable = false;
      return { ...value, message: "Plan creado con los escaneos asignados." };
    }
    if (name === "proposals")
      return [
        {
          proposal_id: "PROP-DEMO-ASSY",
          version: 1,
          date_from: today(),
          date_to: today(),
          status: "DRAFT",
          total_items: 2,
          total_qty: 1800,
          created_at: `${today()} 08:00`,
        },
      ];
    if (name === "diff") {
      const row = store.ASSY[0];
      return {
        success: true,
        proposal_id: payload.proposal_id,
        version: 1,
        fechas: [today()],
        sin_cambio: 0,
        cambios: [
          {
            lot_no: row.lot_no,
            part_no: row.part_no,
            antes: {
              cantidad: row.plan_count,
              linea: row.line,
              grupo: row.group_no,
              secuencia: row.sequence,
            },
            despues: {
              cantidad: 800,
              linea: row.line,
              grupo: row.group_no,
              secuencia: row.sequence,
            },
            campos: ["cantidad"],
            aplicables: ["cantidad"],
            bloqueado: null,
            razon: "Ajuste de demanda",
          },
        ],
        nuevos: [
          { part_no: "EBR30164704", linea: "M2", cantidad: 1000, grupo: 2 },
        ],
        sobran: [],
      };
    }
    if (name === "apply-diff") {
      let applied = 0;
      const omitted: Row[] = [];
      for (const change of rows(payload.cambios)) {
        const row = store.ASSY.find((row) => row.lot_no === change.lot_no);
        if (!row || Number(change.cantidad) < Number(row.produced_count ?? 0)) {
          omitted.push({
            lot_no: change.lot_no,
            motivo: "Cantidad menor a lo producido o lote no disponible.",
          });
          continue;
        }
        row.plan_count = change.cantidad;
        row.line = change.linea;
        row.group_no = change.grupo;
        row.sequence = change.secuencia;
        applied++;
      }
      return { success: true, aplicados: applied, omitidos: omitted };
    }
    return {
      ...create("ASSY", {
        working_date: today(),
        line: "M2",
        part_no: "EBR30164704",
        plan_count: 1000,
      }),
      insertados: 1,
      omitidos: [],
    };
  },
  async upload(kind, _file, date) {
    create(kind, {
      working_date: date,
      line: kind === "SMT" ? "SA" : "P1",
      part_no: "EBR23966228",
      plan_count: 1000,
      qr_required_count: 1,
      array_size: 1,
    });
    return {
      success: true,
      imported: 1,
      message:
        "Importación simulada. El archivo real lo analiza el servidor Flask.",
    };
  },
  async export(kind, data) {
    await exportRows(`plan_${kind}_demo`, PLAN_SPECS, data);
  },
  async report(kind, filters, searches) {
    reportParams(kind, filters, searches);
    if (kind === "operations") {
      const result = (["ASSY", "IMT", "SMT"] as const)
        .filter((process) => !filters.proceso || process === filters.proceso)
        .flatMap((process) =>
          select(process, filters).map((row) => ({
            proceso: process,
            fecha: row.working_date,
            linea: row.line,
            wo: row.wo_code,
            lote: row.lot_no,
            part_no: row.part_no,
            modelo: row.model_code,
            plan: row.plan_count,
            input: row.produced_count ?? row.produced ?? 0,
            output: process === "ASSY" ? row.output : "N/A",
            status: row.status,
          })),
        )
        .filter((row) =>
          Object.entries(searches).every(([key, value]) =>
            text((row as Row)[key])
              .toLowerCase()
              .includes(value.toLowerCase()),
          ),
        );
      return { rows: structuredClone(result), summary: {} };
    }
    const data = [
      {
        fecha: `${filters.start} a ${filters.end}`,
        part_number: "EBR23966228",
        product_model: "MODELO DEMO",
        lineas: "M1, M2",
        lotes: "ASSY-DEMO-001",
        produced_quantity: 1000,
        production_boxes: 10,
        oqc_quantity: 900,
        pending_oqc: 100,
        warehouse_quantity: 800,
        pending_warehouse: 100,
        oqc_statuses: "OK",
        estado: "Pendiente OQC",
      },
    ].filter((row) => row.part_number.includes(filters.part_number));
    return { rows: data, summary: data.length ? { ...data[0] } : {} };
  },
  async exportReport(kind, filters, searches) {
    const result = await this.report(kind, filters, searches);
    await exportRows(
      `${kind}_demo`,
      kind === "operations" ? OPERATION_SPECS : OUTPUT_SPECS,
      result.rows,
    );
  },
};
