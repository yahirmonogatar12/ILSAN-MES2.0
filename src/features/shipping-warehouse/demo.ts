import { saveDownload } from "@/core/http";
import { exportSpreadsheet, spreadsheetEngine } from "@/shared/lib/spreadsheet";
import {
  integer,
  movementType,
  number,
  recordId,
  ROOT,
  text,
  today,
} from "./model";
import type { Attachment, Row } from "./types";

const partA = "EBR23966228-01-A";
const partB = "EBR23966229-02-B";
const user = "demo";
let nextId = 40;
const catalog: Row[] = [
  {
    catalog_id: 1,
    part_number: partA,
    product_model: "Modelo demo A",
    product_status: "activo",
    description: "Tarjeta ensamblada",
    standard_pack: 20,
    customer: "LG",
    zone_code: "Z1",
    initial_quantity: 600,
  },
  {
    catalog_id: 2,
    part_number: partB,
    product_model: "Modelo demo B",
    product_status: "activo",
    description: "Tarjeta SMT",
    standard_pack: 25,
    customer: "LG",
    zone_code: "Z2",
    initial_quantity: 300,
  },
  {
    catalog_id: 3,
    part_number: "0001/03-C",
    product_model: "Modelo demo C",
    product_status: "inactivo",
    description: "",
    standard_pack: 1,
    customer: "LG",
    zone_code: "pending",
    initial_quantity: 0,
  },
];
const movements: Row[] = [];
const audit: Row[] = [];
const receipts: Row[] = [
  {
    invoice_id: 11,
    numero_invoice: "INV-DEMO-11",
    estado: "PENDIENTE",
    fecha_carga: today(),
    part_number: partA,
    quantity: 120,
    packing_line_ids: [101, 102],
    entrada_confirmada: false,
  },
  {
    invoice_id: 11,
    numero_invoice: "INV-DEMO-11",
    estado: "PENDIENTE",
    fecha_carga: today(),
    part_number: partB,
    quantity: 50,
    packing_line_ids: [103],
    entrada_confirmada: false,
  },
];
const drafts = new Map<
  number,
  {
    kind: string;
    rows: Row[];
    metadata: Row;
    summary: Row;
    reason?: string;
    movementAt?: string;
    status: string;
  }
>();
let closureBoundary = 0;
let periodStart = "";

function part(number: string) {
  const result = catalog.find(
    (row) => text(row.part_number).toUpperCase() === number.toUpperCase(),
  );
  if (!result)
    throw new Error("Número de parte fuera del catálogo de demostración.");
  return result;
}
function addMovement(
  type: "entry" | "exit" | "return",
  partNumber: string,
  qty: number,
  options: Row = {},
) {
  const product = part(partNumber);
  const id = ++nextId;
  const timestamp = text(options.movement_at) || today() + " 08:00:00";
  const row: Row = {
    id,
    record_id: id,
    movement_type: type,
    movement_label: { entry: "Entrada", exit: "Salida", return: "Retorno" }[
      type
    ],
    folio: { entry: "ENT", exit: "SAL", return: "RET" }[type] + "-DEMO-" + id,
    part_number: product.part_number,
    product_model: product.product_model,
    customer: product.customer,
    zone_code: product.zone_code,
    location_code: "A-01",
    location_value: "A-01",
    registered_by: user,
    fecha: timestamp.slice(0, 10),
    hora: timestamp.slice(11) || "08:00:00",
    cantidad: qty,
    display_quantity: qty,
    departure_code: "",
    ...options,
  };
  movements.unshift(row);
  return row;
}
addMovement("entry", partA, 120);
addMovement("exit", partA, 80, { destination_area: "Embarques" });
addMovement("exit", partB, 25, {
  departure_code: "DEP-DEMO-01",
  destination_area: "Embarques",
});
addMovement("return", partA, 12, {
  return_quantity: 12,
  loss_quantity: 0,
  reason: "Exceso",
});
addMovement("return", partB, 5, {
  return_quantity: 0,
  loss_quantity: 5,
  reason: "OS&D / Salida retorno",
});

