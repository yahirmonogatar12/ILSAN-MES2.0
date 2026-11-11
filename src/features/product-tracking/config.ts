import type { FilterField } from "@/shared/ui";
import { today } from "./model";
import type { Filters, TraceView } from "./types";

const process: FilterField<Filters> = {
  key: "proceso",
  label: "Proceso",
  type: "select",
  options: [
    { value: "", label: "Todos" },
    ...["ASSY", "IMD", "SMT"].map((value) => ({ value, label: value })),
  ],
};
const dates: FilterField<Filters>[] = [
  { key: "fecha_inicio", label: "Desde", type: "date" },
  { key: "fecha_fin", label: "Hasta", type: "date" },
];
export const traceViews: Record<
  TraceView,
  {
    title: string;
    fields: FilterField<Filters>[];
    minWidth: number;
    limit: number;
  }
> = {
  por_pcb: {
    title: "Materiales del PCB",
    minWidth: 1260,
    limit: 3000,
    fields: [
      {
        key: "pcb",
        label: "PCB (QR / barcode)",
        type: "search",
        placeholder: "Escanea o pega el QR / barcode del PCB...",
        autoFocus: true,
      },
      process,
    ],
  },
  materiales: {
    title: "Materiales por lote de producción",
    minWidth: 1240,
    limit: 3000,
    fields: [
      process,
      { key: "lot_no", label: "Lote de producción", type: "search" },
      { key: "part_no", label: "No. parte (PCB)", type: "search" },
      { key: "material", label: "Material / lote proveedor", type: "search" },
      ...dates,
    ],
  },
  por_proveedor: {
    title: "PCBs por lote de proveedor",
    minWidth: 1120,
    limit: 5000,
    fields: [
      process,
      { key: "material", label: "Lote proveedor / material", type: "search" },
      ...dates,
    ],
  },
};
export function defaultFilters(view: TraceView): Filters {
  return Object.fromEntries(
    traceViews[view].fields.map((field) => [
      field.key,
      view === "materiales" && field.key === "fecha_inicio" ? today() : "",
    ]),
  );
}
