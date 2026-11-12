import { ApiError } from "@/core/http";
import { exportSpreadsheet } from "@/shared/lib/spreadsheet";
import {
  dayAfter,
  pivotParams,
  rows,
  text,
  today,
  TURNOS,
  week,
  WO_SPECS,
} from "./model";
import type { Action, OrderFilters, PlanningApi, Row, Upload } from "./types";
let sequence = 10,
  revision = 0;
let activeLines = ["M1", "M2", "M3"];
const po: Row[] = [
  {
    codigo_po: "PO-261106-0001",
    nombre_po: "PO de demostración",
    fecha_registro: today(),
    modelo: "EBR23966228-01-A",
    nombre_modelo: "MODELO DEMO",
    cliente: "LG_REFRIS",
    proveedor: "LG",
    total_cantidad_entregada: 1000,
    cantidad_entregada: 0,
    estado: "PLAN",
    codigo_entrega: "",
    fecha_entrega: today(),
    usuario_creacion: "demo",
    modificado: `${today()} 08:00:00`,
  },
];
const wo: Row[] = [
  {
    id: 1,
    codigo_wo: "WO-261106-0001",
    codigo_po: po[0].codigo_po,
    modelo: "EBR23966228-01-A",
    codigo_modelo: "EBR23966228-01-A",
    nombre_modelo: "MODELO DEMO",
    cantidad_planeada: 1000,
    fecha_operacion: today(),
    linea: "M1",
    estado: "CREADA",
    modificador: "demo",
    fecha_modificacion: `${today()} 08:00:00`,
  },
  {
    id: 2,
    codigo_wo: "WO-261106-0002",
    codigo_po: "SIN-PO",
    modelo: "0001-A",
    codigo_modelo: "0001-A",
    nombre_modelo: "MODELO CON CERO",
    cantidad_planeada: 500,
    fecha_operacion: today(),
    linea: "M2",
    estado: "PLANIFICADA",
    modificador: "demo",
    fecha_modificacion: `${today()} 08:00:00`,
  },
];
const inventory = new Map<string, Row>(),
  schedule = new Map<string, number>(),
  lots = new Map<string, Row[]>(),
  proposals = new Map<string, Row>();
const imports: Row[] = [];
const previews = new Map<string, Upload>();

