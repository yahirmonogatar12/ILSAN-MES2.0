import { useState } from "react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { Page, TabBar, tabIds } from "@/shared/ui";
import { TracePanel } from "./TracePanel";
import type { TraceView } from "./types";
import "./module.css";

const tabs = [
  { id: "por_pcb", label: "Por PCB (QR / barcode)" },
  { id: "materiales", label: "Por lote de producción" },
  { id: "por_proveedor", label: "Por lote de proveedor (inversa)" },
];
export default function PcbPage() {
  const [tab, setTab] = useState<TraceView>("por_pcb");
  return (
    <Page className="product-tracking-page" banner={<DemoBanner />}>
      <TabBar
        id="pcb-traceability"
        label="Vistas de trazabilidad"
        items={tabs}
        activeId={tab}
        onChange={(value) => setTab(value as TraceView)}
      />
      {tabs.map((item) => {
        const ids = tabIds("pcb-traceability", item.id);
        return (
          <section
            key={item.id}
            id={ids.panel}
            aria-labelledby={ids.tab}
            role="tabpanel"
            hidden={tab !== item.id}
            className="product-tracking-panel"
          >
            <TracePanel view={item.id as TraceView} active={tab === item.id} />
          </section>
        );
      })}
    </Page>
  );
}
