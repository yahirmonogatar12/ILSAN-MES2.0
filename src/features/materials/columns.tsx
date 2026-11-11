import { Clock3, Pencil, Trash2 } from "lucide-react";
import { Button, TableRowActions, type TableColumn } from "@/shared/ui";
import { formatCost, hasCost } from "./model";
import type { Material, VendorCost } from "./types";

interface MaterialActions {
  openingCode: string;
  open: (
    record: Material,
    action: "detail" | "edit" | "history" | "delete",
  ) => void;
}
/** Only column definitions know the Material model; the table itself is generic. */
export function materialColumns(
  actions: MaterialActions,
): TableColumn<Material>[] {
  return [
    {
      id: "part",
      header: "NÚMERO DE PARTE",
      textValue: (row) => row.numero_parte,
      minWidth: 160,
      sortValue: (row) => row.numero_parte,
      cell: (row) => (
        <Button
          variant="plain"
          className="material-code"
          disabled={!!actions.openingCode}
          onClick={() => actions.open(row, "detail")}
        >
          {row.numero_parte}
        </Button>
      ),
    },
    {
      id: "classification",
      header: "CLASIFICACIÓN",
      sortValue: (row) => row.clasificacion,
      cell: (row) => row.clasificacion || "Sin clasificar",
    },
    {
      id: "property",
      header: "PROPIEDAD",
      sortValue: (row) => row.propiedad_material,
      cell: (row) => row.propiedad_material || "—",
    },
    {
      id: "specification",
      header: "ESPECIFICACIÓN",
      minWidth: 265,
      align: "left",
      className: "material-specification",
      cell: (row) => row.especificacion_material,
    },
    {
      id: "measureUnit",
      header: "UNIDAD DE MEDIDA",
      sortValue: (row) => row.unidad_medida,
      cell: (row) => row.unidad_medida || "—",
    },
    {
      id: "packagingUnit",
      header: "UNIDAD DE EMPAQUE",
      sortValue: (row) => row.unidad_empaque,
      cell: (row) => row.unidad_empaque || "—",
    },
    {
      id: "vendors",
      header: "VENDEDOR",
      textValue: (row) => row.vendedores.join(" · "),
      cell: (row) => (
        <span className="material-vendors">
          {row.vendedores.length ? (
            row.vendedores.map((name) => <span key={name}>{name}</span>)
          ) : (
            <span className="muted">Sin vendedor</span>
          )}
        </span>
      ),
    },
    {
      id: "cost",
      header: "COSTO UNITARIO",
      textValue: (row) =>
        row.costos.some(hasCost)
          ? row.costos.map(formatCost).join(" · ")
          : "Sin registrar",
      cell: (row) => <CostValues costs={row.costos} />,
    },
    {
      id: "registered",
      header: "REGISTRO",
      textValue: (row) =>
        `${row.fecha_registro?.split(" ")[0] || "—"} · ${row.usuario_registro || "—"}`,
      sortValue: (row) => row.fecha_registro,
      cell: (row) => (
        <span className="material-registration">
          {row.fecha_registro?.split(" ")[0] || "—"}
          <small className="cell-subtitle">{row.usuario_registro || "—"}</small>
        </span>
      ),
    },
    {
      id: "actions",
      header: "ACCIONES",
      filterable: false,
      cell: (row) => (
        <TableRowActions
          loading={actions.openingCode === row.numero_parte}
          actions={[
            {
              id: "edit",
              label: `Editar ${row.numero_parte}`,
              icon: <Pencil size={15} />,
              disabled: !!actions.openingCode,
              onClick: () => actions.open(row, "edit"),
            },
            {
              id: "history",
              label: `Historial de ${row.numero_parte}`,
              icon: <Clock3 size={16} />,
              disabled: !!actions.openingCode,
              onClick: () => actions.open(row, "history"),
            },
            {
              id: "delete",
              label: `Dar de baja ${row.numero_parte}`,
              icon: <Trash2 size={15} />,
              tone: "danger",
              disabled: !!actions.openingCode,
              onClick: () => actions.open(row, "delete"),
            },
          ]}
        />
      ),
    },
  ];
}
export function CostValues({ costs }: { costs: readonly VendorCost[] }) {
  if (!costs.some(hasCost))
    return <span className="no-cost">Sin registrar</span>;
  return (
    <span className="material-costs">
      {costs.map((cost) => (
        <span className="cost-value" key={cost.vendedor} title={cost.vendedor}>
          {formatCost(cost)}
        </span>
      ))}
    </span>
  );
}
export const historyColumns: TableColumn<VendorCost>[] = [
  { id: "vendor", header: "Vendedor", cell: (row) => row.vendedor },
  {
    id: "cost",
    header: "Costo unitario",
    textValue: (row) => formatCost(row),
    cell: (row) => formatCost(row),
  },
  {
    id: "user",
    header: "Registrado por",
    cell: (row) => row.usuario_registro || "—",
  },
  { id: "date", header: "Fecha", cell: (row) => row.fecha_registro || "—" },
];