function matches(row: Row, filters: OrderFilters, dateKey: string) {
  const date = text(row[dateKey]).slice(0, 10);
  return (
    (!filters.fecha_desde || date >= filters.fecha_desde) &&
    (!filters.fecha_hasta || date <= filters.fecha_hasta) &&
    (!filters.estado || row.estado === filters.estado) &&
    (!filters.cliente || row.cliente === filters.cliente) &&
    (!filters.modelo || text(row.modelo).includes(filters.modelo))
  );
}
function seedLot(date: string, id: number, part = "EBR23966228-01-A"): Row {
  return {
    id,
    plan_date: date,
    lot_no: null,
    part_no: part,
    model: "MODELO DEMO",
    main_sub: "MAIN",
    linea: activeLines[0] ?? "",
    turno: "DIA",
    faltante: 500,
    qty_plan: 500,
    uph: 1000,
    estandar_pack: 100,
    fisico: null,
    comentario: "",
    status: "PENDIENTE",
  };
}
function getLots(date: string) {
  if (!lots.has(date)) lots.set(date, [seedLot(date, ++sequence)]);
  return lots.get(date)!;
}
function lotResult(date: string): Row {
  const records = getLots(date)
    .filter((row) => row.status !== "CANCELADO")
    .map((row): Row => ({
      ...row,
      time_horas: Number(row.qty_plan) / Number(row.uph),
      falta:
        row.fisico == null ? null : Number(row.fisico) - Number(row.qty_plan),
      pct:
        row.fisico == null
          ? null
          : (Number(row.fisico) * 100) / Number(row.qty_plan),
      warn_pack: Number(row.qty_plan) % Number(row.estandar_pack) !== 0,
    }));
  const summary: Row[] = [];
  for (const row of records) {
    const key = text(row.linea) || "SIN LINEA";
    let line = summary.find((item) => item.linea === key);
    if (!line) {
      line = { linea: key, horas: 0, lotes: 0, horas_max: 9 };
      summary.push(line);
    }
    line.horas = Number(line.horas) + Number(row.time_horas);
    line.lotes = Number(line.lotes) + 1;
    line.excede = key !== "SIN LINEA" && Number(line.horas) > 9;
  }
  return structuredClone({
    fecha: date,
    lotes: records,
    lineas: summary,
    lineas_activas: activeLines,
  });
}
function findWO(code: unknown) {
  const row = wo.find((row) => row.codigo_wo === code);
  if (!row) throw new Error("WO no encontrada.");
  return row;
}
function findLot(id: unknown) {
  for (const records of lots.values()) {
    const row = records.find((row) => row.id === Number(id));
    if (row) return row;
  }
  throw new Error("Lote no encontrado.");
}
function positive(value: unknown) {
  if (!Number.isInteger(Number(value)) || Number(value) <= 0)
    throw new Error("La cantidad debe ser un entero positivo.");
  return Number(value);
}
export const demoPlanningApi: PlanningApi = {
  async orders(kind, filters, signal) {
    signal?.throwIfAborted();
    return structuredClone(
      (kind === "po" ? po : wo).filter((row) =>
        matches(
          row,
          filters,
          kind === "po" ? "fecha_registro" : "fecha_operacion",
        ),
      ),
    );
  },
  async models(signal) {
    signal?.throwIfAborted();
    return ["EBR23966228-01-A", "0001-A", "EBR43713702_I"];
  },
  async pivot(filters, page, size, signal) {
    pivotParams(filters);
    signal?.throwIfAborted();
    const dates: string[] = [];
    for (
      let date = filters.date_from;
      date <= filters.date_to;
      date = dayAfter(date, 1)
    )
      dates.push(date);
    const all: Row[] = Array.from({ length: 1101 }, (_, index) => {
      const part =
        index === 0
          ? "EBR23966228-01-A"
          : `EBR-DEMO-${String(index + 1).padStart(4, "0")}-A`;
      const inv = inventory.get(part) ?? {
        lgemm: index % 3 === 0 ? 100 : 900,
        isemm: 0,
        svc: 0,
        dif: 0,
        pendiente: 0,
        rework: 0,
        smt: 0,
        imd: 0,
        line: activeLines[index % Math.max(1, activeLines.length)] ?? "",
        ref_date: week().date_from,
      };
      const i0 = ["lgemm", "isemm", "svc", "dif", "pendiente", "rework"].reduce(
        (sum, key) => sum + Number(inv[key] ?? 0),
        0,
      );
      let carry = i0;
      const qty: Row = {},
        sched: Row = {},
        proj: Row = {};
      for (const date of dates) {
        qty[date] = 50;
        sched[date] = schedule.get(`${part}|${date}`) ?? 0;
        carry = carry - 50 + Number(sched[date]);
        proj[date] = carry;
      }
      return {
        part_no: part,
        total: dates.length * 50,
        qty,
        req_lg: 350,
        sched,
        sched_total: Object.values(sched).reduce(
          (sum: number, v) => sum + Number(v),
          0,
        ),
        inv: { ...inv, i0 },
        proj,
      };
    }).filter(
      (row) =>
        (!filters.part ||
          text(row.part_no)
            .toLowerCase()
            .includes(filters.part.toLowerCase())) &&
        (!filters.only_shortage ||
          Object.entries(row.proj as Row).some(
            ([date, value]) => date >= today() && Number(value) < 0,
          )),
    );
    return structuredClone({
      dates,
      rows: all.slice((page - 1) * size, page * size),
      total_parts: all.length,
      page,
      page_size: size,
      date_from: filters.date_from,
      date_to: filters.date_to,
    });
  },
  async lots(date, signal) {
    signal?.throwIfAborted();
    return lotResult(date);
  },
  async history(signal) {
    signal?.throwIfAborted();
    return structuredClone(imports);
  },
  async action(action: Action, data: Row) {
    if (action === "create-po") {
      if (!text(data.nombre_po) || !text(data.modelo) || !text(data.cliente))
        throw new Error("Completa los datos de la PO.");
      const code = `PO-${today().slice(2).replaceAll("-", "")}-${String(++sequence).padStart(4, "0")}`;
      po.unshift({
        ...data,
        codigo_po: code,
        estado: "PLAN",
        usuario_creacion: "demo",
        modificado: `${today()} 10:00:00`,
      });
      return {
        success: true,
        message: `PO ${code} creada.`,
        data: { codigo_po: code },
      };
    }
    if (action === "create-wo") {
      positive(data.cantidad_planeada);
      const code =
        text(data.codigo_wo) ||
        `WO-${today().slice(2).replaceAll("-", "")}-${String(++sequence).padStart(4, "0")}`;
      if (wo.some((row) => row.codigo_wo === code))
        throw new Error("La WO ya existe.");
      wo.unshift({
        ...data,
        id: ++sequence,
        codigo_wo: code,
        codigo_modelo: data.modelo,
        nombre_modelo: "MODELO DEMO",
        linea: activeLines[0],
        estado: "CREADA",
        modificador: "demo",
        fecha_modificacion: `${today()} 10:00:00`,
      });
      return { ok: true, codigo_wo: code, message: `WO ${code} creada.` };
    }
    if (["update-wo", "delete-wo", "state-wo", "link-wo"].includes(action)) {
      const row = findWO(data.codigo_wo);
      if (
        ["update-wo", "delete-wo"].includes(action) &&
        row.estado !== "CREADA"
      )
        throw new Error("Solo se permite modificar WOs en estado CREADA.");
      if (action === "delete-wo") wo.splice(wo.indexOf(row), 1);
      else if (action === "update-wo") {
        positive(data.cantidad_planeada);
        Object.assign(row, {
          modelo: data.modelo,
          codigo_modelo: data.modelo,
          cantidad_planeada: Number(data.cantidad_planeada),
          codigo_po: data.codigo_po,
        });
      } else if (action === "link-wo") row.codigo_po = data.codigo_po;
      else {
        if (
          !["CREADA", "PLANIFICADA", "EN_PRODUCCION", "CERRADA"].includes(
            text(data.estado),
          )
        )
          throw new Error("Estado no válido.");
        row.estado = data.estado;
      }
      return { success: true, message: "WO actualizada." };
    }
    if (action === "import-wos") {
      const errors: string[] = [],
        plans: Row[] = [];
      for (const id of Array.isArray(data.wo_ids) ? data.wo_ids : []) {
        const row = wo.find((row) => row.id === id);
        if (!row || row.estado !== "CREADA") {
          errors.push(`WO ${id}: ya planificada o no disponible.`);
          continue;
        }
        row.estado = "PLANIFICADA";
        plans.push({
          wo_code: row.codigo_wo,
          lot_no: `DEMO-LOT-${++sequence}`,
        });
      }
      return { success: true, imported: plans.length, plans, errors };
    }
    if (action === "inventory-field") {
      const part = text(data.part_no),
        current = inventory.get(part) ?? {
          lgemm: 100,
          isemm: 0,
          svc: 0,
          dif: 0,
          pendiente: 0,
          rework: 0,
          smt: 0,
          imd: 0,
          line: activeLines[0],
          ref_date: week().date_from,
        };
      current[text(data.field)] = Number(data.value);
      inventory.set(part, current);
      revision++;
      return { success: true, message: "Inventario actualizado." };
    }
    if (action === "schedule") {
      const key = `${text(data.part_no)}|${text(data.sched_date)}`;
      if (data.sched_qty === null || Number(data.sched_qty) <= 0)
        schedule.delete(key);
      else {
        if (!activeLines.includes(text(data.linea)))
          throw new Error("Selecciona una línea activa.");
        schedule.set(key, positive(data.sched_qty));
      }
      revision++;
      return { success: true, message: "Schedule actualizado." };
    }
    if (action === "propose") {
      const date =
          text(data.date_from) < today() ? today() : text(data.date_from),
        id = `DEMO-PROP-${++sequence}`,
        part = "EBR23966228-01-A",
        qty = 500;
      const items = [
        {
          item_id: `ITEM-${sequence}`,
          prioridad: 1,
          part_no: part,
          sched_date: date,
          linea: activeLines[0],
          turno: "DIA",
          qty,
          pack_size: 100,
          ct: 3.6,
          uph: 1000,
          horas_requeridas: 0.5,
          inventario_antes: -100,
          inventario_despues: 400,
          fecha_shortage: date,
          sched_actual: schedule.get(`${part}|${date}`) ?? 0,
          excepciones: [],
        },
      ];
      const result = {
        proposal_id: id,
        version: 1,
        engine_version: "demo",
        date_from: date,
        date_to: data.date_to,
        proposals: items,
        total_qty: qty,
        omitidas: [],
        omitidas_count: 0,
        line_summary: [
          {
            fecha: date,
            linea: activeLines[0],
            turno: "DIA",
            horas: 0.5,
            horas_max: 9,
            lotes: 1,
            cantidad: qty,
          },
        ],
        requires_approval_count: 0,
        schedule_changes: [
          {
            accion: "AGREGAR",
            part_no: part,
            sched_date: date,
            antes_qty: 0,
            despues_qty: qty,
            antes_linea: null,
            despues_linea: activeLines[0],
            turno: "DIA",
          },
        ],
      };
      proposals.set(id, {
        ...structuredClone(result),
        revision,
        status: "PENDING",
      });
      return structuredClone(result);
    }
    if (action === "apply-proposal" || action === "reject-proposal") {
      const proposal = proposals.get(text(data.proposal_id));
      if (!proposal) throw new Error("Propuesta no encontrada.");
      if (proposal.status === "APPLIED")
        return { success: true, already_applied: true, aplicadas: 0 };
      if (
        proposal.revision !== revision ||
        data.version !== proposal.version ||
        proposal.status !== "PENDING"
      )
        throw new ApiError(
          "La propuesta quedó desactualizada. Genera una nueva.",
          409,
        );
      if (action === "reject-proposal") {
        if (!text(data.reason_text).trim())
          throw new Error("Captura el motivo del rechazo.");
        proposal.status = "REJECTED";
        return { success: true, message: "Propuesta rechazada." };
      }
      const items = rows(data.items).filter((item) => item.included !== false);
      for (const item of items) {
        if (!activeLines.includes(text(item.linea)))
          throw new Error("Línea no válida.");
        schedule.set(
          `${text(item.part_no ?? rows(proposal.proposals).find((original) => original.item_id === item.item_id)?.part_no)}|${text(item.sched_date)}`,
          positive(item.qty),
        );
      }
      proposal.status = "APPLIED";
      revision++;
      return {
        success: true,
        aplicadas: items.length,
        total_qty: items.reduce((sum, item) => sum + Number(item.qty), 0),
      };
    }
    if (action === "config-lines") {
      activeLines = (
        Array.isArray(data.lineas)
          ? data.lineas.map(text)
          : text(data.lineas).split(",")
      )
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      if (!activeLines.length)
        throw new Error("Selecciona al menos una línea.");
      return {
        success: true,
        lineas_activas: activeLines,
        message: "Líneas guardadas.",
      };
    }
    if (
      ["generate", "generate-faltantes", "generate-schedule"].includes(action)
    ) {
      const date = text(data.fecha) || today(),
        old = getLots(date).filter((row) => row.status === "CONFIRMADO"),
        next = seedLot(date, ++sequence);
      if (action !== "generate") next.linea = null;
      lots.set(date, [...old, next]);
      return {
        ...lotResult(date),
        generados: 1,
        warnings: [
          "Simulación de la generación; las reglas reales se ejecutan en el servidor.",
        ],
      };
    }
    if (action === "acomodar-ia") {
      const date = text(data.fecha) || today();
      let count = 0;
      for (const row of getLots(date))
        if (row.status === "PENDIENTE" && !row.linea) {
          row.linea = activeLines[0];
          count++;
        }
      return {
        ...lotResult(date),
        asignados: count,
        sin_asignar: 0,
        metodo: "demo",
      };
    }
    if (action === "add-lot") {
      const date = text(data.fecha) || today(),
        row = seedLot(date, ++sequence, text(data.part_no));
      row.qty_plan = positive(data.qty);
      if (data.linea) row.linea = data.linea;
      getLots(date).push(row);
      return lotResult(date);
    }
    if (action === "update-lot") {
      const row = findLot(data.id),
        field = text(data.field);
      if (
        row.status === "CONFIRMADO" &&
        !["fisico", "comentario"].includes(field)
      )
        throw new Error(
          "Lote confirmado: solo físico y comentario son editables.",
        );
      if (
        !["qty_plan", "linea", "turno", "fisico", "comentario"].includes(field)
      )
        throw new Error("Campo inválido.");
      if (field === "qty_plan") positive(data.value);
      if (
        field === "turno" &&
        !TURNOS.includes(text(data.value) as (typeof TURNOS)[number])
      )
        throw new Error("Turno no válido.");
      row[field] = data.value;
      return lotResult(text(row.plan_date));
    }
    if (action === "delete-lot") {
      const row = findLot(data.id),
        date = text(row.plan_date);
      if (row.status === "CONFIRMADO") {
        row.status = "CANCELADO";
        const key = `${text(row.part_no)}|${date}`;
        schedule.set(
          key,
          Math.max(0, (schedule.get(key) ?? 0) - Number(row.qty_plan)),
        );
        revision++;
      } else
        lots.set(
          date,
          getLots(date).filter((item) => item !== row),
        );
      return lotResult(date);
    }
    if (action === "confirm-lots") {
      const date = text(data.fecha) || today(),
        result = lotResult(date);
      if (rows(result.lineas).some((row) => row.excede))
        throw new Error(
          "Las líneas exceden su capacidad. Ajusta las cantidades.",
        );
      let count = 0;
      for (const row of getLots(date))
        if (row.status === "PENDIENTE") {
          row.status = "CONFIRMADO";
          row.lot_no = `I${date.replaceAll("-", "")}-${String(++sequence).padStart(4, "0")}`;
          const key = `${text(row.part_no)}|${date}`;
          schedule.set(key, (schedule.get(key) ?? 0) + Number(row.qty_plan));
          count++;
        }
      if (!count) throw new Error("No hay lotes pendientes.");
      revision++;
      return { ...lotResult(date), confirmados: count };
    }
    throw new Error("Operación no disponible en demostración.");
  },
  async upload(action, upload, signal) {
    signal?.throwIfAborted();
    if (action === "preview-lg") {
      const token = `DEMO-HASH-${++sequence}`;
      previews.set(token, upload);
      return {
        success: true,
        file_sha256: token,
        file: { name: upload.file.name },
        summary: {
          plan_year: upload.plan_year || today().slice(0, 4),
          date_from: week().date_from,
          date_to: week().date_to,
          parts_count: 1,
          dates_count: 7,
          records_count: 7,
          zero_records_count: 0,
        },
        sample_rows: [
          { part_no: "EBR23966228-01-A", plan_date: today(), plan_qty: 50 },
        ],
        warnings: [
          "Vista previa de demostración. El Excel real se analiza en el servidor.",
        ],
      };
    }
    if (action === "confirm-lg") {
      const preview = previews.get(upload.file_sha256 ?? "");
      if (
        !preview ||
        preview.file !== upload.file ||
        preview.plan_year !== upload.plan_year
      )
        throw new Error("El archivo cambió desde la vista previa.");
      imports.unshift({
        id: ++sequence,
        original_filename: upload.file.name,
        plan_year: upload.plan_year || today().slice(0, 4),
        imported_at: `${today()} 10:00:00`,
        date_from: week().date_from,
        date_to: week().date_to,
        parts_count: 1,
        dates_count: 7,
        records_count: 7,
        zero_records_count: 0,
        warning_count: 0,
        import_mode: upload.import_mode,
        imported_by: "demo",
        status: "OK",
      });
      return {
        success: true,
        import_id: sequence,
        inserted: 7,
        updated: 0,
        unchanged: 0,
      };
    }
    if (action === "wo-excel") {
      await demoPlanningApi.action("create-wo", {
        modelo: "0001-A",
        cantidad_planeada: 500,
        fecha_operacion: upload.fecha_operacion || today(),
        codigo_po: "SIN-PO",
      });
      return {
        success: true,
        registros_procesados: 1,
        errores: 0,
        detalles: { errores: [] },
      };
    }
    if (action === "inventory") {
      inventory.set("EBR23966228-01-A", {
        lgemm: 800,
        isemm: 50,
        svc: 0,
        dif: 0,
        pendiente: 0,
        rework: 0,
        smt: 0,
        imd: 0,
        line: activeLines[0],
        ref_date: week().date_from,
      });
      revision++;
      return {
        success: true,
        parts: 1,
        schedules: 1,
        warnings: [
          "Importación simulada; no se analizan los datos reales del archivo.",
        ],
      };
    }
    schedule.set(`EBR23966228-01-A|${today()}`, 500);
    revision++;
    return {
      success: true,
      updated: 1,
      warnings: [
        "Sincronización simulada; el servidor aplica las reglas del Excel real.",
      ],
    };
  },
  async exportWO(filters) {
    const data = await demoPlanningApi.orders("wo", {
      ...filters,
      estado: "",
      cliente: "",
      modelo: "",
    });
    await exportSpreadsheet("WorkOrders_demo.xlsx", [
      {
        name: "Work Orders",
        rows: [
          WO_SPECS.map((spec) => spec[1]),
          ...data.map((row) =>
            WO_SPECS.map(([key]) =>
              typeof row[key] === "number"
                ? (row[key] as number)
                : text(row[key]),
            ),
          ),
        ],
      },
    ]);
  },
};