function stock(
  product: Row,
): Row & { current_quantity: number; delete_mode: string } {
  const related = movements.filter(
    (row) =>
      row.part_number === product.part_number &&
      number(row.id) > closureBoundary,
  );
  const sum = (type: string, key: string) =>
    related
      .filter((row) => row.movement_type === type)
      .reduce((total, row) => total + number(row[key]), 0);
  const initial = number(product.initial_quantity);
  const entries = sum("entry", "cantidad"),
    exits = sum("exit", "cantidad");
  const returned = sum("return", "return_quantity"),
    sent = sum("return", "loss_quantity");
  const quantity = initial + entries - exits + returned - sent;
  return {
    ...product,
    initial_quantity: initial,
    entries_qty: entries,
    exits_qty: exits,
    return_entries_qty: returned,
    return_exits_qty: sent,
    current_quantity: quantity,
    delete_mode:
      quantity !== 0
        ? "blocked_stock"
        : related.length
          ? "blocked_movements"
          : movements.some((row) => row.part_number === product.part_number)
            ? "soft_delete"
            : "hard_delete",
  };
}
function filtered(rows: Row[], params: URLSearchParams) {
  const query = (params.get("search") || "").toLowerCase(),
    from = params.get("fecha_desde"),
    to = params.get("fecha_hasta");
  const type = params.get("tipo"),
    status = params.get("status"),
    action = params.get("accion");
  return rows.filter(
    (row) =>
      (!query ||
        Object.values(row).some((value) =>
          text(value).toLowerCase().includes(query),
        )) &&
      (!from || !row.fecha || text(row.fecha) >= from) &&
      (!to || !row.fecha || text(row.fecha) <= to) &&
      (!type ||
        row.movement_type === type ||
        text(row.reason).startsWith(type)) &&
      (!status || row.product_status === status) &&
      (!action || row.adjustment_action === action),
  );
}
const metadata = () => ({
  closureDate: today(),
  closureUser: user,
  closureMonthLabel: today().slice(0, 7),
});
function history() {
  return [...drafts]
    .filter(([, batch]) => batch.kind === "closure")
    .reverse()
    .map(([id, batch]) => ({
      id,
      closure_label: "CIERRE-DEMO-" + id,
      closure_month: batch.metadata.closureMonthLabel,
      closed_at: batch.metadata.closureDate,
      created_by: user,
      accuracy_pct: batch.summary.accuracyPct,
      status: batch.status,
    }));
}
function comparison(physical?: ReadonlyMap<string, number>) {
  const rows = catalog.map((product) => {
    const current = stock(product).current_quantity;
    const csv = physical?.get(text(product.part_number)) ?? null;
    return {
      part_number: product.part_number,
      product_model: product.product_model,
      system_quantity: current,
      csv_current_qty: csv,
      difference_quantity: csv === null ? null : csv - current,
      applied_initial_quantity: csv,
      status:
        csv === null ? "pendiente" : csv === current ? "igual" : "diferencia",
    };
  });
  const same = rows.filter((row) => row.status === "igual").length;
  return {
    rows,
    summary: {
      totalRows: rows.length,
      differenceRows: rows.filter((row) => row.status === "diferencia").length,
      accuracyPct: rows.length ? Math.round((same * 100) / rows.length) : 0,
    },
  };
}
async function readFile(file: File, quantityKey: string, minimum: number) {
  const engine = await spreadsheetEngine();
  const book = engine.read(await file.arrayBuffer(), {
    type: "array",
    raw: true,
  });
  const [headers, ...data] = engine.utils.sheet_to_json<string[]>(
    book.Sheets[book.SheetNames[0]],
    { header: 1, raw: false, defval: "" },
  );
  const names = (headers ?? []).map((value) =>
    text(value)
      .trim()
      .toLowerCase()
      .replace(/^\uFEFF/, ""),
  );
  const partIndex = names.indexOf("part_number"),
    qtyIndex = names.indexOf(quantityKey);
  if (partIndex < 0 || qtyIndex < 0)
    return {
      errors: [`Usa las columnas part_number y ${quantityKey}.`],
      values: new Map<string, number>(),
    };
  const errors: string[] = [];
  const values = new Map<string, number>();
  for (const [index, row] of data.entries()) {
    const name = text(row[partIndex]).trim(),
      qty = integer(row[qtyIndex], minimum);
    if (!name && text(row[qtyIndex]).trim() === "") continue;
    if (
      qty === null ||
      !catalog.some((product) => product.part_number === name) ||
      values.has(name)
    )
      errors.push(
        `Fila ${index + 2}: parte o cantidad inválida, o parte repetida.`,
      );
    else values.set(name, qty);
  }
  if (!values.size && !errors.length)
    errors.push("El archivo no contiene registros.");
  return { values, errors };
}
const pending = {
  entrada: [
    {
      box_code: "Caja/QA-01-A",
      fecha: today(),
      part_number: partA,
      product_model: "Modelo demo A",
      quantity: 20,
      pending_quantity: 20,
      oqc_folio: "OQC-DEMO-1",
      released_at: today() + " 09:00:00",
    },
  ],
  liberacion: [
    {
      box_code: "Caja/QA-02-B",
      fecha: today(),
      part_number: partB,
      product_model: "Modelo demo B",
      pending_quantity: 15,
      lqc_quantity: 25,
      oqc_quantity: 10,
      last_lqc_scan: today() + " 08:10:00",
      lineas: "M1",
      lotes: "ASSY-DEMO-1",
    },
  ],
};
function pendingSummary(boxes: Row[]) {
  return {
    pending_parts: new Set(boxes.map((row) => row.part_number)).size,
    pending_boxes: boxes.length,
    pending_quantity: boxes.reduce(
      (sum, row) => sum + number(row.pending_quantity),
      0,
    ),
  };
}
function json(init?: RequestInit): Row {
  return typeof init?.body === "string" ? (JSON.parse(init.body) as Row) : {};
}
const success = (message: string) => ({ success: true, message });

