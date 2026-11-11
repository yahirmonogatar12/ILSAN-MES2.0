import { Activity, useId, useMemo, useState } from "react";
import {
  Alert,
  DataGrid,
  FormSection,
  TabBar,
  tabIds,
  type TableColumn,
} from "@/shared/ui";
import type { Diff, ItemData } from "./types";

const fieldNames: Record<string, string> = {
  qty: "Cantidad",
  item_no: "Número de parte",
  item_name: "Nombre",
  spec: "Especificación",
  unit: "Unidad",
  location_text: "Ubicación",
  maker: "Maker",
  supplier: "Proveedor",
  is_alternate: "Material sustituto",
  alt_item_no: "Parte sustituta",
  alt_item_name: "Nombre del sustituto",
  alt_spec: "Especificación del sustituto",
  alt_maker: "Maker del sustituto",
  valid_from: "Vigencia desde",
  valid_to: "Vigencia hasta",
  remark: "Observaciones",
  item_class: "Clasificación",
  item_process: "Proceso",
  process_name: "Nombre del proceso",
};
function text(value: unknown) {
  return value == null || value === ""
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
type Field = [id: string, title: string, width: number];
function columns(fields: Field[], model?: string): TableColumn<ItemData>[] {
  return fields.map(([id, header, width]) => {
    const value = (row: ItemData) =>
      id === "part_no"
        ? text(row.part_no || model)
        : id === "field_changed"
          ? Object.hasOwn(fieldNames, String(row[id]))
            ? fieldNames[String(row[id])]
            : text(row[id])
          : text(row[id]);
    return {
      id,
      header,
      width: `${width}%`,
      cell: value,
      sortValue: value,
      className:
        id === "old_value"
          ? "bom-diff-before"
          : id === "new_value"
            ? "bom-diff-after"
            : undefined,
    };
  });
}

/** Presents the server's persisted differences without recalculating a BOM baseline. */
export function EcoDifferences({
  diff,
  model,
}: {
  diff: Diff;
  model?: string;
}) {
  const id = useId();
  const [selected, setSelected] = useState(
    diff.modified.length ? "Modificados" : "Añadidos",
  );
  const full = useMemo(
    () =>
      columns(
        [
          ["part_no", "MODELO", 10],
          ["bom_level", "NIVEL", 7],
          ["item_no", "ITEM", 20],
          ["eco_item_name", "NOMBRE", 17],
          ["eco_qty", "CANTIDAD", 8],
          ["eco_unit", "UNIDAD", 7],
          ["eco_location_text", "UBICACIÓN", 14],
          ["eco_maker", "MAKER", 8],
          ["eco_supplier", "PROVEEDOR", 9],
        ],
        model,
      ),
    [model],
  );
  const modified = useMemo(
    () =>
      columns(
        [
          ["part_no", "MODELO", 12],
          ["bom_level", "NIVEL", 8],
          ["item_no", "ITEM", 24],
          ["field_changed", "CAMPO", 16],
          ["old_value", "ANTES", 20],
          ["new_value", "DESPUÉS", 20],
        ],
        model,
      ),
    [model],
  );
  const groups = [
    {
      title: "Añadidos",
      rows: diff.added,
      columns: full,
      tone: "added",
      description: "Componentes que se agregarán al BOM.",
    },
    {
      title: "Modificados",
      rows: diff.modified,
      columns: modified,
      tone: "modified",
      description:
        "Comparación del valor anterior y el propuesto, por componente y campo.",
    },
    {
      title: "Eliminados",
      rows: diff.removed,
      columns: full,
      tone: "removed",
      description: "Componentes que se retirarán del BOM.",
    },
    {
      title: "Cambios administrativos",
      rows: diff.modified_admin,
      columns: modified,
      tone: "modified",
      description:
        "Comparación de los datos administrativos anteriores y propuestos.",
    },
  ];
  const visible = groups.filter((group) => group.rows.length > 0);
  const active =
    visible.find((group) => group.title === selected)?.title ||
    visible[0]?.title ||
    null;
  return (
    <div className="bom-differences">
      <Alert tone={diff.warning ? "warning" : "info"}>
        {diff.counts.added} añadidos · {diff.counts.modified} modificados ·{" "}
        {diff.counts.removed} eliminados · {diff.counts.modified_admin} cambios
        administrativos.
        {diff.warning?.message && ` ${diff.warning.message}`}
      </Alert>
      <TabBar
        id={id}
        label="Diferencias del ECO"
        items={visible.map((group) => ({
          id: group.title,
          label: `${group.title} (${group.rows.length})`,
        }))}
        activeId={active}
        onChange={setSelected}
      />
      {visible.map((group) => (
        <Activity
          key={group.title}
          mode={active === group.title ? "visible" : "hidden"}
        >
          <section
            role="tabpanel"
            id={tabIds(id, group.title).panel}
            aria-labelledby={tabIds(id, group.title).tab}
          >
            <FormSection title={group.title} description={group.description}>
              <DataGrid
                label={`${group.title} del ECO`}
                rows={group.rows}
                columns={group.columns}
                rowKey={(item) => String(item.id ?? JSON.stringify(item))}
                className={`bom-diff-${group.tone}`}
                layout="fixed"
                minWidth={group.columns === full ? 1180 : 900}
                maxHeight="clamp(140px, calc(100dvh - 520px), 440px)"
              />
            </FormSection>
          </section>
        </Activity>
      ))}
    </div>
  );
}
