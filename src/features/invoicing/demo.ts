import { containsText as contains } from "@/shared/lib/text";
import { saveDownload } from "@/core/http";
import { spreadsheetEngine } from "@/shared/lib/spreadsheet";
import { amount, invoiceIsOpen, localToday, text } from "./model";
import type {
  DataRow,
  InvoiceApi,
  InvoiceDetail,
  InvoiceScope,
  PurchaseApi,
  PurchaseDetail,
  PurchasePreview,
  PurchaseUpload,
  ValuationApi,
  ValuationFilters,
} from "./types";

const invoices = new Map<number, InvoiceDetail>();
const files = new Map<number, File>();
let sequence = 300;
function seedInvoice(
  scope: InvoiceScope,
  id: number,
  number: string,
): InvoiceDetail {
  const part = scope === "EMBARQUES" ? "EBR23966228-01-A" : "0CE105VK6DC";
  const lines: DataRow[] = [
    {
      id: id * 10 + 1,
      line_no: 1,
      raw_part_num: "RAW/001-A",
      numero_parte_sistema: part,
      descripcion: "Componente de demostración",
      cantidad: "1000",
      uom: "EA",
      costo_unitario: "0.0157",
      costo_total: "15.7000",
      estado_match: "MATCHED",
      links_activos: 0,
    },
    {
      id: id * 10 + 2,
      line_no: 2,
      raw_part_num: "RAW/002",
      numero_parte_sistema: "SIN-CATALOGO",
      descripcion: "Parte sin registro de ejemplo",
      cantidad: "100",
      uom: "EA",
      costo_unitario: "0",
      costo_total: "0",
      estado_match: "SIN_ALIAS",
      links_activos: 0,
    },
  ];
  const packing: DataRow[] = lines.map((line, index) => ({
    id: id * 100 + index + 1,
    invoice_line_id: line.id,
    line_no: line.line_no,
    numero_parte_sistema: line.numero_parte_sistema,
    descripcion: line.descripcion,
    pallet_no_original: "PL-007",
    pallet_no: "007",
    cantidad_packing: line.cantidad,
    entradas_recibidas: index === 0 ? 1 : 0,
    cantidad_recibida: index === 0 ? 500 : 0,
    cantidad_pendiente_entrada: index === 0 ? 500 : 100,
    cantidad_aplicada_activa: 0,
    kg: "1.25",
    cbm: "0.02",
    estado_match: line.estado_match,
    tiene_part_system: index === 0 ? 1 : 0,
    mensaje_match:
      index === 0 ? "Recepción parcial de ejemplo" : "Sin parte en catálogo",
    lotes: [],
  }));
  if (scope === "ALMACEN")
    packing.push({
      id: null,
      numero_parte_sistema: part,
      pallet_no_original: "PL-009",
      pallet_no: "009",
      ejemplo_codigo: "MAT/26-DIF-0001",
      estado_match: "DIFERENCIA_PALLET",
      mensaje_match: "Lote recibido en pallet distinto; requiere confirmación.",
    });
  return {
    invoice: {
      id,
      ambito: scope,
      numero_invoice: number,
      tipo: "LG",
      estado: "CON_DIFERENCIAS",
      cerrado_manual: 0,
      total_lineas: 2,
      total_packing: 2,
      links_activos: 0,
      archivo_nombre: `${number}.xlsx`,
      archivo_ruta: "demostracion",
      fecha_carga: `${localToday()} 09:00:00`,
    },
    lines,
    packing,
    links: [],
    manual_receipts: [],
  };
}
invoices.set(101, seedInvoice("ALMACEN", 101, "INV-ALMACEN-DEMO"));
invoices.set(201, seedInvoice("EMBARQUES", 201, "INV-EMBARQUES-DEMO"));
function invoice(scope: InvoiceScope, id: number) {
  const value = invoices.get(id);
  if (!value || value.invoice.ambito !== scope)
    throw new Error("Invoice no encontrada en este ámbito.");
  return value;
}
function refresh(value: InvoiceDetail) {
  const active = value.links.filter((link) => link.estado === "APLICADO");
  value.invoice.links_activos = active.length;
  for (const line of value.lines)
    line.links_activos = active.filter(
      (link) => link.invoice_line_id === line.id,
    ).length;
  for (const packing of value.packing)
    if (packing.id) {
      packing.lotes = active
        .filter((link) => link.packing_line_id === packing.id)
        .map((link) => ({
          ...link,
          numero_parte: link.numero_parte_sistema,
          stock_actual: link.cantidad_aplicada,
        }));
      packing.cantidad_aplicada_activa = active
        .filter((link) => link.packing_line_id === packing.id)
        .reduce((sum, link) => sum + amount(link.cantidad_aplicada), 0);
    }
  value.invoice.total_lineas = value.lines.length;
  value.invoice.total_packing = value.packing.filter((row) => row.id).length;
}
export const demoInvoices: InvoiceApi = {
  async list(scope, filters) {
    const records = [...invoices.values()]
      .map((value) => value.invoice)
      .filter(
        (row) =>
          row.ambito === scope &&
          (!filters.q ||
            contains(
              `${text(row.numero_invoice)} ${text(row.tipo)} ${text(row.archivo_nombre)}`,
              filters.q,
            )) &&
          (filters.estado === "PENDIENTES"
            ? invoiceIsOpen(row)
            : (!filters.estado || row.estado === filters.estado) &&
              (invoiceIsOpen(row) ||
                ((!filters.fecha_inicio ||
                  text(row.fecha_carga).slice(0, 10) >= filters.fecha_inicio) &&
                  (!filters.fecha_fin ||
                    text(row.fecha_carga).slice(0, 10) <= filters.fecha_fin)))),
      );
    return { records: structuredClone(records), total: records.length };
  },
  async detail(scope, id) {
    return structuredClone(invoice(scope, id));
  },
  async preview(scope, upload) {
    const number =
      upload.numero_invoice || upload.file.name.replace(/\.[^.]+$/, "");
    const sample = seedInvoice(scope, 1, number);
    const duplicate = [...invoices.values()].find(
      (value) =>
        value.invoice.ambito === scope &&
        value.invoice.numero_invoice === number,
    );
    return {
      numero_invoice: number,
      total_lineas: 2,
      total_packing: 2,
      total_monto: "15.7000",
      partes_sin_sistema: 1,
      warnings: [
        "Vista previa simulada. El parser real de Excel se ejecuta en Flask.",
      ],
      lines: structuredClone(sample.lines),
      duplicado: duplicate
        ? { motivo: "NUMERO_INVOICE", invoice_id: duplicate.invoice.id }
        : null,
    };
  },
  async upload(scope, upload) {
    const preview = await demoInvoices.preview(scope, upload);
    if (preview.duplicado)
      throw new Error("Esta invoice ya existe en el ámbito seleccionado.");
    const id = ++sequence;
    const value = seedInvoice(scope, id, preview.numero_invoice);
    value.invoice.tipo = upload.tipo || "LG";
    invoices.set(id, value);
    files.set(id, upload.file);
    return {
      invoice_id: id,
      lineas: 2,
      packing: 2,
      estado: value.invoice.estado,
    };
  },
  async remove(scope, id) {
    const value = invoice(scope, id);
    if (amount(value.invoice.links_activos))
      throw new Error("Tiene links activos; primero desaplica la invoice.");
    invoices.delete(id);
    files.delete(id);
    return { success: true };
  },
  async updateLine(scope, id, lineId, draft) {
    const value = invoice(scope, id);
    const line = value.lines.find((line) => Number(line.id) === lineId);
    if (!line) throw new Error("Línea no encontrada.");
    if (amount(line.links_activos))
      throw new Error("La línea tiene links activos.");
    Object.assign(line, draft);
    for (const packing of value.packing)
      if (packing.invoice_line_id === lineId)
        Object.assign(packing, {
          numero_parte_sistema: draft.numero_parte_sistema,
          cantidad_packing: draft.cantidad,
          descripcion: draft.descripcion,
        });
    return {
      estado_match: line.estado_match,
      numero_parte_sistema: draft.numero_parte_sistema,
      packing_actualizados: 1,
    };
  },
  async removeLine(scope, id, lineId) {
    const value = invoice(scope, id);
    if (
      value.links.some(
        (link) => link.invoice_line_id === lineId && link.estado === "APLICADO",
      )
    )
      throw new Error("La línea tiene links activos.");
    value.lines = value.lines.filter((row) => row.id !== lineId);
    value.packing = value.packing.filter(
      (row) => row.invoice_line_id !== lineId,
    );
    refresh(value);
    return { packing_eliminados: 1 };
  },
  async action(scope, id, action, payload) {
    const value = invoice(scope, id);
    if (action === "close") {
      value.invoice.cerrado_manual = payload.cerrado ? 1 : 0;
      return {
        message: payload.cerrado ? "Invoice cerrada." : "Invoice reabierta.",
      };
    }
    if (scope !== "ALMACEN")
      throw new Error(
        "Embarques no aplica costos a lotes de almacén desde este módulo.",
      );
    if (action === "unapply") {
      let count = 0;
      for (const link of value.links)
        if (link.estado === "APLICADO") {
          link.estado = "DESAPLICADO";
          link.usuario_desaplicado = "demo";
          count++;
        }
      refresh(value);
      return { links_desaplicados: count };
    }
    if (!value.links.length)
      await demoInvoices.link(
        scope,
        id,
        "MAT/26-DEMO-0001",
        Number(value.packing[0].id),
        "Aplicación de ejemplo",
      );
    else for (const link of value.links) link.estado = "APLICADO";
    refresh(value);
    return {
      estado: "PARCIALMENTE_APLICADA",
      aplicados: value.links.length,
      omitidos: 1,
      skipped: [
        {
          codigo_material_recibido: "MAT/26-DIF-0001",
          pallet_mismatch: true,
          error: "Pallet recibido 009 distinto de 007; requiere confirmación.",
        },
      ],
    };
  },
  async manual(scope, id, packingId, recibido, comentario) {
    const value = invoice(scope, id);
    const packing = value.packing.find((row) => Number(row.id) === packingId);
    if (!packing || Number(packing.tiene_part_system) !== 0)
      throw new Error("Esta línea debe recibirse por Entrada de material.");
    packing.confirmacion_manual_estado = recibido ? "RECIBIDO" : "REVERTIDO";
    packing.confirmacion_manual_usuario = "demo";
    packing.confirmacion_manual_fecha = `${localToday()} 10:00:00`;
    value.manual_receipts.unshift({
      id: value.manual_receipts.length + 1,
      accion: packing.confirmacion_manual_estado,
      numero_parte_sistema: packing.numero_parte_sistema,
      descripcion: packing.descripcion,
      pallet_no: packing.pallet_no,
      cantidad_confirmada: packing.cantidad_packing,
      usuario: "demo",
      fecha: packing.confirmacion_manual_fecha,
      comentario,
    });
    return {
      message: recibido
        ? "Recepción documental registrada sin generar inventario."
        : "Recepción revertida, conservando el historial.",
    };
  },
  async partial(scope, id, code) {
    return {
      codigo_material_recibido: code,
      records: structuredClone(
        invoice(scope, id)
          .packing.filter(
            (row) => row.id && Number(row.tiene_part_system) === 1,
          )
          .map((row) => ({ ...row, cantidad_pendiente: 500 })),
      ),
    };
  },
  async link(scope, id, code, packingId, note) {
    const value = invoice(scope, id);
    const packing = value.packing.find((row) => row.id === packingId);
    if (!packing) throw new Error("Packing no pertenece a esta invoice.");
    if (
      value.links.some(
        (row) =>
          row.codigo_material_recibido === code && row.estado === "APLICADO",
      )
    )
      return {
        aplicados: 0,
        skipped: [{ error: "El lote ya está aplicado." }],
      };
    value.links.push({
      id: value.links.length + 1,
      packing_line_id: packingId,
      invoice_line_id: packing.invoice_line_id,
      codigo_material_recibido: code,
      numero_parte_sistema: packing.numero_parte_sistema,
      cantidad_aplicada: 500,
      costo_unitario: "0.0157",
      moneda: "USD",
      pallet_recibido: "009",
      pallet_esperado: packing.pallet_no,
      estado: "APLICADO",
      usuario_aplicacion: "demo",
      fecha_aplicacion: `${localToday()} 10:00:00`,
      nota_aplicacion: note,
    });
    refresh(value);
    return { aplicados: 1, omitidos: 0 };
  },
  async file(scope, id) {
    const value = invoice(scope, id);
    const original = files.get(id);
    if (original) return { blob: original, name: original.name };
    const engine = await spreadsheetEngine();
    const book = engine.utils.book_new();
    engine.utils.book_append_sheet(
      book,
      engine.utils.aoa_to_sheet([
        ["PART SYS", "ITEM", "QTY", "UNIDAD", "COSTO", "TOTAL"],
        ...value.lines.map((row) => [
          text(row.numero_parte_sistema),
          text(row.descripcion),
          amount(row.cantidad),
          text(row.uom),
          amount(row.costo_unitario),
          amount(row.costo_total),
        ]),
      ]),
      "INVOICE(CONVERTED)",
    );
    return {
      blob: new Blob(
        [engine.write(book, { type: "array", bookType: "xlsx" })],
        {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ),
      name: `${text(value.invoice.numero_invoice)}_demostracion.xlsx`,
    };
  },
  async download(scope, id) {
    const file = await demoInvoices.file(scope, id);
    saveDownload(file.blob, file.name);
  },
};
const purchases = new Map<string, PurchaseDetail>();
const purchaseFiles = new Map<number, File>();
const purchaseLoads: DataRow[] = [
  {
    id: 1,
    tipo: "LG",
    archivo_nombre: "compras_LG_demostracion.xlsx",
    fecha_carga: localToday(),
    usuario_carga: "demo",
    total_lineas: 1,
  },
  {
    id: 2,
    tipo: "OVEN",
    archivo_nombre: "compras_OVEN_demostracion.xlsx",
    fecha_carga: localToday(),
    usuario_carga: "demo",
    total_lineas: 1,
  },
];
const purchaseKey = (number: string, type: string) => `${type}:${number}`;
function seedPurchase(
  number: string,
  type: string,
  closed = false,
): PurchaseDetail {
  return {
    numero_transaccion: number,
    tipo: type,
    transaccion: {
      numero_transaccion: number,
      tipo: type,
      estado: closed ? "CERRADA" : "ABIERTA",
      cerrada: closed,
    },
    lineas: [
      {
        id: 1,
        numero_parte: "RAW/001-A",
        carga_id: type === "LG" ? 1 : 2,
        numero_parte_sistema: "0CE105VK6DC-01-A",
        descripcion: "Capacitor de ejemplo",
        spec: "1uF 50V SMD",
        cantidad: 1000,
        aplicado: 200,
        pendiente: 800,
        estado: closed ? "CERRADA" : "ABIERTA",
        moneda: "USD",
        costo_unitario: "0.0157",
        costo_total: "15.7",
        proveedor: "SAMWHA",
        factura: "INV-DEMO",
        modelo: "MODELO/01-A",
        categoria: "SMD",
        fecha_compra: localToday(),
      },
    ],
    links: [
      {
        id: 1,
        codigo_material_recibido: "MAT/26-0004",
        numero_parte_sistema: "0CE105VK6DC-01-A",
        cantidad_aplicada: 200,
        costo_unitario: "0.0157",
        moneda: "USD",
        estado: "APLICADO",
        usuario_aplicacion: "demo",
        fecha_aplicacion: `${localToday()} 09:00:00`,
      },
    ],
  };
}
purchases.set(
  purchaseKey("PO/26-001+A&B", "LG"),
  seedPurchase("PO/26-001+A&B", "LG"),
);
purchases.set(
  purchaseKey("PO/26-001+A&B", "OVEN"),
  seedPurchase("PO/26-001+A&B", "OVEN", true),
);
const initial = { LG: false, OVEN: true };
function purchase(number: string, type: string) {
  const value = purchases.get(purchaseKey(number, type));
  if (!value) throw new Error("Transacción no encontrada en este tipo.");
  return value;
}
function previewPurchase(upload: PurchaseUpload): PurchasePreview {
  const sample = seedPurchase("PO/DEMO-NUEVA", upload.tipo).lineas.map(
    (row) => ({ ...row, numero_transaccion: "PO/DEMO-NUEVA" }),
  );
  return {
    tipo: upload.tipo,
    modo: upload.modo,
    total_lineas: 1,
    total_transacciones: 1,
    lineas_nuevas: 1,
    lineas_existentes: 0,
    total_monto: "15.7",
    bloqueado_inicial: upload.modo === "INICIAL" && initial[upload.tipo],
    warnings: ["Simulación del flujo; el Excel real se procesa en Flask."],
    sample,
    sync:
      upload.modo === "SINCRONIZACION"
        ? {
            modificadas: 1,
            faltantes: 1,
            renombradas: 1,
            sin_cambio: 0,
            bloqueadas: [],
            protegidas: [
              {
                numero_transaccion: "PO-HISTORICO",
                numero_parte: "PARTE/ANTERIOR",
              },
            ],
            ambiguas: [],
            faltantes_muestra: [
              { numero_transaccion: "PO/DEMO", numero_parte: "PARTE-FALTANTE" },
            ],
            renombradas_muestra: [
              {
                numero_parte: "PARTE/01-A",
                anterior: "PO-ANTERIOR",
                nueva: "PO/DEMO-NUEVA",
              },
            ],
          }
        : null,
  };
}
export const demoPurchases: PurchaseApi = {
  async loads(type) {
    const records = purchaseLoads.filter((row) => !type || row.tipo === type);
    return { records: structuredClone(records), total: records.length };
  },
  async file(id) {
    const original = purchaseFiles.get(id);
    if (original) return { blob: original, name: original.name };
    const load = purchaseLoads.find((row) => row.id === id);
    if (!load) throw new Error("Archivo no encontrado.");
    const engine = await spreadsheetEngine(),
      book = engine.utils.book_new();
    engine.utils.book_append_sheet(
      book,
      engine.utils.aoa_to_sheet([
        ["LISTA DE COMPRAS", text(load.tipo)],
        ["TRANSACCIÓN", "PARTE", "CANTIDAD", "PRECIO"],
        ["PO/26-001+A&B", "0CE105VK6DC-01-A", 1000, 0.0157],
      ]),
      "Compras",
    );
    return {
      blob: new Blob([engine.write(book, { type: "array", bookType: "xlsx" })]),
      name: text(load.archivo_nombre),
    };
  },
  async download(id) {
    const file = await demoPurchases.file(id);
    saveDownload(file.blob, file.name);
  },
  async list(filters) {
    const records = [...purchases.values()].flatMap((value) => {
      const line = value.lineas[0];
      if (!line) return [];
      const row: DataRow = {
        ...value.transaccion,
        proveedor: line.proveedor,
        num_partes: value.lineas.length,
        num_lineas: value.lineas.length,
        total_monto: value.lineas.reduce(
          (sum, row) => sum + amount(row.costo_total),
          0,
        ),
        fecha_compra: line.fecha_compra,
      };
      return (!filters.tipo || row.tipo === filters.tipo) &&
        (!filters.estado || row.estado === filters.estado) &&
        (!filters.q || contains(text(JSON.stringify(value)), filters.q)) &&
        (!filters.fecha_inicio ||
          text(row.fecha_compra) >= filters.fecha_inicio) &&
        (!filters.fecha_fin || text(row.fecha_compra) <= filters.fecha_fin)
        ? [row]
        : [];
    });
    return { records: structuredClone(records), total: records.length };
  },
  async detail(number, type) {
    return structuredClone(purchase(number, type));
  },
  async initial() {
    return structuredClone(initial);
  },
  async preview(upload) {
    return structuredClone(previewPurchase(upload));
  },
  async upload(upload) {
    if (upload.modo === "INICIAL" && initial[upload.tipo])
      throw new Error("Ya existe una carga inicial para este tipo.");
    if (upload.modo === "INICIAL") initial[upload.tipo] = true;
    const loadId = Math.max(...purchaseLoads.map((row) => Number(row.id))) + 1;
    purchaseFiles.set(loadId, upload.file);
    purchaseLoads.unshift({
      id: loadId,
      tipo: upload.tipo,
      archivo_nombre: upload.file.name,
      fecha_carga: localToday(),
      usuario_carga: "demo",
      total_lineas: 1,
    });
    const next = seedPurchase(
      "PO/DEMO-NUEVA",
      upload.tipo,
      upload.modo === "INICIAL",
    );
    next.lineas.forEach((row) => {
      row.carga_id = loadId;
    });
    purchases.set(purchaseKey("PO/DEMO-NUEVA", upload.tipo), next);
    return {
      carga_id: loadId,
      total_lineas: 1,
      total_transacciones: 1,
      tipo: upload.tipo,
      estado_lineas: upload.modo === "INICIAL" ? "CERRADA" : "ABIERTA",
      ...(upload.modo === "SINCRONIZACION"
        ? { agregadas: 1, modificadas: 1, borradas: 1, renombradas: 1 }
        : {}),
    };
  },
  async action(number, type, action, payload) {
    const value = purchase(number, type);
    if (action === "close") {
      value.transaccion.cerrada = payload.cerrado === true;
      value.transaccion.estado = payload.cerrado ? "CERRADA" : "ABIERTA";
      for (const line of value.lineas) line.estado = value.transaccion.estado;
      return {
        message: payload.cerrado
          ? "Transacción cerrada."
          : "Transacción reabierta.",
      };
    }
    let count = 0;
    for (const link of value.links)
      if (link.estado === (action === "unapply" ? "APLICADO" : "DESAPLICADO")) {
        link.estado = action === "unapply" ? "DESAPLICADO" : "APLICADO";
        count++;
      }
    return action === "unapply"
      ? { links_desaplicados: count }
      : { links_reaplicados: count, omitidos: [] };
  },
};
const valuationRows: DataRow[] = Array.from({ length: 1101 }, (_, index) => {
  const cost = index % 3 === 0 ? 0 : 0.0157;
  const stock = index % 20 === 0 ? 0 : 1000 + index;
  return {
    codigo_material_recibido: `MAT/26-${String(index + 1).padStart(5, "0")}`,
    numero_parte_sistema: index % 2 ? "0CE105VK6DC-01-A" : "EAH61515501",
    numero_lote: `LOTE-${index + 1}`,
    pallet_no: index % 2 ? "007" : "009",
    pallet_no_original: index % 2 ? "PL-007" : "PL-009",
    vendedor: "SAMWHA",
    stock_actual: stock,
    unidad_medida: "EA",
    costo_unitario: cost,
    moneda: index % 2 ? "USD" : "MXN",
    valor_total: stock * cost,
    fuente_costo:
      index % 3 === 0
        ? "SIN_COSTO"
        : index % 3 === 1
          ? "INVOICE"
          : "CONTROL_MATERIAL",
    es_estimado: index % 3 !== 1 ? 1 : 0,
    numero_invoice: index % 3 === 1 ? "INV-ALMACEN-DEMO" : "",
    numero_transaccion: "PO/26-001+A&B",
  };
});
function filteredValuation(filters: ValuationFilters) {
  return valuationRows.filter(
    (row) =>
      (filters.include_zero_stock === "1" || amount(row.stock_actual) > 0) &&
      (!filters.numero_parte ||
        contains(text(row.numero_parte_sistema), filters.numero_parte)) &&
      (!filters.codigo_material_recibido ||
        contains(
          text(row.codigo_material_recibido),
          filters.codigo_material_recibido,
        )) &&
      (!filters.pallet_no || row.pallet_no === filters.pallet_no) &&
      (!filters.fuente_costo || row.fuente_costo === filters.fuente_costo),
  );
}
export const demoValuation: ValuationApi = {
  async list(filters, page, size) {
    const all = filteredValuation(filters);
    return {
      records: structuredClone(all.slice((page - 1) * size, page * size)),
      total: all.length,
      limit: size,
      offset: (page - 1) * size,
    };
  },
  async summary(filters) {
    const groups = new Map<string, DataRow>();
    for (const row of filteredValuation(filters)) {
      const key = `${text(row.fuente_costo)}:${text(row.moneda)}`;
      const group = groups.get(key) || {
        fuente_costo: row.fuente_costo,
        moneda: row.moneda,
        lotes: 0,
        stock_total: 0,
        valor_total: 0,
      };
      group.lotes = amount(group.lotes) + 1;
      group.stock_total = amount(group.stock_total) + amount(row.stock_actual);
      group.valor_total = amount(group.valor_total) + amount(row.valor_total);
      groups.set(key, group);
    }
    return structuredClone([...groups.values()]);
  },
  async export(filters) {
    const { exportRows } = await import("./exportRows");
    const { VALUATION } = await import("./columns");
    await exportRows(
      "valorizacion_demostracion",
      VALUATION,
      filteredValuation(filters),
    );
  },
  async backfill(dryRun) {
    const withStock = valuationRows.filter(
      (row) => amount(row.stock_actual) > 0,
    );
    const candidates = withStock.filter(
      (row) => row.fuente_costo === "SIN_COSTO",
    );
    const preview = candidates.map((row) => ({
      ...row,
      costo_unitario: 0.0157,
      valor_total: amount(row.stock_actual) * 0.0157,
    }));
    if (!dryRun)
      for (const row of candidates.slice(0, 500)) {
        row.costo_unitario = 0.0157;
        row.valor_total = amount(row.stock_actual) * 0.0157;
        row.fuente_costo = "CONTROL_MATERIAL";
      }
    return {
      total_lotes: withStock.length,
      preview_records: dryRun ? structuredClone(preview.slice(0, 5000)) : [],
      preview_total: preview.length,
      preview_truncated: false,
      procesados_lotes: dryRun ? 0 : Math.min(500, candidates.length),
      ya_tenian_costo: withStock.filter(
        (row) => row.fuente_costo === "CONTROL_MATERIAL",
      ).length,
      asignados_control_material: dryRun
        ? candidates.length
        : Math.min(500, candidates.length),
      quedaron_sin_costo: 0,
      no_sobrescritos_invoice: withStock.filter(
        (row) => row.fuente_costo === "INVOICE",
      ).length,
      pendientes_aplicables: dryRun
        ? candidates.length
        : Math.max(0, candidates.length - 500),
    };
  },
};