export async function demoRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const url = new URL(path, "http://demo.invalid");
  const route = url.pathname.startsWith(ROOT + "/")
    ? url.pathname.slice(ROOT.length + 1)
    : url.pathname;
  const method = init?.method ?? "GET";
  const params = url.searchParams;
  const body = json(init);
  const read = method === "GET";
  if (read && ["entradas", "salidas", "retorno"].includes(route)) {
    const type =
      route === "entradas" ? "entry" : route === "salidas" ? "exit" : "return";
    return structuredClone(
      filtered(
        movements.filter((row) => row.movement_type === type),
        params,
      ),
    );
  }
  if (route === "entradas/invoices")
    return {
      rows: structuredClone(receipts),
      summary: {
        total_invoices: 1,
        total_parts: receipts.length,
        total_quantity: 170,
      },
    };
  if (
    /^\/api\/material_admin\/invoices\/11\/manual-receipts\/bulk$/.test(
      route,
    ) &&
    method === "POST"
  ) {
    if (receipts.some((row) => row.entrada_confirmada))
      throw new Error("La invoice ya fue confirmada.");
    if (!Array.isArray(body.lines))
      throw new Error("Selecciona las partes de la recepción.");
    const entries = (body.lines as Row[]).map((line) => {
      const qty = number(line.cantidad_confirmada);
      const row =
        qty > 0
          ? addMovement("entry", text(line.part_number), qty, {
              movement_at: today() + " 08:00:00",
            })
          : null;
      return {
        part_number: line.part_number,
        folio: row?.folio ?? "",
        quantity: qty,
      };
    });
    for (const row of receipts) {
      const saved = entries.find(
        (entry) => entry.part_number === row.part_number,
      );
      if (saved)
        Object.assign(row, {
          entrada_confirmada: true,
          cantidad_confirmada: saved.quantity,
          folio_entrada: saved.folio,
        });
    }
    return { ...success("Recepción confirmada."), entradas: entries };
  }
  if (read && /^(entradas|salidas)\/cajas$/.test(route)) {
    const row = movements.find((item) => item.folio === params.get("folio"));
    return {
      rows: row
        ? [
            {
              box_id: "Caja/DEMO-" + row.id,
              part_number: row.part_number,
              quantity: row.cantidad,
              fecha: row.fecha,
              hora: row.hora,
            },
          ]
        : [],
      summary: { total_boxes: row ? 1 : 0, total_quantity: row?.cantidad ?? 0 },
    };
  }
  const depart = /^salidas\/(\d+)\/departure$/.exec(route);
  if (depart) {
    const row = movements.find(
      (item) => item.id === Number(depart[1]) && item.movement_type === "exit",
    );
    if (!row || row.departure_code)
      throw new Error("La salida ya no está disponible para asignar.");
    const qty = recordId(body.departureQuantity),
      total = number(row.cantidad);
    if (qty > total) throw new Error("La cantidad supera la salida.");
    const rest =
      qty < total
        ? addMovement("exit", text(row.part_number), total - qty, {
            movement_at: text(row.fecha) + " " + text(row.hora),
            destination_area: row.destination_area,
            location_value: row.location_value,
          })
        : null;
    Object.assign(row, {
      departure_code: body.departureCode,
      cantidad: qty,
      display_quantity: qty,
    });
    return {
      success: true,
      departureCode: body.departureCode,
      splitCreated: !!rest,
      splitFolio: rest?.folio,
    };
  }
  if (route === "/api/shipping/material/returns") {
    const qty = number(body.returnQty) + number(body.lossQty);
    const product = part(text(body.partNumber));
    if (number(body.lossQty) > stock(product).current_quantity)
      throw new Error("El inventario no alcanza para la salida.");
    addMovement("return", text(product.part_number), qty, {
      return_quantity: body.returnQty,
      loss_quantity: body.lossQty,
      reason: body.reason,
      remarks: body.remarks,
    });
    return success("Retorno registrado.");
  }
  if (route === "inventario-general")
    return {
      rows: filtered(catalog.map(stock), params),
      summary: { latest_period_start: periodStart },
    };
  if (route === "movimientos")
    return { rows: structuredClone(filtered(movements, params)) };
  if (route === "movimientos/historial")
    return { rows: filtered(audit, params) };
  const move = /^movimientos\/(entry|exit|return)\/(\d+)$/.exec(route);
  if (move) {
    const row = movements.find(
      (item) =>
        item.movement_type === movementType(move[1]) &&
        item.id === Number(move[2]),
    );
    if (!row) throw new Error("Movimiento no encontrado.");
    const action = method === "DELETE" ? "delete" : "update";
    const before = structuredClone(row);
    if (action === "delete") movements.splice(movements.indexOf(row), 1);
    else {
      const changes = body.changes as Row;
      const columns: Record<string, string> = {
        fecha: "fecha",
        hora: "hora",
        cantidad: "cantidad",
        zona: "zone_code",
        ubicacion_destino: "location_value",
        departure: "departure_code",
      };
      for (const [field, value] of Object.entries(changes)) {
        if (!columns[field]) continue;
        row[columns[field]] = value;
        if (field === "cantidad") {
          row.display_quantity = value;
          if (row.movement_type === "return")
            row[
              number(row.loss_quantity) > 0
                ? "loss_quantity"
                : "return_quantity"
            ] = value;
        }
      }
    }
    audit.unshift({
      id: ++nextId,
      fecha: today(),
      hora: "09:00:00",
      folio: before.folio,
      part_number: before.part_number,
      movement_type: before.movement_type,
      movement_label: before.movement_label,
      adjustment_action: action,
      action_label: action === "delete" ? "Eliminación" : "Modificación",
      changed_fields: Object.keys((body.changes as Row) ?? {}).join(", "),
      previous_values: text({
        cantidad: before.cantidad,
        zona: before.zone_code,
        departure: before.departure_code,
      }),
      new_values: action === "delete" ? "" : text(body.changes),
      adjusted_by: user,
      notes: body.notes,
    });
    return success(
      action === "delete" ? "Movimiento eliminado." : "Movimiento actualizado.",
    );
  }
  const item = /^catalogo\/(\d+)$/.exec(route);
  if (route === "catalogo" || item) {
    if (read) return { rows: filtered(catalog.map(stock), params) };
    const current = item
      ? catalog.find((row) => row.catalog_id === Number(item[1]))
      : undefined;
    if (item && !current) throw new Error("Parte no encontrada.");
    if (method === "DELETE" && current) {
      const mode = stock(current).delete_mode;
      if (mode.startsWith("blocked"))
        throw new Error("No es posible dar de baja esta parte.");
      if (mode === "soft_delete") current.product_status = "inactivo";
      else catalog.splice(catalog.indexOf(current), 1);
      return success("Baja aplicada.");
    }
    const partNumber = text(body.partNumber);
    if (
      catalog.some((row) => row !== current && row.part_number === partNumber)
    )
      throw new Error("El número de parte ya existe.");
    const values = {
      part_number: partNumber,
      product_model: body.productModel,
      product_status: body.productStatus,
      description: body.description,
      standard_pack: number(body.standardPack),
      customer: body.customer,
      zone_code: body.zoneCode,
    };
    if (current) {
      for (const row of movements)
        if (row.part_number === current.part_number)
          row.part_number = partNumber;
      Object.assign(current, values);
    } else
      catalog.push({ ...values, catalog_id: ++nextId, initial_quantity: 0 });
    return success("Catálogo actualizado.");
  }

  if (route === "qa-pendientes") {
    const entry = filtered(pending.entrada, params),
      release = filtered(pending.liberacion, params);
    const summarize = (boxes: Row[]) => ({
      rows: boxes.map((box) => ({ ...box, pending_boxes: 1 })),
      summary: pendingSummary(boxes),
    });
    return { entry: summarize(entry), release: summarize(release) };
  }
  if (route === "qa-pendientes/cajas") {
    const data =
      params.get("tipo") === "liberacion"
        ? pending.liberacion
        : pending.entrada;
    const filters = new URLSearchParams(params);
    filters.delete("tipo");
    const boxes = filtered(data, filters).filter(
      (row) => row.part_number === params.get("part_number"),
    );
    return { boxes, summary: pendingSummary(boxes) };
  }

  const batchAction =
    /^(entradas\/ajustes|salidas\/ajustes|inventario-general\/cierre)\/(manual|preview|confirm|cancel|bootstrap)$/.exec(
      route,
    );
  if (batchAction) {
    const [, prefix, action] = batchAction;
    const isClosure = prefix === "inventario-general/cierre";
    const kind = isClosure
      ? "closure"
      : prefix.startsWith("entradas")
        ? "entry"
        : "exit";
    if (action === "bootstrap")
      return {
        metadata: metadata(),
        preview: comparison(),
        history: history(),
      };
    if (action === "manual" && kind !== "closure") {
      const qty = recordId(body.quantity);
      const product = part(text(body.partNumber));
      if (kind === "exit" && stock(product).current_quantity < qty)
        throw new Error("La cantidad supera el inventario.");
      addMovement(kind, text(product.part_number), qty, {
        movement_at: body.movementAt,
        reason: body.reason,
      });
      return success("Movimiento registrado.");
    }
    if (action === "preview" && init?.body instanceof FormData) {
      const data = init.body,
        file = data.get(isClosure ? "closure_file" : "adjustment_file");
      if (!(file instanceof File)) throw new Error("Selecciona un archivo.");
      const { values, errors } = await readFile(
        file,
        isClosure ? "current_qty" : "quantity",
        isClosure ? 0 : 1,
      );
      if (isClosure && values.size !== catalog.length)
        errors.push("El CSV debe contener todas las partes del catálogo.");
      const preview = isClosure
        ? comparison(values)
        : {
            rows: [...values].map(([name, qty]) => {
              const product = stock(part(name));
              const next =
                product.current_quantity + (kind === "entry" ? qty : -qty);
              if (next < 0) errors.push(`${name}: inventario insuficiente.`);
              return {
                part_number: name,
                quantity: qty,
                current_quantity: product.current_quantity,
                new_quantity: next,
                product_model: product.product_model,
                closureImpactCount: 0,
              };
            }),
            summary: {
              totalRows: values.size,
              totalQuantity: [...values.values()].reduce((a, b) => a + b, 0),
            },
          };
      if (errors.length)
        return {
          valid: false,
          errors,
          preview,
          metadata: metadata(),
          history: history(),
        };
      const batchId = ++nextId;
      drafts.set(batchId, {
        kind,
        ...preview,
        metadata: metadata(),
        reason: text(data.get("reason")),
        movementAt: text(data.get("movement_at")),
        status: "draft",
      });
      return {
        valid: true,
        batchId,
        batchCode: "LOTE-DEMO-" + batchId,
        preview,
        metadata: metadata(),
        history: history(),
      };
    }
    const batchId = recordId(body.batchId),
      batch = drafts.get(batchId);
    if (!batch || batch.kind !== kind || batch.status !== "draft")
      throw new Error("El borrador ya no está disponible.");
    if (action === "cancel") {
      batch.status = "cancelled";
      return success("Borrador descartado.");
    }
    if (isClosure) {
      for (const row of batch.rows)
        part(text(row.part_number)).initial_quantity = row.csv_current_qty;
      closureBoundary = nextId;
      periodStart = today();
    } else {
      if (kind === "closure") throw new Error("Lote inválido.");
      for (const row of batch.rows)
        if (
          kind === "exit" &&
          stock(part(text(row.part_number))).current_quantity <
            number(row.quantity)
        )
          throw new Error("El inventario cambió desde la vista previa.");
      for (const row of batch.rows)
        addMovement(kind, text(row.part_number), number(row.quantity), {
          movement_at: batch.movementAt,
          reason: batch.reason,
        });
    }
    batch.status = "confirmed";
    return {
      ...success(isClosure ? "Cierre confirmado." : "Lote aplicado."),
      insertedRows: batch.rows.length,
      updatedClosureRows: 0,
      history: history(),
    };
  }
  const close = /^inventario-general\/cierre\/history\/(\d+)$/.exec(route);
  if (close) {
    const batch = drafts.get(Number(close[1]));
    if (!batch || batch.kind !== "closure")
      throw new Error("Cierre no encontrado.");
    return {
      batch: history().find((row) => row.id === Number(close[1])),
      payload: {
        rows: batch.rows,
        metadata: batch.metadata,
        summary: batch.summary,
      },
    };
  }
  throw new Error("La operación no está disponible en demostración.");
}

