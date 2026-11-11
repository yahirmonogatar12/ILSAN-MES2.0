import { useState } from "react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { Page, TabBar, tabIds } from "@/shared/ui";
import { BatchPanel } from "./BatchPanel";
import { PiecePanel } from "./PiecePanel";
import "./module.css";

const tabs = [
  { id: "piece", label: "Una pieza" },
  { id: "batch", label: "Varias piezas (importar Excel)" },
];
export default function TrackingPage() {
  const [tab, setTab] = useState("piece");
  return (
    <Page className="product-tracking-page" banner={<DemoBanner />}>
      <TabBar
        id="production-tracking"
        label="Consulta de etapas"
        items={tabs}
        activeId={tab}
        onChange={setTab}
      />
      {tabs.map((item) => {
        const ids = tabIds("production-tracking", item.id);
        return (
          <section
            key={item.id}
            id={ids.panel}
            aria-labelledby={ids.tab}
            role="tabpanel"
            hidden={tab !== item.id}
            className="product-tracking-panel"
          >
            {item.id === "piece" ? (
              <PiecePanel active={tab === "piece"} />
            ) : (
              <BatchPanel active={tab === "batch"} />
            )}
          </section>
        );
      })}
    </Page>
  );
}
