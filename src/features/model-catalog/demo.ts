import { normalizeSearch } from "@/shared/lib/text";
import { cleanDraft, rowKey } from "./model";
import type { CatalogData, CatalogKind, ModelRow } from "./types";
const records: Record<CatalogKind, CatalogData> = {
  smt: {
    columns: ["part_no", "model", "linea", "lado", "array", "uph", "usuario"],
    total: 2,
    rows: [
      {
        __rowhash: "demo-smt-1",
        part_no: "EBR80757401",
        model: "MODELO A",
        linea: "SMT A",
        lado: "BOTTOM",
        array: 4,
        uph: 800,
        usuario: "Demostración",
      },
      {
        __rowhash: "demo-smt-2",
        part_no: "EBR80757402",
        model: "MODELO B",
        linea: "SMT B",
        lado: "TOP",
        array: 2,
        uph: 600,
        usuario: "Demostración",
      },
    ],
  },
  models: {
    columns: [
      "id",
      "part_no",
      "model",
      "project",
      "main_display",
      "linea",
      "uph",
      "lineas_permitidas",
      "Usuario",
    ],
    total: 2,
    rows: [
      {
        id: 1,
        part_no: "EBR80757401",
        model: "MODELO A",
        project: "Proyecto demo",
        main_display: "MAIN",
        linea: "ASSY A",
        uph: 500,
        lineas_permitidas: "ASSY-A,ASSY-B",
        Usuario: "Demostración",
      },
      {
        id: 2,
        part_no: "EBR80757402",
        model: "MODELO B",
        project: "Proyecto demo",
        main_display: "DISPLAY",
        linea: "ASSY B",
        uph: 450,
        lineas_permitidas: null,
        Usuario: "Demostración",
      },
    ],
  },
};
export function list(kind: CatalogKind, query: string) {
  const data = structuredClone(records[kind]);
  if (kind === "models" && query.trim())
    data.rows = data.rows.filter((row) =>
      normalizeSearch(Object.values(row).join(" ")).includes(
        normalizeSearch(query.trim()),
      ),
    );
  return { ...data, total: data.rows.length };
}
export function save(
  kind: CatalogKind,
  values: ModelRow,
  original: ModelRow | null,
  columns: string[],
) {
  const data = records[kind];
  const row = {
    ...(original || {}),
    ...cleanDraft(values, columns, kind),
    ...(kind === "smt"
      ? { __rowhash: crypto.randomUUID() }
      : original
        ? {}
        : { id: Math.max(0, ...data.rows.map((item) => Number(item.id))) + 1 }),
  };
  data.rows = original
    ? data.rows.map((item) => (rowKey(item) === rowKey(original) ? row : item))
    : [row, ...data.rows];
}
export function remove(kind: CatalogKind, original: ModelRow) {
  records[kind].rows = records[kind].rows.filter(
    (item) => rowKey(item) !== rowKey(original),
  );
}
export function familyLines(familia: string, lineas: string) {
  let partes = 0;
  records.models.rows.forEach((row) => {
    if (String(row.part_no).startsWith(familia)) {
      row.lineas_permitidas = lineas || null;
      partes++;
    }
  });
  if (!partes) throw new Error("No hay modelos para esa familia.");
  return { partes, lineas: lineas || null };
}