export async function demoDownload(path: string, name: string) {
  if (path.endsWith("/template")) {
    const closure = path.includes("/cierre/");
    const content = closure
      ? "part_number,current_qty\n" +
        catalog.map((row) => row.part_number + ",").join("\n")
      : "part_number,quantity\n";
    saveDownload(
      new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
      name,
    );
    return;
  }
  const url = new URL(path, "http://demo.invalid");
  const payload = (await demoRequest(
    url.pathname.replace(/\/export$/, "") + url.search,
  )) as Row | Row[];
  const data = Array.isArray(payload)
    ? payload
    : ((payload.rows ??
        payload.boxes ??
        (payload.payload as Row)?.rows ??
        []) as Row[]);
  const selected = url.searchParams.get("movement");
  const rows = selected
    ? data.filter((row) =>
        selected === "exit"
          ? number(row.loss_quantity) > 0
          : number(row.return_quantity) > 0 && !number(row.loss_quantity),
      )
    : data;
  const keys = Object.keys(rows[0] ?? { folio: "" });
  await exportSpreadsheet(name, [
    {
      name: "Consulta",
      rows: [
        keys,
        ...rows.map((row) =>
          keys.map((key) =>
            typeof row[key] === "number"
              ? (row[key] as number)
              : text(row[key]),
          ),
        ),
      ],
    },
  ]);
}

export function demoReturnPdf(rows: readonly Row[]): Attachment {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const pages: number[] = [];
  const escape = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/[\\()]/g, "\\$&");
  for (let i = 0; i < rows.length; i += 42) {
    const page = objects.length + 1;
    pages.push(page);
    const labels = [
      "Salidas de retorno - Demostracion",
      ...rows
        .slice(i, i + 42)
        .map(
          (row) =>
            `${row.fecha}  ${row.folio}  ${row.part_number}  ${row.loss_quantity} piezas`,
        ),
    ];
    const stream =
      "BT /F1 10 Tf 40 760 Td 16 TL " +
      labels.map((label) => "(" + escape(label) + ") Tj T*").join(" ") +
      " ET";
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((page) => page + " 0 R").join(" ")}] >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return {
    name: "salidas-retorno-demo.pdf",
    blob: new Blob([pdf], { type: "application/pdf" }),
  };
}
