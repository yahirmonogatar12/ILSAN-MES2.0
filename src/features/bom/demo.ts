import { saveDownload } from "@/core/http";
import type { BomApi, BomItem, Diff, EcoDetail, FileRecord } from "./types";
const items: BomItem[] = [
  {
    id: 1,
    modelo: "EBR80757401",
    numeroParte: "RC0603FR-0710KL",
    tipoMaterial: "SMD",
    classification: "SMD",
    especificacionMaterial: "Resistencia 10k Ω",
    vender: "Yageo",
    cantidadTotal: 4,
    ubicacion: "R1,R2,R3,R4",
    materialSustituto: "",
    materialOriginal: null,
    registrador: "KS",
    fechaRegistro: "2026-11-04",
    bomRevision: "001",
  },
  {
    id: 2,
    modelo: "EBR80757401",
    numeroParte: "GRM188R71C104KA01",
    tipoMaterial: "SMD",
    classification: "SMD",
    especificacionMaterial: "Capacitor 100nF",
    vender: "Murata",
    cantidadTotal: 2,
    ubicacion: "C1,C2",
    materialSustituto: "",
    materialOriginal: null,
    registrador: "KS",
    fechaRegistro: "2026-11-04",
    bomRevision: "001",
  },
];
const ecos: EcoDetail[] = [
  {
    id: 1,
    eco_no: "ECO-DEMO-001",
    part_no: "EBR80757401",
    bom_revision: "002",
    effective_at: "2026-11-04 08:00:00",
    status: "DRAFT",
    origen: "MES",
    created_by: "Demostración",
    notes: "Borrador de ejemplo",
    items: [
      {
        material_code: "RC0603FR-0710KL",
        item_name: "Resistencia",
        qty: 5,
        unit: "EA",
        location_text: "R1,R2,R3,R4,R5",
        tipo_material: "SMD",
      },
    ],
    scope: [
      {
        part_no: "EBR80757401",
        family_prefix: "EBR807574",
        bom_revision: "002",
      },
    ],
  },
];
const files = new Map<number, FileRecord[]>([
  [
    1,
    [
      {
        id: 1,
        nombre_original: "instruccion_demo.html",
        extension: ".html",
        created_by: "Demostración",
        created_at: "2026-11-04",
      },
    ],
  ],
]);
const blobs = new Map<number, Blob>([
  [
    1,
    new Blob(
      [
        "<!doctype html><html lang=es><meta charset=utf-8><title>Instrucción demo</title><body style='font-family:Arial;padding:24px'><h1>Papelería de demostración</h1><p>Modelo EBR80757401 · Instrucción de trabajo de ejemplo.</p></body></html>",
      ],
      { type: "text/html" },
    ),
  ],
]);
let nextFile = 2;
const clone = structuredClone;
function csv(name: string, rows: unknown[]) {
  saveDownload(
    new Blob(
      [
        "\ufeffDatos de demostración\n" +
          rows
            .map((row) => JSON.stringify(row).replace(/[\r\n]/g, " "))
            .join("\n"),
      ],
      { type: "text/plain;charset=utf-8" },
    ),
    name,
  );
}
export const demoApi: BomApi = {
  async models() {
    return ["EBR80757401", "EBR80757402"];
  },
  async revisions() {
    return [
      { bom_rev: "001", is_current: true },
      { bom_rev: "000", is_current: false },
    ];
  },
  async list(filters) {
    return clone(
      items
        .filter(
          (item) =>
            item.modelo === filters.modelo &&
            (filters.classification === "TODOS" ||
              item.classification === filters.classification),
        )
        .map((item) => ({
          ...item,
          bomRevision: filters.bom_revision || item.bomRevision,
        })),
    );
  },
  async export(filters) {
    csv("bom_demostracion.txt", await this.list(filters));
  },
  async history(filters, page, pageSize) {
    const rows = ecos.filter(
      (row) =>
        (!filters.eco_no || row.eco_no.includes(filters.eco_no)) &&
        (!filters.part_no || row.part_no.includes(filters.part_no)) &&
        (!filters.status || row.status === filters.status) &&
        (!filters.origen || row.origen === filters.origen) &&
        (!filters.date_from ||
          row.effective_at.slice(0, 10) >= filters.date_from) &&
        (!filters.date_to || row.effective_at.slice(0, 10) <= filters.date_to),
    );
    const active = Object.values(filters).some(Boolean);
    return {
      data: clone(
        rows.slice(
          active ? (page - 1) * pageSize : 0,
          active ? page * pageSize : 200,
        ),
      ),
      meta: {
        total: rows.length,
        page: active ? page : 1,
        page_size: active ? pageSize : 200,
        filters_active: active,
        has_more: false,
      },
    };
  },
  async exportHistory(filters) {
    csv("ecos_demostracion.txt", (await this.history(filters, 1, 500)).data);
  },
  async detail(row) {
    const eco = ecos.find((eco) => eco.id === row.id);
    if (!eco) throw new Error("ECO no encontrado.");
    return clone(eco);
  },
  async diff(id) {
    if (!ecos.some((eco) => eco.id === id))
      throw new Error("ECO no encontrado.");
    const diff: Diff = {
      added: [],
      removed: [],
      modified_admin: [],
      modified: [
        {
          part_no: "EBR80757401",
          bom_level: 1,
          item_no: "RC0603FR-0710KL",
          field_changed: "qty",
          old_value: "4",
          new_value: "5",
        },
      ],
      counts: { added: 0, removed: 0, modified: 1, modified_admin: 0 },
    };
    return diff;
  },
  async family(family, suffixes) {
    const parsed = suffixes.split(/[,;\s]+/).filter(Boolean);
    const parts = parsed
      .map((suffix) => `${family}${suffix}`)
      .filter((part) => ["EBR80757401", "EBR80757402"].includes(part));
    return {
      family,
      parts: parts.map((part_no) => ({ part_no })),
      missing: parsed.filter((suffix) => !parts.includes(`${family}${suffix}`)),
    };
  },
  async nextRevision() {
    return "002";
  },
  async template() {
    saveDownload(
      new Blob(
        ["item_no,qty,bom_level,location_text\nRC0603FR-0710KL,4,1,R1"],
        { type: "text/csv" },
      ),
      "plantilla_bom_demostracion.csv",
    );
  },
  async importEco(draft, parts) {
    if (ecos.some((eco) => eco.eco_no === draft.eco_no))
      throw new Error("Ese número de ECO ya existe.");
    const id = Math.max(0, ...ecos.map((eco) => Number(eco.id))) + 1;
    ecos.unshift({
      id,
      eco_no: draft.eco_no,
      part_no: draft.part_no || parts[0],
      bom_revision: "002",
      effective_at: draft.effective_at,
      status: "DRAFT",
      origen: "MES",
      notes: draft.notes,
      item_name: draft.item_name,
      items: [],
      scope: (parts.length ? parts : [draft.part_no]).map((part_no) => ({
        part_no,
        family_prefix: draft.family || part_no.slice(0, -2),
        bom_revision: "002",
      })),
      scope_parts: parts.join(","),
      scope_count: parts.length,
    });
    files.set(id, []);
    return { eco_id: id, bom_revision: "002" };
  },
  async importItems(id) {
    if (ecos.find((row) => row.id === id)?.status !== "DRAFT")
      throw new Error("Solo se puede reemplazar un borrador.");
  },
  async action(id, action) {
    const index = ecos.findIndex((eco) => Number(eco.id) === id);
    if (index < 0) throw new Error("ECO no encontrado.");
    const eco = ecos[index];
    if (eco.status === "APPROVED")
      throw new Error("Un ECO aprobado es inmutable.");
    if (action === "delete") {
      ecos.splice(index, 1);
      files.delete(id);
    } else if (eco.status !== "DRAFT")
      throw new Error("La acción requiere un borrador.");
    else {
      eco.status = action === "approve" ? "APPROVED" : "CANCELLED";
      if (action === "approve") eco.approved_by = "Demostración";
    }
  },
  async files(id) {
    return clone(files.get(id) || []);
  },
  async paperwork(part) {
    const eco =
      ecos.find(
        (eco) => eco.part_no === part && files.get(Number(eco.id))?.length,
      ) || null;
    return {
      eco: eco ? clone(eco) : null,
      files: clone(eco ? files.get(Number(eco.id)) || [] : []),
    };
  },
  async upload(id, file) {
    const row = {
      id: nextFile++,
      nombre_original: file.name,
      extension: `.${file.name.split(".").pop()?.toLowerCase()}`,
      created_by: "Demostración",
      created_at: new Date().toISOString(),
    };
    files.set(id, [...(files.get(id) || []), row]);
    blobs.set(row.id, file);
  },
  async removeFile(id, fileId) {
    if (ecos.find((eco) => Number(eco.id) === id)?.status === "APPROVED")
      throw new Error("No se pueden borrar archivos aprobados.");
    files.set(
      id,
      (files.get(id) || []).filter((file) => file.id !== fileId),
    );
    blobs.delete(fileId);
  },
  async fileBlob(_id, file) {
    const blob = blobs.get(file.id);
    if (!blob) throw new Error("Archivo no disponible.");
    return blob;
  },
  async download(id, file) {
    saveDownload(await this.fileBlob(id, file), file.nombre_original);
  },
};
